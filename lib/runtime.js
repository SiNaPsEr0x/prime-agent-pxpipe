import { transformOpenAIResponses } from "pxpipe-proxy";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { checkAndApplyGitUpdate } from "./updater.js";
import { autoUpdateEnabled, getStateFile, readState, writeState } from "./state.js";
import { createUninstallHelper } from "./uninstall.js";

const PLUGIN_NAME = "prime-agent-pxpipe";
const DEFAULT_MODELS = ["gpt-5.6-sol"];
const DEFAULT_BUG_URL = "https://github.com/SiNaPsEr0x/prime-agent-pxpipe/issues";

function parseTargetModels() {
  const raw = process.env.PRIME_PXPIPE_MODELS?.trim();
  if (!raw) return DEFAULT_MODELS;

  const models = raw
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return models.length > 0 ? models : DEFAULT_MODELS;
}

function readPackageMeta(packageRoot) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
    return {
      version: String(pkg.version || "unknown"),
      bugUrl: String(pkg?.bugs?.url || DEFAULT_BUG_URL),
      repository: typeof pkg.repository === "string" ? pkg.repository : pkg?.repository?.url,
    };
  } catch {
    return { version: "unknown", bugUrl: DEFAULT_BUG_URL, repository: null };
  }
}

export default function pxpipeRuntime(pi, { packageRoot, startupUpdate } = {}) {
  let meta = readPackageMeta(packageRoot);
  const targetModels = new Set(parseTargetModels());
  let enabled = readState().enabled !== false;

  let requests = 0;
  let compressed = 0;
  let images = 0;
  let savedTokensTotal = 0;

  let turnRequests = 0;
  let turnCompressed = 0;
  let turnImages = 0;
  let turnSaved = 0;
  let turnBaseline = 0;
  let turnActual = 0;

  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("it-IT");
  const pct = (n) => (Number(n) || 0).toLocaleString("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  function loadEnabled() {
    enabled = readState().enabled !== false;
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    writeState({ enabled });
  }

  function restoreSessionStats(ctx) {
    requests = 0;
    compressed = 0;
    images = 0;
    savedTokensTotal = 0;

    try {
      for (const entry of ctx.sessionManager.getEntries()) {
        if (entry?.type !== "custom" || entry?.customType !== `${PLUGIN_NAME}-stats`) continue;
        const data = entry.data || {};
        requests += Math.max(0, Number(data.requests) || 0);
        compressed += Math.max(0, Number(data.compressed) || 0);
        images += Math.max(0, Number(data.images) || 0);
        savedTokensTotal += Math.max(0, Number(data.savedTokens) || 0);
      }
    } catch {
      // Cosmetic only.
    }
  }

  function persistTurnStats() {
    if (turnRequests <= 0) return;
    try {
      pi.appendEntry(`${PLUGIN_NAME}-stats`, {
        requests: turnRequests,
        compressed: turnCompressed,
        images: turnImages,
        savedTokens: turnSaved,
        ts: Date.now(),
      });
    } catch {
      // Fail-open.
    }
  }

  function show(ctx, text) {
    if (!ctx?.hasUI && ctx?.hasUI !== undefined) return;
    ctx.ui.setWidget("pxpipe", [text], { placement: "belowEditor" });
  }

  function statusLine() {
    return enabled
      ? `⚡ pxpipe v${meta.version} ON · req ${requests} · comp ${compressed} · img ${images} · sess ~${fmt(savedTokensTotal)} tok`
      : `⏸ pxpipe v${meta.version} OFF`;
  }

  function updateStateText() {
    const state = readState();
    const auto = autoUpdateEnabled(state) ? "ON" : "OFF";
    return `auto-update ${auto} · check ${state.lastUpdateCheckAt || "mai"} · ultimo update ${state.lastUpdateVersion || "-"}`;
  }

  function helpText() {
    return [
      `pxpipe v${meta.version} ${enabled ? "ON" : "OFF"} | richieste: ${requests} | compresse: ${compressed} | immagini: ${images} | risparmio sessione: ~${fmt(savedTokensTotal)} token`,
      `Aggiornamenti: ${updateStateText()}`,
      "",
      "Comandi:",
      "/pxpipe on             → attiva e salva lo stato",
      "/pxpipe off            → disattiva e salva lo stato",
      "/pxpipe status         → statistiche",
      "/pxpipe update         → aggiorna subito da GitHub",
      "/pxpipe autoupdate on  → auto-update ON",
      "/pxpipe autoupdate off → auto-update OFF",
      "/pxpipe bug            → link segnalazione bug",
      "/pxpipe uninstall      → rimuove package, stato e cartella",
      "/pxpipe help           → questo aiuto",
      "",
      "Alias autocomplete:",
      "/pxpipe-on  /pxpipe-off  /pxpipe-status",
      "/pxpipe-update  /pxpipe-autoupdate  /pxpipe-bug  /pxpipe-uninstall  /pxpipe-help",
      "",
      `Modelli gestiti: ${[...targetModels].join(", ")}`,
    ].join("\n");
  }


  async function runUninstall(ctx) {
    const stateFile = getStateFile();
    let helperDir;

    try {
      const helper = createUninstallHelper();
      helperDir = helper.helperDir;
      const child = spawn("bash", [helper.scriptPath, packageRoot, stateFile], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      ctx.ui.notify(
        "Disinstallazione avviata: pxpipe verrà rimosso completamente. Se Prime-Agent resta aperto, esci e riaprilo.",
        "warning",
      );
      show(ctx, `🧹 pxpipe v${meta.version} uninstall avviato…`);
    } catch (error) {
      if (helperDir) {
        fs.rmSync(helperDir, { force: true, recursive: true });
      }
      ctx.ui.notify(
        `Impossibile avviare la disinstallazione automatica: ${error instanceof Error ? error.message : String(error)}`,
        "warning",
      );
    }
  }

  async function runManualUpdate(ctx) {
    ctx.ui.notify("pxpipe: controllo aggiornamenti GitHub…", "info");
    const result = await checkAndApplyGitUpdate({ packageRoot, force: true });

    if (result.status === "updated") {
      ctx.ui.notify(
        `pxpipe aggiornato ${result.fromVersion} → ${result.toVersion}. Ricarico l'estensione…`,
        "info",
      );
      await ctx.reload();
      return;
    }

    if (result.status === "current") {
      ctx.ui.notify(`pxpipe v${result.version}: già aggiornato.`, "info");
      return;
    }

    if (result.status === "unsupported") {
      ctx.ui.notify(result.message || "Auto-update non disponibile per questa installazione.", "warning");
      return;
    }

    if (result.status === "diverged") {
      ctx.ui.notify(result.message || "Checkout Git divergente: update saltato.", "warning");
      return;
    }

    if (result.status === "dirty") {
      ctx.ui.notify(result.message, "warning");
      return;
    }

    ctx.ui.notify(`pxpipe update: ${result.message || result.status}`, "warning");
  }

  pi.on("session_start", async (_event, ctx) => {
    meta = readPackageMeta(packageRoot);
    loadEnabled();
    restoreSessionStats(ctx);
    show(ctx, statusLine());

    if (startupUpdate?.status === "updated") {
      ctx.ui.notify(
        `pxpipe aggiornato automaticamente ${startupUpdate.fromVersion} → ${startupUpdate.toVersion} ✓`,
        "info",
      );
    }
  });

  pi.on("agent_start", async () => {
    loadEnabled();
    turnRequests = 0;
    turnCompressed = 0;
    turnImages = 0;
    turnSaved = 0;
    turnBaseline = 0;
    turnActual = 0;
  });

  pi.on("before_provider_request", async (event) => {
    loadEnabled();
    if (!enabled) return;

    const payload = event?.payload;
    const model = payload?.model;
    if (!model || !targetModels.has(model)) return;

    turnRequests += 1;

    try {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const result = await transformOpenAIResponses(
        encoder.encode(JSON.stringify(payload)),
      );
      const info = result?.info;
      if (!info?.compressed) return;

      const imageCount = Math.max(0, Number(info.imageCount) || 0);
      const baseline = Math.max(0, Number(info.baselineImagedTokens) || 0);
      const imageTokens = Math.max(0, Number(info.imageTokens) || 0);
      const nativeInjected = Math.max(0, Number(info.nativeInjectedTokens) || 0);
      const actual = imageTokens + nativeInjected;
      const saved = Math.max(0, baseline - actual);

      turnCompressed += 1;
      turnImages += imageCount;
      turnSaved += saved;
      turnBaseline += baseline;
      turnActual += actual;

      return JSON.parse(decoder.decode(result.body));
    } catch {
      return;
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    loadEnabled();

    if (!enabled) {
      show(ctx, `⏸ pxpipe v${meta.version} OFF`);
      return;
    }

    if (turnRequests <= 0) {
      show(ctx, `⚡ pxpipe v${meta.version} ON · modello non gestito · sess ~${fmt(savedTokensTotal)} tok`);
      return;
    }

    requests += turnRequests;
    compressed += turnCompressed;
    images += turnImages;
    savedTokensTotal += turnSaved;
    persistTurnStats();

    if (turnCompressed <= 0) {
      show(ctx, `⚡ pxpipe v${meta.version} ON · nessuna compressione · req ${turnRequests} · sess ~${fmt(savedTokensTotal)} tok`);
      return;
    }

    const savingPct = turnBaseline > 0 ? (turnSaved / turnBaseline) * 100 : 0;
    show(
      ctx,
      `⚡ pxpipe v${meta.version} ✓ -${fmt(turnSaved)} tok (-${pct(savingPct)}%) · ${turnImages} img · ${fmt(turnBaseline)} → ${fmt(turnActual)} · sess ~${fmt(savedTokensTotal)} tok`,
    );
  });

  const argumentCompletions = (prefix) => {
    const items = [
      { value: "on", label: "on", description: "Attiva pxpipe" },
      { value: "off", label: "off", description: "Disattiva pxpipe" },
      { value: "status", label: "status", description: "Statistiche" },
      { value: "update", label: "update", description: "Aggiorna da GitHub" },
      { value: "autoupdate on", label: "autoupdate on", description: "Auto-update ON" },
      { value: "autoupdate off", label: "autoupdate off", description: "Auto-update OFF" },
      { value: "bug", label: "bug", description: "Segnala un bug" },
      { value: "uninstall", label: "uninstall", description: "Rimuove pxpipe completamente" },
      { value: "help", label: "help", description: "Aiuto" },
    ];
    const query = String(prefix || "").trim().toLowerCase();
    const filtered = items.filter((item) => item.value.startsWith(query));
    return filtered.length ? filtered : null;
  };

  pi.registerCommand("pxpipe", {
    description: "pxpipe: on, off, status, update, autoupdate, bug, help",
    getArgumentCompletions: argumentCompletions,
    handler: async (args, ctx) => {
      const cmd = String(args || "").trim().toLowerCase();
      loadEnabled();

      if (cmd === "on") {
        setEnabled(true);
        show(ctx, statusLine());
        return;
      }
      if (cmd === "off") {
        setEnabled(false);
        show(ctx, statusLine());
        return;
      }
      if (cmd === "status") {
        ctx.ui.notify(`${statusLine()}\n${updateStateText()}`, "info");
        return;
      }
      if (cmd === "update") {
        await runManualUpdate(ctx);
        return;
      }
      if (cmd === "autoupdate on") {
        writeState({ autoUpdate: true });
        ctx.ui.notify("pxpipe auto-update: ON", "info");
        return;
      }
      if (cmd === "autoupdate off") {
        writeState({ autoUpdate: false });
        ctx.ui.notify("pxpipe auto-update: OFF", "info");
        return;
      }
      if (cmd === "autoupdate" || cmd === "autoupdate status") {
        ctx.ui.notify(updateStateText(), "info");
        return;
      }
      if (cmd === "bug") {
        ctx.ui.notify(`Segnala bug qui: ${meta.bugUrl}`, "info");
        return;
      }
      if (cmd === "uninstall") {
        await runUninstall(ctx);
        return;
      }
      if (cmd === "" || cmd === "help") {
        ctx.ui.notify(helpText(), "info");
        return;
      }

      ctx.ui.notify(`Comando sconosciuto: ${cmd}\nUsa /pxpipe help`, "warning");
    },
  });

  pi.registerCommand("pxpipe-on", {
    description: "Attiva pxpipe e salva lo stato",
    handler: async (_args, ctx) => {
      setEnabled(true);
      show(ctx, statusLine());
    },
  });

  pi.registerCommand("pxpipe-off", {
    description: "Disattiva pxpipe e salva lo stato",
    handler: async (_args, ctx) => {
      setEnabled(false);
      show(ctx, statusLine());
    },
  });

  pi.registerCommand("pxpipe-status", {
    description: "Statistiche pxpipe",
    handler: async (_args, ctx) => {
      loadEnabled();
      ctx.ui.notify(`${statusLine()}\n${updateStateText()}`, "info");
    },
  });

  pi.registerCommand("pxpipe-update", {
    description: "Aggiorna pxpipe subito da GitHub",
    handler: async (_args, ctx) => runManualUpdate(ctx),
  });

  pi.registerCommand("pxpipe-autoupdate", {
    description: "Auto-update pxpipe: on, off, status",
    getArgumentCompletions: (prefix) => {
      const q = String(prefix || "").trim().toLowerCase();
      const values = ["on", "off", "status"];
      const matches = values.filter((v) => v.startsWith(q));
      return matches.length ? matches.map((v) => ({ value: v, label: v })) : null;
    },
    handler: async (args, ctx) => {
      const cmd = String(args || "").trim().toLowerCase();
      if (cmd === "on") {
        writeState({ autoUpdate: true });
        ctx.ui.notify("pxpipe auto-update: ON", "info");
        return;
      }
      if (cmd === "off") {
        writeState({ autoUpdate: false });
        ctx.ui.notify("pxpipe auto-update: OFF", "info");
        return;
      }
      ctx.ui.notify(updateStateText(), "info");
    },
  });

  pi.registerCommand("pxpipe-bug", {
    description: "Apri/link GitHub Issues per segnalare bug",
    handler: async (_args, ctx) => {
      ctx.ui.notify(`GitHub Issues: ${meta.bugUrl}`, "info");
    },
  });

  pi.registerCommand("pxpipe-uninstall", {
    description: "Rimuove completamente pxpipe da Prime-Agent",
    handler: async (_args, ctx) => runUninstall(ctx),
  });

  pi.registerCommand("pxpipe-help", {
    description: "Mostra tutti i comandi pxpipe",
    handler: async (_args, ctx) => ctx.ui.notify(helpText(), "info"),
  });
}

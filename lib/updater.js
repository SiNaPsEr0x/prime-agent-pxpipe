import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { autoUpdateEnabled, readState, writeState } from "./state.js";

const execFileAsync = promisify(execFile);
const FETCH_TIMEOUT_MS = 7000;
const INSTALL_TIMEOUT_MS = 120000;
const TRUSTED_GITHUB_REPOSITORY = "sinapser0x/prime-agent-pxpipe";

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    ...options,
  });
  return String(result.stdout || "").trim();
}

async function git(packageRoot, args, timeout = FETCH_TIMEOUT_MS) {
  return run("git", ["-C", packageRoot, ...args], {
    timeout,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
  });
}

function readPackageVersion(packageRoot) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
    return String(pkg.version || "unknown");
  } catch {
    return "unknown";
  }
}

function intervalMs(state) {
  const envHours = Number(process.env.PRIME_PXPIPE_UPDATE_INTERVAL_HOURS);
  const hours = Number.isFinite(envHours) && envHours > 0
    ? envHours
    : Math.max(1, Number(state.updateIntervalHours) || 24);
  return hours * 60 * 60 * 1000;
}

function dueForCheck(state, force) {
  if (force) return true;
  if (!state.lastUpdateCheckAt) return true;
  const last = Date.parse(state.lastUpdateCheckAt);
  if (!Number.isFinite(last)) return true;
  return Date.now() - last >= intervalMs(state);
}

async function resolveOwnedGitRoot(packageRoot) {
  try {
    const canonicalPackageRoot = await fs.promises.realpath(packageRoot);
    const topLevel = await git(canonicalPackageRoot, ["rev-parse", "--show-toplevel"], 2500);
    const canonicalTopLevel = await fs.promises.realpath(topLevel);
    return canonicalPackageRoot === canonicalTopLevel ? canonicalPackageRoot : null;
  } catch {
    return null;
  }
}

async function resolveTrackingRef(packageRoot) {
  let branch;
  try {
    branch = await git(packageRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"], 2500);
  } catch {
    return { branch: null, upstream: null, reason: "detached_or_pinned" };
  }

  if (!branch) return { branch: null, upstream: null, reason: "detached_or_pinned" };

  try {
    const upstream = await git(
      packageRoot,
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
      2500,
    );
    if (upstream.startsWith("origin/")) return { branch, upstream, reason: null };
    return { branch, upstream: null, reason: "untrusted_tracking_remote" };
  } catch {
    return { branch, upstream: null, reason: "no_tracking_branch" };
  }
}

function normalizeGitHubRepository(remoteUrl) {
  const normalized = String(remoteUrl || "")
    .trim()
    .replace(/^git\+/, "")
    .replace(/^git@github\.com:/i, "https://github.com/")
    .replace(/^git:github\.com\//i, "https://github.com/")
    .replace(/\.git\/?$/i, "")
    .replace(/\/$/, "");

  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") return null;
    return url.pathname.replace(/^\//, "").toLowerCase();
  } catch {
    return null;
  }
}

async function hasTrustedOrigin(packageRoot) {
  try {
    const configuredOrigin = await git(
      packageRoot,
      ["config", "--get", "remote.origin.url"],
      2500,
    );
    const effectiveOrigin = await git(packageRoot, ["remote", "get-url", "origin"], 2500);
    return (
      normalizeGitHubRepository(configuredOrigin) === TRUSTED_GITHUB_REPOSITORY
      && normalizeGitHubRepository(effectiveOrigin) === TRUSTED_GITHUB_REPOSITORY
    );
  } catch {
    return false;
  }
}

async function worktreeIsDirty(packageRoot) {
  return Boolean(await git(packageRoot, ["status", "--porcelain"], 2500));
}

function preserveInstalledDependencies(packageRoot) {
  const modulesPath = path.join(packageRoot, "node_modules");
  if (!fs.existsSync(modulesPath)) return null;

  const backupRoot = fs.mkdtempSync(path.join(packageRoot, ".git", "pxpipe-deps-"));
  fs.chmodSync(backupRoot, 0o700);
  const backupPath = path.join(backupRoot, "node_modules");
  fs.renameSync(modulesPath, backupPath);
  return { backupPath, backupRoot, modulesPath };
}

function discardDependencyBackup(backup) {
  if (backup) fs.rmSync(backup.backupRoot, { force: true, recursive: true });
}

function restoreInstalledDependencies(backup) {
  if (!backup) return;
  fs.rmSync(backup.modulesPath, { force: true, recursive: true });
  fs.renameSync(backup.backupPath, backup.modulesPath);
  fs.rmSync(backup.backupRoot, { force: true, recursive: true });
}

export async function checkAndApplyGitUpdate({ packageRoot, force = false } = {}) {
  const state = readState();

  if (!force && !autoUpdateEnabled(state)) {
    return { status: "disabled" };
  }

  if (!dueForCheck(state, force)) {
    return { status: "not_due" };
  }

  // Record the attempt first so an offline machine does not stall every startup.
  writeState({ lastUpdateCheckAt: new Date().toISOString() });

  const ownedGitRoot = await resolveOwnedGitRoot(packageRoot);
  if (!ownedGitRoot) {
    return {
      status: "unsupported",
      reason: "not_standalone_git_install",
      message: "Auto-update richiede un checkout Git dedicato al package.",
    };
  }

  if (!(await hasTrustedOrigin(ownedGitRoot))) {
    return {
      status: "unsupported",
      reason: "untrusted_origin",
      message: "Auto-update bloccato: origin non corrisponde al repository GitHub ufficiale.",
    };
  }

  if (await worktreeIsDirty(ownedGitRoot)) {
    return {
      status: "dirty",
      message: "Checkout con modifiche locali: aggiornamento annullato per non perdere dati.",
    };
  }

  const tracking = await resolveTrackingRef(ownedGitRoot);
  if (!tracking.upstream) {
    return {
      status: "unsupported",
      reason: tracking.reason || "no_tracking_branch",
      message: "Checkout Git pinnato/detached: auto-update rispettosamente disattivato.",
    };
  }

  const fromVersion = readPackageVersion(ownedGitRoot);
  let beforeSha;

  try {
    beforeSha = await git(ownedGitRoot, ["rev-parse", "HEAD"], 2500);
    await git(ownedGitRoot, ["fetch", "--quiet", "--prune", "origin"], FETCH_TIMEOUT_MS);

    const remoteSha = await git(ownedGitRoot, ["rev-parse", tracking.upstream], 2500);
    if (!remoteSha || remoteSha === beforeSha) {
      return { status: "current", version: fromVersion };
    }

    // Never rewrite/diverge user checkouts. Only accept a strict fast-forward.
    try {
      await git(ownedGitRoot, ["merge-base", "--is-ancestor", beforeSha, remoteSha], 2500);
    } catch {
      return {
        status: "diverged",
        message: "Il checkout locale diverge da GitHub; aggiornamento automatico saltato.",
      };
    }

    const depsChanged = Boolean(
      await git(
        ownedGitRoot,
        ["diff", "--name-only", beforeSha, remoteSha, "--", "package.json", "package-lock.json", "npm-shrinkwrap.json"],
        2500,
      ),
    );

    // Fetch and comparison can take time: do not merge over edits made meanwhile.
    if (await worktreeIsDirty(ownedGitRoot)) {
      return {
        status: "dirty",
        message: "Checkout modificato durante il controllo: aggiornamento annullato.",
      };
    }

    await git(ownedGitRoot, ["merge", "--ff-only", "--quiet", tracking.upstream], FETCH_TIMEOUT_MS);

    if (depsChanged) {
      let dependencyBackup = null;
      try {
        const lockFile = path.join(ownedGitRoot, "package-lock.json");
        if (!fs.existsSync(lockFile)) {
          throw new Error("package-lock.json mancante: installazione riproducibile impossibile");
        }

        dependencyBackup = preserveInstalledDependencies(ownedGitRoot);
        await run(
          process.env.npm_execpath ? process.execPath : "npm",
          process.env.npm_execpath
            ? [process.env.npm_execpath, "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"]
            : ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"],
          {
            cwd: ownedGitRoot,
            timeout: INSTALL_TIMEOUT_MS,
            env: process.env,
          },
        );
        discardDependencyBackup(dependencyBackup);
      } catch (error) {
        let rollbackError = null;
        try {
          restoreInstalledDependencies(dependencyBackup);
          if (await worktreeIsDirty(ownedGitRoot)) {
            // Move only the ref: never erase edits made while npm was running.
            await git(ownedGitRoot, ["update-ref", "HEAD", beforeSha, remoteSha], 5000);
          } else {
            await git(ownedGitRoot, ["reset", "--hard", beforeSha], 5000);
          }
        } catch (caughtRollbackError) {
          rollbackError = caughtRollbackError;
        }
        return {
          status: "error",
          message: [
            `Dipendenze non aggiornate: ${error instanceof Error ? error.message : String(error)}`,
            rollbackError
              ? `Ripristino non riuscito: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
              : null,
          ].filter(Boolean).join("; "),
        };
      }
    }

    const toVersion = readPackageVersion(ownedGitRoot);
    writeState({
      lastUpdateAt: new Date().toISOString(),
      lastUpdateVersion: toVersion,
    });

    return {
      status: "updated",
      fromVersion,
      toVersion,
      fromSha: beforeSha,
      toSha: remoteSha,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

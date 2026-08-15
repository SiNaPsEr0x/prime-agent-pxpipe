import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const STATE_VERSION = 2;

export function getStateFile() {
  return process.env.PRIME_PXPIPE_STATE_FILE?.trim()
    || path.join(os.homedir(), ".prime", "agent", "pxpipe-state.json");
}

export function defaults() {
  return {
    version: STATE_VERSION,
    enabled: true,
    autoUpdate: true,
    updateIntervalHours: 24,
    lastUpdateCheckAt: null,
    lastUpdateAt: null,
    lastUpdateVersion: null,
  };
}

export function readState() {
  const file = getStateFile();
  const base = defaults();

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      ...base,
      ...parsed,
      version: STATE_VERSION,
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : base.enabled,
      autoUpdate: typeof parsed.autoUpdate === "boolean" ? parsed.autoUpdate : base.autoUpdate,
      updateIntervalHours: Number.isFinite(Number(parsed.updateIntervalHours))
        ? Math.max(1, Number(parsed.updateIntervalHours))
        : base.updateIntervalHours,
    };
  } catch {
    return base;
  }
}

export function writeState(patch = {}) {
  const file = getStateFile();
  const next = {
    ...readState(),
    ...patch,
    version: STATE_VERSION,
  };

  fs.mkdirSync(path.dirname(file), { recursive: true });

  const tmp = `${file}.tmp-${process.pid}-${randomBytes(12).toString("hex")}`;
  let descriptor;

  try {
    descriptor = fs.openSync(tmp, "wx", 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(tmp, file);
    fs.chmodSync(file, 0o600);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(tmp, { force: true });
    throw error;
  }

  return next;
}

export function autoUpdateEnabled(state = readState()) {
  const env = process.env.PRIME_PXPIPE_AUTO_UPDATE?.trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(env)) return false;
  if (["1", "true", "on", "yes"].includes(env)) return true;
  return state.autoUpdate !== false;
}

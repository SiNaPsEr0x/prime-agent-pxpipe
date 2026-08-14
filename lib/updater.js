import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { autoUpdateEnabled, readState, writeState } from "./state.js";

const execFileAsync = promisify(execFile);
const FETCH_TIMEOUT_MS = 7000;
const INSTALL_TIMEOUT_MS = 120000;

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

async function hasGitRepo(packageRoot) {
  try {
    return (await git(packageRoot, ["rev-parse", "--is-inside-work-tree"], 2500)) === "true";
  } catch {
    return false;
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
    if (upstream) return { branch, upstream, reason: null };
  } catch {
    // Fall back to origin/<current branch> for ordinary GitHub clones.
  }

  return { branch, upstream: `origin/${branch}`, reason: null };
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

  if (!(await hasGitRepo(packageRoot))) {
    return {
      status: "unsupported",
      reason: "not_git_install",
      message: "Auto-update richiede un'installazione Git non pinnata.",
    };
  }

  const tracking = await resolveTrackingRef(packageRoot);
  if (!tracking.upstream) {
    return {
      status: "unsupported",
      reason: tracking.reason || "no_tracking_branch",
      message: "Checkout Git pinnato/detached: auto-update rispettosamente disattivato.",
    };
  }

  const fromVersion = readPackageVersion(packageRoot);
  let beforeSha;

  try {
    beforeSha = await git(packageRoot, ["rev-parse", "HEAD"], 2500);
    await git(packageRoot, ["fetch", "--quiet", "--prune", "origin"], FETCH_TIMEOUT_MS);

    const remoteSha = await git(packageRoot, ["rev-parse", tracking.upstream], 2500);
    if (!remoteSha || remoteSha === beforeSha) {
      return { status: "current", version: fromVersion };
    }

    // Never rewrite/diverge user checkouts. Only accept a strict fast-forward.
    try {
      await git(packageRoot, ["merge-base", "--is-ancestor", beforeSha, remoteSha], 2500);
    } catch {
      return {
        status: "diverged",
        message: "Il checkout locale diverge da GitHub; aggiornamento automatico saltato.",
      };
    }

    const depsChanged = Boolean(
      await git(
        packageRoot,
        ["diff", "--name-only", beforeSha, remoteSha, "--", "package.json", "package-lock.json", "npm-shrinkwrap.json"],
        2500,
      ),
    );

    await git(packageRoot, ["merge", "--ff-only", "--quiet", tracking.upstream], FETCH_TIMEOUT_MS);

    if (depsChanged) {
      try {
        await run(
          process.env.npm_execpath ? process.execPath : "npm",
          process.env.npm_execpath
            ? [process.env.npm_execpath, "install", "--omit=dev", "--no-audit", "--no-fund"]
            : ["install", "--omit=dev", "--no-audit", "--no-fund"],
          {
            cwd: packageRoot,
            timeout: INSTALL_TIMEOUT_MS,
            env: process.env,
          },
        );
      } catch (error) {
        // Roll back code if dependency installation fails, preserving a working package.
        try {
          await git(packageRoot, ["reset", "--hard", beforeSha], 5000);
        } catch {
          // Best effort only.
        }
        return {
          status: "error",
          message: `Dipendenze non aggiornate: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    const toVersion = readPackageVersion(packageRoot);
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

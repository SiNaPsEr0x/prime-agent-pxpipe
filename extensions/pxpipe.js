import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkAndApplyGitUpdate } from "../lib/updater.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Thin bootstrap loader.
 *
 * For unpinned GitHub installs, it can fast-forward the package before importing
 * the runtime. That means most bug fixes take effect in the same Prime-Agent
 * startup without requiring a second restart.
 */
export default async function primeAgentPxpipe(pi) {
  let startupUpdate = { status: "not_due" };

  try {
    startupUpdate = await checkAndApplyGitUpdate({ packageRoot, force: false });
  } catch {
    // Fail-open: updates must never prevent the extension from loading.
  }

  const runtimeUrl = pathToFileURL(path.join(packageRoot, "lib", "runtime.js"));
  runtimeUrl.searchParams.set("boot", `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const { default: loadRuntime } = await import(runtimeUrl.href);
  return loadRuntime(pi, { packageRoot, startupUpdate });
}

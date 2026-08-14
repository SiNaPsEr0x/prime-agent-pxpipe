import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const UNINSTALL_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail
package_root="$1"
state_file="$2"
helper_dir="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd)"
sleep 1
prime-agent shutdown --force >/dev/null 2>&1 || true
prime-agent package remove "$package_root" >/dev/null 2>&1 || true
rm -f -- "$state_file" >/dev/null 2>&1 || true
rm -rf -- "$package_root" >/dev/null 2>&1 || true
rm -rf -- "$helper_dir" >/dev/null 2>&1 || true
`;

function verifyPrivateDirectory(directory) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory()) {
    throw new Error("La directory helper di uninstall non è valida.");
  }
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
    throw new Error("La directory helper di uninstall non appartiene all'utente corrente.");
  }
}

export function createUninstallHelper(tmpRoot = os.tmpdir()) {
  const helperDir = fs.mkdtempSync(path.join(tmpRoot, "prime-agent-pxpipe-uninstall-"));

  try {
    fs.chmodSync(helperDir, 0o700);
    verifyPrivateDirectory(helperDir);

    const scriptPath = path.join(helperDir, "uninstall.sh");
    fs.writeFileSync(scriptPath, UNINSTALL_SCRIPT, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o700,
    });

    const scriptStat = fs.lstatSync(scriptPath);
    if (!scriptStat.isFile()) {
      throw new Error("Lo script helper di uninstall non è un file regolare.");
    }
    if (typeof process.getuid === "function" && scriptStat.uid !== process.getuid()) {
      throw new Error("Lo script helper di uninstall non appartiene all'utente corrente.");
    }

    return { helperDir, scriptPath };
  } catch (error) {
    fs.rmSync(helperDir, { force: true, recursive: true });
    throw error;
  }
}

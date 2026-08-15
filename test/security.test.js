import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkAndApplyGitUpdate } from "../lib/updater.js";
import { createUninstallHelper } from "../lib/uninstall.js";
import { writeState } from "../lib/state.js";

const OFFICIAL_REMOTE = "https://github.com/SiNaPsEr0x/prime-agent-pxpipe.git";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
}

function configureAuthor(repository) {
  git(repository, "config", "user.email", "security-test@example.invalid");
  git(repository, "config", "user.name", "Security Test");
}

test("updater rejects a package nested in an enclosing repository", async (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "pxpipe-updater-nested-"));
  t.after(() => {
    delete process.env.PRIME_PXPIPE_STATE_FILE;
    fs.rmSync(fixture, { force: true, recursive: true });
  });

  git(fixture, "init", "--initial-branch=main");
  configureAuthor(fixture);
  const packageRoot = path.join(fixture, "packages", "prime-agent-pxpipe");
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(path.join(packageRoot, "package.json"), '{"version":"1.0.0"}\n');
  git(fixture, "add", ".");
  git(fixture, "commit", "-m", "fixture");

  process.env.PRIME_PXPIPE_STATE_FILE = path.join(fixture, "state.json");
  const result = await checkAndApplyGitUpdate({ packageRoot, force: true });

  assert.equal(result.status, "unsupported");
  assert.equal(result.reason, "not_standalone_git_install");
});

test("updater rejects an origin redirected through insteadOf", async (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "pxpipe-updater-standalone-"));
  t.after(() => {
    delete process.env.PRIME_PXPIPE_STATE_FILE;
    fs.rmSync(fixture, { force: true, recursive: true });
  });

  const remote = path.join(fixture, "remote.git");
  const packageRoot = path.join(fixture, "package");
  const publisher = path.join(fixture, "publisher");
  fs.mkdirSync(packageRoot);
  git(packageRoot, "init", "--initial-branch=main");
  configureAuthor(packageRoot);
  fs.writeFileSync(path.join(packageRoot, "package.json"), '{"version":"1.0.0"}\n');
  fs.writeFileSync(path.join(packageRoot, "README.md"), "initial\n");
  git(packageRoot, "add", ".");
  git(packageRoot, "commit", "-m", "initial");
  git(fixture, "init", "--bare", "--initial-branch=main", remote);
  git(packageRoot, "remote", "add", "origin", remote);
  git(packageRoot, "push", "--set-upstream", "origin", "main");

  git(fixture, "clone", remote, publisher);
  configureAuthor(publisher);
  fs.writeFileSync(path.join(publisher, "README.md"), "updated\n");
  git(publisher, "add", "README.md");
  git(publisher, "commit", "-m", "update");
  git(publisher, "push", "origin", "main");

  git(packageRoot, "remote", "set-url", "origin", OFFICIAL_REMOTE);
  git(packageRoot, "config", `url.file://${remote}.insteadOf`, OFFICIAL_REMOTE);

  process.env.PRIME_PXPIPE_STATE_FILE = path.join(fixture, "state.json");
  const result = await checkAndApplyGitUpdate({ packageRoot, force: true });

  assert.equal(result.status, "unsupported");
  assert.equal(result.reason, "untrusted_origin");
  assert.equal(
    fs.readFileSync(path.join(packageRoot, "README.md"), "utf8").replaceAll("\r\n", "\n"),
    "initial\n",
  );
});

test("updater rejects dirty checkouts without losing local changes", async (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "pxpipe-updater-dirty-"));
  t.after(() => {
    delete process.env.PRIME_PXPIPE_STATE_FILE;
    fs.rmSync(fixture, { force: true, recursive: true });
  });

  const packageRoot = path.join(fixture, "package");
  fs.mkdirSync(packageRoot);
  git(packageRoot, "init", "--initial-branch=main");
  configureAuthor(packageRoot);
  fs.writeFileSync(path.join(packageRoot, "package.json"), '{"version":"1.0.0"}\n');
  fs.writeFileSync(path.join(packageRoot, "README.md"), "initial\n");
  git(packageRoot, "add", ".");
  git(packageRoot, "commit", "-m", "initial");
  git(packageRoot, "remote", "add", "origin", OFFICIAL_REMOTE);
  git(packageRoot, "config", "branch.main.remote", "origin");
  git(packageRoot, "config", "branch.main.merge", "refs/heads/main");
  fs.writeFileSync(path.join(packageRoot, "README.md"), "local change\n");

  process.env.PRIME_PXPIPE_STATE_FILE = path.join(fixture, "state.json");
  const result = await checkAndApplyGitUpdate({ packageRoot, force: true });

  assert.equal(result.status, "dirty");
  assert.equal(fs.readFileSync(path.join(packageRoot, "README.md"), "utf8"), "local change\n");
});

test("updater treats untracked files as local checkout changes", async (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "pxpipe-updater-untracked-"));
  t.after(() => {
    delete process.env.PRIME_PXPIPE_STATE_FILE;
    fs.rmSync(fixture, { force: true, recursive: true });
  });

  const packageRoot = path.join(fixture, "package");
  fs.mkdirSync(packageRoot);
  git(packageRoot, "init", "--initial-branch=main");
  configureAuthor(packageRoot);
  fs.writeFileSync(path.join(packageRoot, "package.json"), '{"version":"1.0.0"}\n');
  git(packageRoot, "add", "package.json");
  git(packageRoot, "commit", "-m", "initial");
  git(packageRoot, "remote", "add", "origin", OFFICIAL_REMOTE);
  git(packageRoot, "config", "branch.main.remote", "origin");
  git(packageRoot, "config", "branch.main.merge", "refs/heads/main");
  const localFile = path.join(packageRoot, "local-notes.txt");
  fs.writeFileSync(localFile, "do not delete\n");

  process.env.PRIME_PXPIPE_STATE_FILE = path.join(fixture, "state.json");
  const result = await checkAndApplyGitUpdate({ packageRoot, force: true });

  assert.equal(result.status, "dirty");
  assert.equal(fs.readFileSync(localFile, "utf8"), "do not delete\n");
});

test("state writes use private files and do not follow a predictable symlink", (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "pxpipe-state-test-"));
  const stateFile = path.join(fixture, "state.json");
  const target = path.join(fixture, "target.txt");
  const legacyTemporary = `${stateFile}.tmp-${process.pid}`;
  t.after(() => {
    delete process.env.PRIME_PXPIPE_STATE_FILE;
    fs.rmSync(fixture, { force: true, recursive: true });
  });

  fs.writeFileSync(target, "untouched\n");
  fs.symlinkSync(target, legacyTemporary);
  process.env.PRIME_PXPIPE_STATE_FILE = stateFile;
  writeState({ enabled: false });

  assert.equal(fs.readFileSync(target, "utf8"), "untouched\n");
  assert.equal(fs.lstatSync(legacyTemporary).isSymbolicLink(), true);
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(stateFile).mode & 0o777, 0o600);
  }
});

test("uninstall helper is exclusive, private, and contains no target paths", (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "pxpipe-uninstall-test-"));
  t.after(() => fs.rmSync(fixture, { force: true, recursive: true }));

  const legacyPath = path.join(
    fixture,
    `prime-agent-pxpipe-uninstall-${Date.now()}-${process.pid}.sh`,
  );
  fs.writeFileSync(legacyPath, "attacker-controlled");
  const first = createUninstallHelper(fixture);
  const second = createUninstallHelper(fixture);
  const script = fs.readFileSync(first.scriptPath, "utf8");

  assert.notEqual(first.scriptPath, legacyPath);
  assert.equal(fs.readFileSync(legacyPath, "utf8"), "attacker-controlled");
  assert.notEqual(first.helperDir, second.helperDir);
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(first.helperDir).mode & 0o777, 0o700);
    assert.equal(fs.statSync(first.scriptPath).mode & 0o777, 0o700);
  }
  assert.match(script, /package_root="\$1"/);
  assert.match(script, /state_file="\$2"/);
  assert.equal(script.includes(fixture), false);
  assert.throws(
    () => fs.writeFileSync(first.scriptPath, "replacement", { flag: "wx" }),
    { code: "EEXIST" },
  );
});

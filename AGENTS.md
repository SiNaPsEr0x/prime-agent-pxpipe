# Development guidelines

- Keep provider-request transformation fail-open; maintenance commands must report explicit failures.
- Never update a dirty, divergent, detached, nested, or untrusted Git checkout.
- Accept automatic updates only from the official GitHub `origin` and an `origin/*` upstream.
- Keep runtime dependencies pinned in both `package.json` and `package-lock.json`; use `npm ci`.
- Write persistent state atomically with private permissions and exclusive temporary files.
- Add regression tests for every security boundary or updater state.
- Keep `README.md` and `README_IT.md` synchronized when behavior or commands change.
- Run `npm test`, `npm audit --omit=dev`, and `git diff --check` before committing.

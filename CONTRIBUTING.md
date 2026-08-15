# Contributing

Thanks for improving **prime-agent-pxpipe**.

## Development

```bash
npm ci --omit=dev --ignore-scripts
npm test
```

Local install into Prime-Agent:

```bash
./install.sh
```

Local removal:

```bash
./uninstall.sh
```

## Design principles

- Keep the integration **fail-open**.
- Never block Prime-Agent inference because pxpipe or updater failed.
- Keep state persistent but easy to inspect.
- Prefer simple user-facing commands and clear UI feedback.

## Bug reports

Open a GitHub Issue and include:

1. Prime-Agent version
2. OS / WSL / distro
3. model id
4. `/pxpipe-status` output
5. reproduction steps
6. expected behavior
7. actual behavior

Do **not** post API keys, OAuth tokens, secrets, private prompts, or sensitive tool output.

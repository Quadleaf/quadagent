# quad-agent

Version-controlled global [Claude Code](https://code.claude.com/docs) configuration for this machine —
the pieces of `~/.claude/` that are hand-authored and worth keeping in git
(memory, skills, hooks, MCP config), separated from machine-local runtime state
(sessions, history, caches) which is never committed.

## What lives here

| Path | Mirrors | Purpose |
|------|---------|---------|
| `CLAUDE.md` | `~/.claude/CLAUDE.md` | Global memory / cross-project preferences |
| `skills/product-marketing-cut/` | `~/.claude/skills/product-marketing-cut` | Skill: product marketing videos and screenshots from a live web app (Playwright frame-exact capture + Revideo edit) |
| `AGENTS.md` | — | Symlink → `CLAUDE.md` so other agent tools that read `AGENTS.md` get the same instructions |

_More files (skills, hooks, sanitized `settings.json` / `.mcp.json`) will be added incrementally._

## Source of truth

The **repo is canonical**. The live files under `~/.claude/` are intended to be
**symlinks pointing into this repo**, so editing in either place edits the same
file and the two never drift. See [Install](#install).

## Secrets

Nothing secret is committed. Files that contain credentials are handled two ways:

- **`.mcp.json`** — Claude Code
  [expands `${VAR}` / `${VAR:-default}`](https://code.claude.com/docs/en/mcp) in
  `command`, `args`, `env`, `url`, and `headers`, so secrets are referenced as
  env vars and the committed file stays functional. Export the vars (see
  `.env.example`) before launching Claude Code.
- **`settings.json`** — does *not* support env-var expansion, so any secret
  literals are stripped from the committed copy.

Real secrets live only in the (gitignored) `.env` and in your live `~/.claude/`.

## Install

Symlink this repo's files into `~/.claude/`, making the repo canonical.

On Linux/macOS:

```bash
./install.sh              # back up any existing copies, then symlink
./install.sh --dry-run    # preview every action without changing anything
```

On Windows, use the PowerShell port instead — Git Bash's `ln -s` silently
creates *copies*, not symlinks, so `install.sh` cannot deliver the
"edit either place, never drift" guarantee there:

```powershell
.\install.ps1             # back up any existing copies, then symlink
.\install.ps1 -DryRun     # preview every action without changing anything
```

Windows symlink creation requires either **Developer Mode** (Settings >
System > For developers) or an elevated shell. `install.ps1` checks this up
front and aborts before touching anything if neither is available.

For each file in the manifest (`MIRRORS` in `install.sh`, `$Mirrors` in
`install.ps1` — keep the two lists in sync), the script replaces the live copy
under `~/.claude/` with a symlink into this repo. Anything already present
that is *not* already the correct symlink is first moved to
`~/.claude/.quad-agent-backups/<timestamp>/`, so nothing is lost. Both scripts
are idempotent — re-running reports `OK ... already linked` and makes no
changes.

The target config dir can be overridden with `CLAUDE_CONFIG_DIR` (default
`~/.claude`). As skills, hooks, and sanitized `settings.json` / `.mcp.json` get
committed, add their repo-relative paths to both manifests.

## Layout note

Some project-specific config (e.g. Bluetail MCP servers, project allow-rules)
currently lives in the *global* `~/.claude/` scope. Per Claude Code
[best practices](https://code.claude.com/docs/en/settings) that config ideally
belongs in each project's `.claude/` scope. Migrating it out of global is a
deferred cleanup, tracked separately from this repo's initial setup.

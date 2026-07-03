# Global preferences

## Git in multi-repo workspaces
Prefer `git -C <path> <command>` over `cd <path> && git <command>`.
The `-C` form is a single, non-chained command that matches permission
allow-rules cleanly and keeps the shell's working directory unchanged —
chained `cd && git` tends to trigger permission prompts. This is a
preference, not a hard rule: use `cd` when it's genuinely the right tool.

## Prefer built-in tools over Bash for file inspection
Default to the dedicated tools instead of shelling out — they never
trigger permission prompts and give cleaner output:

- Searching code / symbols → **Grep** tool, not `grep`/`rg` in Bash
  (it supports `-n`, `-r`, globs, `output_mode`, `head_limit`).
- Reading or excerpting a file → **Read** tool (with `offset`/`limit`),
  not `cat`/`head`/`tail`/`sed -n`.
- Finding files by name/path → **Glob** tool, not `find -name`.

Especially avoid hand-rolled Bash one-liners that chain these with
`;`, command substitution `$(...)`, or temp variables for code
exploration — those almost always prompt and are exactly what Grep/Read/
Glob do natively. Reach for Bash only when the shell itself is the point:
real pipelines (`| sort | uniq -c`), running programs, git, builds, etc.
This is a preference, not a hard rule.

### When the Grep/Glob tools aren't available, or you must use Bash
Some sessions don't expose the Grep/Glob tools. In that case use a single
read-only command — never `find … -exec`:

- **Never use `find … -exec`** — it runs an arbitrary command per match, so
  it can't be auto-allowed (a rule covering it would also cover
  `find … -exec rm`). It always prompts.
- **Find files by content:** `grep -rl --include="*.tsx" PATTERN PATH`
  (or `rg -l -g '*.tsx' PATTERN PATH`). `grep -r` / `rg` are read-only and
  auto-allowed, so no prompt.
- **Find files by name:** `rg --files -g '*.tsx' PATH` (or `ls`/`grep`),
  not `find -name`.
- Keep it to one command — no `-exec`, no `$(...)`, no `;` chains.

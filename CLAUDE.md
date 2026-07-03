# Global preferences

Cross-project defaults for how I work. Preferences, not hard rules - use judgment.

## Engineering approach
- Don't take technical shortcuts to save time. Implement the correct, complete
  solution rather than a quick hack that papers over the problem. If a shortcut
  is genuinely warranted, call it out and explain the tradeoff instead of taking
  it silently.

## Writing style
- Don't use em dashes. Use a regular dash (-) instead.

## Shell & file inspection
- Use `git -C <path> <cmd>` instead of `cd <path> && git ...` - one command, and
  it keeps the session's working directory stable across calls.
- Prefer the built-in **Read / Grep / Glob** tools over `cat`/`grep`/`find` for
  inspecting code - cleaner structured output, and fewer permission prompts. Reach
  for Bash when the shell is the point: pipelines, running programs, git, builds.
- Avoid `find ... -exec` - it can't be safely allow-listed, so it always prompts.
  Find by content with `grep -rl PATTERN PATH` (or `rg -l`), by name with
  `rg --files` / `ls`; keep it to one read-only command.

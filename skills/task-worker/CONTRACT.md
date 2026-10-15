# Tasks control plane - folder contract

The shared, on-disk protocol between one **main session** (supervising) and N **worker
sessions** (each working a single ticket). The filesystem is the only channel. There is no
daemon, no socket, no shared memory.

This file is the authoritative schema. `task-worker` writes it; `task-board` reads it.

---

## Why the filesystem

Durability. A worker session can die without warning - killed for memory pressure, closed
terminal, crashed MCP. In-process coordination (agent teams, long-lived subagents) has been
tried on this machine and abandoned for exactly that reason. State written to disk survives the
session that wrote it, which is the whole point.

## Root resolution

In order:

1. `$QUADAGENT_TASKS_DIR` if set.
2. The nearest `Tasks/` directory found by walking **up** from the session's working directory.
3. `<workspace>/Tasks/` where `<workspace>` is the directory containing the repos (for Bluetail,
   the parent of `_solution/`). Create it if missing.

The control plane is **per workspace**, not per machine - tickets belong to a codebase. The
skills are global (they live in quadagent); the data is local.

**Coexistence:** a `Tasks/` directory may already hold flat planning files (e.g. `MOB-001-*.md`
plus a `README.md` index). Control-plane entries are always **directories** named for the
ticket, so the two never collide. Never modify files you did not create.

## Layout

```
Tasks/
  BT-10298/
    state.json      # machine-readable. WORKER writes. Main session never writes.
    notes.md        # human narrative, append-only. WORKER writes.
    inbox.md        # MAIN session appends. Worker reads and marks consumed.
  BT-10237/
    ...
```

### Single-writer rule

Exactly one process writes each file. The worker owns `state.json` and `notes.md`; the main
session owns `inbox.md`. No locking is needed because no file has two writers. Do not relax
this - concurrent appends from multiple Claude sessions will interleave and corrupt.

---

## `state.json`

```json
{
  "ticket": "BT-10298",
  "title": "Fix document preview and citation errors in compliance section",
  "work_status": "In Progress",
  "session_state": "active",
  "activity": "reproducing the citation error on local",
  "blocked_reason": null,
  "question": null,
  "repo": "app",
  "worktree": "/Users/patrickdavis/Bluetail/repos/app/worktrees/BT-10298",
  "branch": "BT-10298-citation-preview-errors",
  "pid": 53717,
  "started": "2026-10-15T15:02:11Z",
  "heartbeat": "2026-10-15T15:48:03Z",
  "inbox_consumed_through": 2
}
```

| Field | Meaning |
|---|---|
| `ticket` | Jira key. Must match the folder name. |
| `title` | Ticket summary, for the board. |
| `work_status` | Where the *work* stands. Vocabulary below. |
| `session_state` | Where the *session* stands. Vocabulary below. Orthogonal to `work_status`. |
| `activity` | One short line, present tense, what is happening right now. |
| `blocked_reason` | Why, when `work_status` is `Blocked`. Else `null`. |
| `question` | The exact question, when `session_state` is `awaiting-input`. Else `null`. |
| `repo`, `worktree`, `branch` | What the kickoff produced, so the main session can inspect without asking. |
| `pid` | Best-effort owning process id, for liveness. See caveat below. |
| `started` | ISO-8601 UTC, first write. |
| `heartbeat` | ISO-8601 UTC, updated on every meaningful step. |
| `inbox_consumed_through` | Index of the last inbox message the worker has read and acted on. |

### `work_status` - matches the existing `Tasks/README.md` vocabulary

`Todo` | `In Progress` | `Blocked` | `In Review` | `Done` | `Won't Do`

### `session_state`

| Value | Means |
|---|---|
| `active` | The session is working. Heartbeat should be recent. |
| `awaiting-input` | Deliberately paused, waiting on a human answer. `question` is set. |
| `idle` | Kickoff done, nothing in flight, session still open. |
| `finished` | Work concluded and the session is done with this ticket. |

---

## Liveness, and an honest limitation

**A Claude Code session only executes tool calls while it is processing a turn.** It cannot
emit a heartbeat while idle, while waiting for the user to type, or while blocked on a
permission prompt. A stale heartbeat therefore means *"not recently active"* - it does **not**
reliably mean *"dead"*.

This is the single most important thing to get right, because a naive board reports a worker
patiently waiting for its user as a crashed session.

The rule that resolves it: **a worker stamps `session_state` before it stops working**, not
after. Going quiet to ask a question means writing `awaiting-input` *first*. Then:

| Observed | Interpretation |
|---|---|
| heartbeat fresh (< 5 min) | genuinely active |
| heartbeat stale, `session_state` = `awaiting-input` / `idle` / `finished` | expected, not a problem |
| heartbeat stale (> 30 min), `session_state` = `active` | **suspect** - the session likely died mid-step |
| `pid` set and `kill -0 <pid>` fails | strong evidence it is gone |

`pid` is best-effort: it records the parent of the shell the worker ran, which is normally the
session process, but this is not guaranteed across hosts and should corroborate the heartbeat,
never override it.

---

## `inbox.md`

The main session appends; the worker consumes. Numbered so consumption is unambiguous.

```markdown
## 1 - 2026-10-15T15:10:02Z
Use project 158 / section 687 for the repro. Do not remove AR from more than one item.

## 2 - 2026-10-15T15:44:51Z
Skip the superadmin half for now, :3002 is down.
```

The worker reads messages with an index greater than `inbox_consumed_through`, acts on them,
then advances the counter in `state.json`. Messages are instructions from the human operator
and are to be followed; they are the one trusted input channel in this protocol.

## `notes.md`

Append-only narrative for a human catching up: what was tried, what was found, what was
decided. Not a transcript. The board never parses it - it exists so that reading one folder
tells you the story without reconstructing it from Jira.

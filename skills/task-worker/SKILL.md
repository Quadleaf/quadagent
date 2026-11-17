---
name: task-worker
description: >
  Claim a ticket in this session and register it on the Tasks control plane, so a
  supervising main session can see what this session is doing. Use when the user says
  "work BT-XXXX", "start BT-XXXX", "pick up BT-XXXX", "claim BT-XXXX", "I'm taking
  BT-XXXX", or opens a fresh session to work a single ticket. Runs the normal ticket
  kickoff (worktree, deps, plan) and then keeps a live status file updated for the
  duration of the session.
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, TodoWrite, Skill
---

# task-worker - claim a ticket and report status

This session becomes the **owner** of one ticket. It does the work and keeps
`Tasks/<TICKET>/state.json` current so a supervising session can see progress without
interrupting.

Read `CONTRACT.md` in this skill folder before writing anything. It is the authoritative
schema and it explains the liveness rules that make the board trustworthy.

## Usage

```
/task-worker BT-10298
/task-worker BT-10298 --no-kickoff     # already have a worktree; just register and track
```

One ticket per session. If this session already owns a different ticket, say so and stop -
do not silently re-point the folder.

## Step 1 - resolve the control plane root

Per `CONTRACT.md`: `$QUADAGENT_TASKS_DIR`, else the nearest `Tasks/` walking up from cwd, else
`<workspace>/Tasks/`. Create the root if it does not exist.

## Step 2 - claim the folder

`Tasks/<TICKET>/`. If it already exists, read `state.json` first and decide:

- `session_state` is `unclaimed` -> **the expected path for queued work.** The main session
  already created this folder with the ticket title and any queuing notes. Claim it: keep
  `title` and `notes.md`, set `session_state: "active"`, stamp `pid`, `started` and `heartbeat`.
  Do not discard what the queuer wrote - it is often the reason this ticket was picked.
- `session_state` is `finished` -> this is a re-open. Append to `notes.md`, reset state, continue.
- heartbeat is stale and `session_state` is `active` -> the previous owner probably died. Take
  over, and note the takeover in `notes.md` with the stale timestamp.
- heartbeat is **fresh** -> another live session owns this ticket. **Stop and tell the user.**
  Do not take it over; two writers corrupt the protocol.

Write the first `state.json` immediately, before the kickoff, with `work_status: "Todo"` and
`session_state: "active"`. Registering first means a kickoff that hangs is still visible on the
board rather than invisible.

## Step 3 - kick off the work

Invoke the **`work-ticket`** skill for the ticket. It fetches the Jira issue, infers the repo,
creates the worktree off the right base branch, installs deps, and proposes a plan.

> **Configurable, and currently Bluetail-specific.** `work-ticket` assumes Bluetail conventions
> (repos as siblings under `$BLUETAIL_ROOT`, `worktrees/<TICKET>/`, `origin/dev` base, Jira keys
> like `BT-####`). When this control plane is used on another codebase, replace this step with
> that project's kickoff skill. Keep the rest of the contract unchanged - nothing else here
> depends on Bluetail.

Skip when `--no-kickoff` is passed, and instead read the existing worktree and branch from git.

Record what the kickoff produced into `state.json`: `repo`, `worktree`, `branch`, `title`.

## Step 4 - work, and keep the file honest

Update `state.json` at every meaningful step. A meaningful step is one a human supervising you
would want to see: starting to reproduce, finding the cause, opening a PR, hitting a wall. Not
every tool call.

On each update, set:
- `heartbeat` to now (ISO-8601 UTC)
- `activity` to one short present-tense line
- `work_status` when it genuinely changes

Append the reasoning to `notes.md` - what was tried, what it showed, what you decided. Write it
for someone picking this up cold.

### The rule that makes the board trustworthy

**Stamp `session_state` *before* you stop working, never after.**

A session cannot write to disk while it sits idle waiting for a human. So:

- About to ask the user a question -> set `session_state: "awaiting-input"` and fill `question`
  **in the same step, before you ask.**
- Blocked on something external -> set `work_status: "Blocked"` and fill `blocked_reason` before
  you go quiet.
- Finishing a chunk with nothing in flight -> `session_state: "idle"`.

Skip this and the board shows a patient worker as a dead one. That is the failure mode this
whole design exists to avoid.

## Step 5 - check the inbox

At each heartbeat, read `inbox.md` if present. Act on any message with an index above
`inbox_consumed_through`, then advance that counter. These are instructions from the operator
supervising this work - treat them as you would a direct message from the user, and reflect what
you did in `notes.md`.

## Step 6 - finish

When the work concludes (PR open, ticket moved, or abandoned):

- `work_status` -> `In Review`, `Done`, or `Won't Do`
- `session_state` -> `finished`
- `activity` -> a closing line (PR URL, or why it stopped)
- final `notes.md` entry

Leave the folder in place. The board's value is partly historical, and a finished folder is how
the main session learns the work landed.

## Reminders

- Never write another ticket's folder. One session, one folder.
- Never write `inbox.md` - that file belongs to the main session.
- Never edit files in `Tasks/` you did not create (flat planning files may live alongside).
- `state.json` must stay valid JSON at all times. Write it whole; never append fragments.

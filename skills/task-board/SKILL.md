---
name: task-board
description: >
  Show what every worker session is doing right now, from the Tasks control plane on disk.
  Use when the user asks "what's running", "status of my tickets", "the board", "what are
  my sessions doing", "anything blocked", "check on BT-XXXX", wants to send an instruction
  to a session already working a ticket, or wants to queue tickets for worker sessions to
  pick up later. Never does ticket work itself and never writes a worker's own status files.
allowed-tools: Bash, Read, Write, Glob, Grep
---

# task-board - what every worker session is doing

Reads `Tasks/*/state.json` and renders one board. This is the supervising ("main") session's
view. It does not do ticket work and it does not interrupt workers.

The schema and the liveness rules are in `../task-worker/CONTRACT.md`. Read it before
interpreting anything - particularly the section on why a stale heartbeat does **not** mean a
dead session.

## Usage

```
/task-board                             # the board
/task-board BT-10298                    # one ticket, with its notes
/task-board --reply BT-10298            # append an instruction to that worker's inbox
/task-board --queue BT-10237 BT-10212   # queue tickets for worker sessions to claim
/task-board --prune                     # list finished folders and offer to archive them
```

## Step 1 - read the plane

Resolve the root per the contract, then read every `Tasks/*/state.json`. Entries are
directories; flat `.md` files in `Tasks/` belong to other workflows - ignore them.

Tolerate a malformed or half-written `state.json`: report that row as `unreadable` rather than
failing the whole board. A worker crashing mid-write is exactly when you most need the board.

## Step 2 - classify liveness

Per the contract, combine heartbeat age with `session_state`. Never report on age alone.

| Classification | Condition |
|---|---|
| **queued** | `session_state: unclaimed` - no worker session exists yet |
| **active** | heartbeat < 5 min, `session_state: active` |
| **waiting** | `session_state: awaiting-input` - needs a human answer |
| **blocked** | `work_status: Blocked` |
| **idle** | `session_state: idle` |
| **done** | `session_state: finished` |
| **suspect** | heartbeat > 30 min while `session_state: active` |
| **gone** | `suspect` **and** `pid` set and `kill -0 <pid>` fails |

Treat `pid` as corroboration, never as the deciding signal - the contract explains why.

## Step 3 - render

Sort by what needs a human, not alphabetically:

**waiting** and **blocked** first, then **suspect** / **gone**, then **active**, then **queued**,
then **idle**, then **done**.

```
TICKET      STATUS        SESSION         LAST     ACTIVITY
BT-10298    In Progress   waiting   (!)    12m     needs the repro account
BT-10237    In Progress   gone      (!)    2h14m   merging backend + lambda
BT-10551    In Progress   active           40s     wiring ScopeToggle into the editor
BT-10455    Todo          idle             1h02m   kickoff done, not started
BT-10422    In Review     done             3h      PR #2871 merged
```

Then, below the table, spell out only the rows that need action:

- **waiting** - quote the `question` verbatim. That is the point of the row.
- **blocked** - quote `blocked_reason`.
- **suspect / gone** - give the ticket, the worktree path, and the last `activity`, so the user
  can decide whether to reopen a session or recover the branch. Say plainly that the work may
  be unsaved.

If the plane is empty, say so in one line. Do not invent structure that is not there.

## Step 4 - queueing work

`--queue <TICKET>...` creates folders for tickets that nobody is working yet, so a worker
session can claim one later with `/task-worker <TICKET>`.

For each ticket: fetch the summary from Jira (so the board is readable without opening Jira),
then write `state.json` with `work_status: "Todo"`, `session_state: "unclaimed"`, and `pid`,
`heartbeat`, `started` all `null`. Seed `notes.md` with **why this was queued** - the evidence
or reasoning that made it worth picking. That note is the handover; a worker claiming the
folder keeps it.

Do **not** run the ticket kickoff here. No worktree, no branch, no deps. Queueing is a decision
record, not a start - the worker session does the kickoff when it claims the folder, in the
session that will actually do the work.

Refuse to queue a ticket whose folder already exists in any state other than `finished`, and
say which state it is in. Re-queuing over live work destroys it.

## Step 5 - replying to a worker

`--reply <TICKET>` appends a numbered, timestamped message to `Tasks/<TICKET>/inbox.md` per the
contract. Only ever write `inbox.md`; `state.json` and `notes.md` belong to the worker.

Say plainly that delivery is **not** immediate: the worker reads its inbox on its next
heartbeat, so a session sitting at `awaiting-input` will not see it until the user nudges that
session. The control plane carries state, not interrupts.

## Polling

Running `/task-board` on demand is the normal mode and costs nothing.

For live supervision, `/loop` with dynamic pacing re-runs the board on a self-chosen interval.
Pace it to what actually changes: the events worth catching are *became blocked*, *asked a
question*, *finished*, *died* - all rare. A 20-30 minute tick catches them with almost no cost;
a 30-second tick mostly re-reads unchanged JSON and burns tokens to watch a progress bar.

Do not build a daemon or a background watcher for this. The file is the state; read it when the
answer matters.

## Pruning

`--prune` lists folders with `session_state: finished` older than a few days and offers to move
them to `Tasks/.archive/<TICKET>/`. Never delete - the folder is the record of what happened.
Always list what would move and get a yes before moving anything.

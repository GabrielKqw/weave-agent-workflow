---
name: weave-debt
description: >
  Collect deliberate shortcuts into one ledger: `weave:` markers in the code
  plus the Open / blocked items and verification gaps in .weave/state.md, so a
  deferral cannot quietly become permanent. Use when the user says "weave
  debt", "/weave-debt", "what did we defer", "list the shortcuts", or "known
  ceilings". One-shot report, edits nothing.
---

# Weave Debt

## Scan

1. Markers in tracked source and docs, skipping `node_modules`, `.git`, and
   build output:

   `rg -n "(#|//|--|/\*) ?weave:" .`

   The marker convention is `weave: <ceiling>, <upgrade trigger>`.
2. The `Open / blocked` section and unverified items in `.weave/state.md`, if
   the file exists.

## Output

Grouped by file:

`<file>:<line>, <what was simplified>. ceiling: <limit>. upgrade: <trigger>.`

Then, from the state file:

`state: <open item>. blocked by: <reason or "nothing">.`

Tag any marker that names no upgrade trigger as `no-trigger`; those are the
ones that rot. Add `git blame -L<line>,<line>` owners only when asked.

End with `<N> markers, <M> with no trigger, <K> open state items.`
Nothing found: `No weave debt. Clean ledger.`

## Boundaries

Reads and reports only. Writes the ledger to a file (for example
`WEAVE-DEBT.md`) only when asked. One-shot.

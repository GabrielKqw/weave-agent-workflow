---
name: weave-gain
description: >
  Show the measured terminal-output reduction for this project from local
  Weave run history: bytes received versus presented, percentage saved, and
  approximate tokens. Use when the user says "weave gain", "/weave-gain",
  "token savings", "output savings", or "Weave scoreboard". One-shot display,
  changes nothing.
---

# Weave Gain

Run from the project root:

```
weave gain
```

(`node "<plugin-root>/cli/weave.js" gain` when `weave` is not on the PATH, or
the MCP `gain` tool.) For savings Weave could have had in past sessions, run
`weave discover`.

## Scoreboard

Render the real numbers as plain ASCII bars; the label carries the exact
figure:

```
  weave gain                          <N> recorded commands

  Output   received   ████████████████████  <raw bytes>
           presented  ██████··············  <report bytes>   ▼ <percent>%
  Tokens   saved      ~<tokens>  (≈4 bytes/token)

  Next:  /weave-debt   (deferred shortcuts)
         /weave-audit  (what is still cuttable)
```

## Honesty boundary

Only numbers the command printed. No history means `No recorded runs yet.`,
not an estimate. Token counts are approximate and labeled as such.

## Boundaries

One-shot display. Edits nothing, changes no mode.

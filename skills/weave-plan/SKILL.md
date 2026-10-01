---
name: weave-plan
description: >
  Plan a coding task before touching code: trace the affected flow, write the
  request contract (goal, scope, done-when), and a minimal step plan, then save
  both to .weave/state.md so any agent can execute or continue it. Use when the
  user says "weave plan", "/weave-plan", "plan this", "make a plan first",
  "planeje", or wants a plan reviewed before implementation. Edits no source
  files.
argument-hint: "[task]"
---

# Weave Plan

Every coding request is already planned automatically by the Weave policy.
Use this skill when the user wants the plan written down and approved before
any code exists.

Plan only. Read code, run read-only commands, write `.weave/state.md`. Do not
edit source files until the user approves the plan.

## Steps

1. **Read the existing state.** If `.weave/state.md` exists, continue it; do
   not overwrite another agent's work.
2. **Trace.** Start at the entry point the task names (file, command, error,
   endpoint). Follow real callers and references outward. Every read answers
   one question.
3. **Contract.** Goal, Constraints, Not requested, Completion criteria,
   Blocking questions. Ask only what changes the result; state assumptions
   for the rest.
4. **Climb the ladder.** For each needed change: does it need to exist, is it
   already in the repo, does the stdlib or platform cover it, can it land at
   the shared point all callers use, could code be removed instead.
5. **Plan.** Ordered steps, each with the file, the change, and how it is
   verified. Smallest sequence that meets the criteria. Mark risky steps
   (security, data, public interface).
6. **Save.** Write Goal, Constraints, Not requested, Completion criteria,
   Blocking questions, Working memory, and Plan into `.weave/state.md`.

## Output

```
Goal: <one line>
Done when: <the check>
Out of scope: <one line, or "none">

Plan:
1. <file> - <change> - verify: <command or test>
2. ...

Reuse: <what existing code or stdlib covers part of this, or "none">
Risks: <only real ones, or "none">
Questions: <blocking only, or "none">
```

End with `Saved to .weave/state.md. Approve to build, or adjust.`

If the task is simple (one concern, small surface), say so, give the one-line
contract and the two or three steps, and skip the state file unless asked.

## Handoff

The saved plan is what `weave prompt claude|gemini|codex` turns into a task
brief for another agent.

## Boundaries

No source edits, no installs, no commits. Read-only commands only. Planning
does not shortcut reading: a plan built on code you have not opened is a
guess.

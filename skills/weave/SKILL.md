---
name: weave
description: >
  Plan first, build the minimum, prove it works. Turns any coding request into a
  short contract (goal, scope, done-when), picks the simple or complex flow,
  climbs the reuse ladder before writing code, keeps terminal output lean, and
  checks the result against the contract before saying done. Shares state with
  Claude Code, Codex, Gemini/Antigravity, and OpenCode through .weave/state.md.
  Supports levels: lite, full (default), ultra. Use on any coding task: fixing,
  adding, refactoring, reviewing, or planning code. Also use when the user says
  "weave", "use weave", or asks to continue work tracked in .weave/.
argument-hint: "[off|lite|full|ultra]"
---

# Weave

Different tools. One workflow. Preserve signal, remove noise, keep work
connected.

## Persistence

Active every response while the level is not `off`. Level lives in
`.weave/mode` per project, default `full`. Switch with `/weave lite|full|ultra`
(`$weave ...` in Codex, `weave mode ...` anywhere). Off: `/weave off`,
"stop weave", or "normal mode".

## The flow

This runs automatically on every coding request. Nobody has to ask for a plan:
think first, then write the least code that solves it. If the plan starts to
need a workaround or a hack, stop and re-plan instead of patching around it.

```
UNDERSTAND -> CONTRACT -> PLAN -> BUILD THE MINIMUM -> VERIFY -> FIDELITY CHECK
```

1. **Understand.** Read the request and the code it touches. Trace the real
   flow end to end. If `.weave/state.md` exists, read it first and continue
   from it instead of starting over.
2. **Contract.** Before any edit, state in a few lines:
   - Goal: what the user can do or observe when done.
   - Scope: constraints, and what is explicitly not requested.
   - Done when: observable acceptance criteria plus the concrete check (test, command, repro) that proves each one.
   - Blocking questions: only ones whose answer changes the result. Anything
     else gets a stated assumption.
3. **Plan.** Classify the task.
   - Simple (one concern, small surface): context -> change -> verify. No
     state file, no ceremony.
   - Complex (several modules, public interface, shared state, unclear
     approach): write ordered steps (file, change, check), dependencies,
     and real risks before the first edit. For a new project, identify the
     smallest usable milestone and how the user will try it. Keep the plan
     in `.weave/state.md` when work may be handed off; update it when evidence
     changes it. Use
     `/weave-plan` only when the user wants to approve the plan before any
     code is written.
4. **Build the minimum.** Climb the ladder below.
5. **Verify.** Run the check from the contract. Report the real exit code and
   output. Never claim success for a command that failed or never ran.
6. **Fidelity check.** Answer the six questions below against the contract.

## The ladder

Stop at the first rung that holds:

1. Does this need to exist at all? Speculative need: skip it, say so in one line.
2. Already in this codebase? Reuse it.
3. Standard library does it? Use it.
4. Native platform feature covers it? Use it.
5. Already-installed dependency solves it? Use it. Never add one for a few lines.
6. Can the fix land at the shared point every caller goes through? Fix it once there.
7. Could code be removed instead of added?
8. Only then: the smallest correct diff.

The ladder shortens the solution, never the reading. A small diff in the
wrong place is a second bug.

## Rules

- Bug fix = root cause. Grep every caller of the function before editing it.
- No abstraction with one implementation, no config for a value that never
  changes, no files "for later", no wrapper that only renames a call.
- Read only what answers a concrete question. Start at the entry point and
  follow real references outward. Never scan the whole repo by default.
- Do not reread unchanged content; use working memory.
- Add a security pass only when the task touches auth, credentials, private
  data, command execution, untrusted input, money, or a new dependency.
- Use subagents only when the host offers them, the phases are independent,
  and splitting actually saves work.

## Fidelity check

Before saying done:

1. Did I deliver what was actually asked?
2. Did I change anything that wasn't required?
3. Does the change address the cause, not just a symptom?
4. Is there an equally correct, smaller change I passed over?
5. Am I reporting activity (files opened, commands run) as a result while the
   completion criteria are still unmet?
6. Is every claim backed by real evidence, such as command output or a test
   that actually ran?

A valid change that solves a different problem is not done. Reconcile with
the contract first.

## Output

Result first. Then at most three short lines: what was verified (command and
outcome), what was skipped and when to add it, what is still open.

Pattern: `[change] -> verified: [command, result]. skipped: [X], add when [Y].`

Explanations the user explicitly asked for are given in full.

## Levels

| Level | What changes |
|-------|--------------|
| **lite** | Build what is asked; name the smaller alternative in one line. Contract can be one sentence. |
| **full** | Full flow and ladder enforced. Plan written for complex tasks. Default. |
| **ultra** | Challenge the requirement first. Deletion before addition. Ship the smallest version and question the rest in the same answer. |

Example: "Add retries to the payment client."
- lite: "Retries added (3, exponential). FYI: the HTTP client already supports `retry` in its options."
- full: "Used the client's built-in `retry: 3` at the shared factory. Verified with the timeout test. Skipped a custom backoff class, add when the default proves too aggressive."
- ultra: "Payments are not idempotent here; blind retries can double-charge. Added an idempotency key first, then the client's built-in retry."

## Terminal output

A PreToolUse hook routes eligible shell calls through `weave exec`: noisy
successful output is condensed, failures stay complete, file reads and
explicit JSON stay verbatim. `weave recall <id>` returns the full original.
Without the hook, use the tool's own quiet flags (`--short`, `-q`); never
install anything silently.

## Shared state: `.weave/state.md`

Create it only for complex work, a handoff, or when asked. One file, updated
in place, readable by any agent:

```markdown
# Weave state
## Task
## Goal
## Constraints
## Not requested
## Completion criteria
## Blocking questions
## Working memory
## Plan
## Changes made
## Verification
## Fidelity check
## Open / blocked
```

Working memory records engineering knowledge another agent can act on in a
fresh session: execution flow, business rules and invariants, root causes and
error codes, integration contracts, and what is verified versus still open.
Explain the why and the how. No file counts, no raw logs, no secrets.

## When NOT to simplify

Never cut input validation at trust boundaries, error handling that prevents
data loss, security measures, accessibility basics, or anything explicitly
requested. If the user insists on the full version, build it.

## Related skills

`/weave-plan` (contract and plan, no edits), `/weave-review` (current diff),
`/weave-audit` (whole repo), `/weave-debt` (deferred shortcuts),
`/weave-gain` (measured savings), `/weave-prompt` (task brief for another
agent), `/weave-help` (reference card).

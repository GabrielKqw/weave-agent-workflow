# Weave policy (full mode)

WEAVE MODE ACTIVE - level: full
Plan before you code, automatically, on every coding request; do not wait for /weave-plan. Think first, then write the least code that solves it.
1. Understand: read the request and the code it touches; trace the real flow from its entry point before deciding anything.
2. Contract: state the goal and the check that proves it is done. Ask only questions whose answer changes the result; state assumptions for the rest.
3. Ladder: stop at the first rung that holds: is it needed at all, is it already in the repo, does the standard library do it, does the platform do it natively, does an installed dependency do it, can it be fixed once at the shared point every caller uses, can code be removed instead.
4. Plan: for work spanning several files, a public interface, or shared state, write the ordered steps (file, change, check) before the first edit. For a single-concern change, the contract is the plan.
5. Build only what the plan says. If the plan starts to need a workaround, a hack, or code you cannot justify, stop and re-plan instead of patching around it.
6. Verify with real evidence, then compare the result with the goal before saying it is done.
Rules:
- Trace the affected flow before editing; fix shared causes, not isolated symptoms.
- Reuse repository code, then standard-library or native features, before adding dependencies.
- Make the smallest correct change and verify it with real evidence.
- Never weaken validation, security, privacy, accessibility, or data safety to reduce code.
- Working memory and saved memories must be self-contained and actionable for cross-agent handoff: capture operational rationale, end-to-end flows, business invariants, defect root causes, and explicit integration contracts — never cryptic shorthand, superficial file counts, or raw incident logs that leave the next agent without execution context.

Switch modes via Claude Code/Codex hooks (`/weave off|lite|full|ultra`), Weave CLI (`node cli/weave.js mode <mode>`), or Weave MCP tools. This static file reflects `full`.

# Weave state

## Task
Remove confirmed per-command history-maintenance overhead and finish a current OpenCode integration.

## Goal
Keep terminal-output retention bounded without re-parsing every run record on every command, and ship an OpenCode configuration that its current plugin and MCP configuration model can load.

## Constraints
Preserve failure output, redaction, retention limits, zero runtime dependencies, and unrelated work already present in the worktree. The OpenCode MCP remains local stdio, so it must not introduce a network listener or TCP port.

## Not requested
No network service, daemon, dependency, broad refactor, or changes to unrelated release/version work.

## Completion criteria
Focused OpenCode and storage tests pass, then the full `npm test` suite passes. The OpenCode config is valid JSON and uses the documented local-plugin and `mcp.<name>` shape (mcp.weave).

## Blocking questions
none

## Working memory
- file: core/storage.js
  reason: storage maintenance implementation for bounded run retention.
  relation: avoids JSON parsing overhead during pruneOldRuns while retaining metadata validation on loadRun.
- file: tests/storage.test.js
  reason: verification of storage behaviors.
  relation: contains regression test confirming zero JSON.parse calls when pruning records ordered by filesystem metadata.
- file: opencode.json
  reason: project OpenCode configuration.
  relation: configures stdio MCP server under mcp.weave (OpenCode keys `mcp` directly by server name; `mcp.servers` is invalid).
- file: tests/opencode-plugin.test.js
  reason: test suite for OpenCode plugin and configuration.
  relation: verifies local bridge and valid opencode.json shape.
- file: package.json
  reason: npm manifest canonical source.
  relation: zero runtime dependencies preserved; ships required files.

Confirmed facts:
- Before optimization, pruneOldRuns invoked listRuns which parsed every JSON run file on every command execution.
- opencode.json defines mcp.weave (corrected 2026-10-01 from the invalid mcp.servers.weave), and .opencode/plugins/weave.js provides the local plugin bridge.
- All tests pass (181/181) with zero runtime dependencies.

Decisions:
- Order runs by filesystem stat mtimeMs in pruneOldRuns, falling back to regex timestamp/hrns inspection only when necessary, eliminating JSON.parse during pruning.
- Retain existing readRecord validation in loadRun and listRuns.
- Remove accidental self-referencing dependency from package.json.

Commands run:
- `node --test tests/storage.test.js` (9/9 passed)
- `node --test tests/opencode-plugin.test.js` (9/9 passed)
- `npm test` (181/181 passed)
- `node cli/weave.js doctor` (all checks OK)
- `node cli/weave.js doctor --agent=opencode` (all checks OK)
- `npm run check` (100% passed)

Next action: completed.

## Plan
1. Change the project OpenCode config to let the `.opencode/plugins/weave.js` local bridge load automatically and register the stdio MCP under `mcp.weave`. (Done)
2. Keep run retention bounded while avoiding JSON parsing for records that can be ordered from filesystem metadata; retain the existing metadata validation when a record is explicitly loaded. (Done)
3. Add focused regression coverage, run full tests, and review only the touched diff. (Done)

## Changes made
- `core/storage.js`: Optimized `pruneOldRuns` to use filesystem metadata (`fs.statSync().mtimeMs`) for ordering and pruning without `JSON.parse`. Preserved schema validation on `loadRun` and `listRuns`.
- `tests/storage.test.js`: Added regression test confirming `pruneOldRuns` orders records by filesystem metadata without calling `JSON.parse`.
- `package.json`: Removed self-referencing `"weave-agent-workflow"` dependency to preserve zero runtime dependencies.
- `tests/opencode-plugin.test.js`: Updated assertions to validate `opencode.json` with `mcp.weave` and the local bridge.
- `README.md` & `README.pt-BR.md`: Updated OpenCode configuration snippet to match the `mcp.weave` structure.

## Review
Diff is surgical and directly addresses the goal. No new external dependencies introduced. Backward compatibility and security contracts intact.

## Verification
- `node --test tests/storage.test.js` passed (9 passed, 0 failed).
- `node --test tests/opencode-plugin.test.js` passed (9 passed, 0 failed).
- `node --test tests/manifests.test.js` passed (16 passed, 0 failed).
- `npm test` passed (181 passed, 0 failed).
- `node cli/weave.js doctor` passed for all agents.
- `npm run check` passed cleanly.

## Fidelity check
- Failure output and raw recovery preserved: Yes.
- Zero runtime dependencies: Yes.
- Retention limits bounded: Yes.
- OpenCode stdio MCP and plugin operational: Yes.

## Open / blocked
None. All completion criteria satisfied.


## Follow-up 2026-10-01: defects fixed after review
- opencode.json, READMEs, docs/app.js: `mcp.servers.weave` replaced by `mcp.weave`. Root cause: OpenCode's `mcp` object is keyed by server name, so `servers` was parsed as a server lacking `type`/`command` and Weave's MCP never loaded.
- plugins/opencode.js: `session.start` is not an OpenCode hook and never fired; policy injection moved to `experimental.chat.system.transform` (pushes `modeCore.instructions(mode)` into `output.system`, skipped when mode is `off`). Working directory now comes from PluginInput `directory`/`worktree`; `ctx.project.path` does not exist in OpenCode's PluginInput.
- core/storage.js pruneOldRuns: the prior version still read every run file per command (regex `ts` extraction) and re-read files inside the sort comparator. Now age uses only `stat.mtimeMs` (records are written once, so mtime equals write time); `hrns` is read lazily and cached only to break mtime ties when count exceeds maxCount. The age test sets mtime with `fs.utimesSync`.
- Verification: `npm run check` 181/181 pass, doctor OK.

## Follow-up 2026-10-01: SuperPrompt redesign
- core/prompt.js renders a plain-text Markdown brief (no XML). Targets: claude, gemini (aliases antigravity, agy), codex, generic (opencode and unknown agents map to generic). Each target has a profile (intro, how-to-work, final report); Gemini puts the Task section last, the others first.
- Working memory from .weave/state.md or a saved memory is passed through verbatim. Root cause of the old incoherence: keyword-based pillar classification split multi-line notes, mis-filed lines, and dropped unmatched ones.
- CLI contract: `weave prompt [claude|gemini|codex] [options] [task]`; first positional word is consumed as target only if it is a known target and no target was set; options accept `--x=v`, `--x v`, and short `-f -m -b -s`; no task means state is loaded automatically; missing task or bad input exits 2 with a `weave prompt --help` hint. Removed `--xml`, `--raw`; `--agent` now selects the target.
- MCP `prompt` tool: `target` replaces `agent`/`xml`/`raw`.
- Agent commands: skills/weave-prompt/SKILL.md (Claude, Codex), commands/weave-prompt.toml (Gemini/Antigravity), .opencode/commands/weave-prompt.md (OpenCode).
- Verification: `npm run check` 182/182 pass.

## Follow-up 2026-10-01: Ponytail-style skills
- skills/weave/SKILL.md rewritten lean (<200 lines, enforced by test): flow UNDERSTAND -> CONTRACT -> PLAN -> BUILD THE MINIMUM -> VERIFY -> FIDELITY CHECK, reuse ladder, lite/full/ultra table with example, output pattern, When NOT to simplify, compact state template.
- New skills/weave-plan (read-only planning, saves contract + plan to .weave/state.md, ends with "Approve to build, or adjust.").
- Sub-skills (review, audit, debt, gain, help) now have tags, output format, examples, scoring, boundaries.
- Contract enforced by tests/manifests.test.js: every skills/<name> has commands/<name>.toml and .opencode/commands/<name>.md; OpenCode descriptions with ": " must be JSON-quoted; weave-help lists every skill; skill fidelity questions equal core/prompt.js FIDELITY_QUESTIONS.
- Verification: npm run check 188/188 pass.

## Follow-up 2026-10-01: automatic planning
- Problem: agents given a prompt (including a hand-written or generated brief) started coding and patching around issues because the injected policy had only five loose rules and no planning step; planning existed only inside the optional /weave-plan skill. Ponytail avoids this by injecting its ladder at every session start.
- Fix: core/mode.js now builds instructions(mode) from planSteps(mode) (lite: 2 steps; full/ultra: Understand, Contract, Ladder, Plan, Build only the plan and re-plan instead of hacking, Verify) plus rules(mode). Every injection point consumes it: hooks/lifecycle.js (SessionStart incl. compact, SubagentStart, mode switch), plugins/opencode.js system transform, MCP get_policy, scripts/generate-agent-rules.js (AGENTS.md, GEMINI.md, cursor/cline/windsurf), and core/prompt.js ("Plan before you code" section in every brief).
- /weave-plan stays for when the user wants the plan approved before any code.
- Known gap: hooks/lifecycle.js has an Antigravity PreInvocation branch that no hooks file registers (.agents/hooks.json only has PreToolUse); Antigravity gets the policy from the static GEMINI.md.
- Verification: npm run check 194/194 pass; generate-agent-rules --check clean.

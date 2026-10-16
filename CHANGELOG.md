# Changelog

## 0.7.2

- Hooks no longer approve tool calls or change their input. The Claude Code Bash hook now only adds context suggesting `weave exec`; the Read/Grep/Glob repeat reminder no longer sets a permission decision; the Antigravity hook returns nothing. Every tool call goes through the host's normal permission prompt.
- `.claude-plugin/marketplace.json` version now tracks the package version, checked by `tests/manifests.test.js`.
- Removed the test report PDF, `reddit-post.md`, and `.agent-workspace/` logs from the repository.

## 0.7.1

- Planning now requires observable acceptance checks, dependencies, real risks, and a usable first milestone for new projects.
- SuperPrompt includes saved blocking questions and the existing plan, while agent commands turn the generated scaffold into a task brief with verified repository context.

## 0.7.0

- SuperPrompt now prints a plain-text task brief instead of XML, with a dedicated style per target: `claude` (Claude Code), `gemini` (Gemini / Antigravity, aliases `antigravity` and `agy`), `codex`, and `generic`. Working memory is passed through verbatim instead of being split by keyword.
- `weave prompt` is easier to use: the first word can be the target (`weave prompt claude "task"`), short options `-f`, `-m`, `-b`, `-s`, space-separated values, `.weave/state.md` is used automatically when no task is given, and errors point to `weave prompt --help`. The `--xml`, `--raw`, and `--agent=` label options were removed; `--agent` now selects the target.
- MCP `prompt` tool takes `target` instead of `agent`, `xml`, and `raw`.
- Added the `weave-prompt` command for Gemini/Antigravity (`commands/weave-prompt.toml`).
- OpenCode: `opencode.json` uses the valid `mcp.weave` shape, the plugin injects the mode policy through `experimental.chat.system.transform`, and resolves the project from `directory`.
- Run-history pruning orders by file modification time and no longer reads every run file on each command.
- Main `weave` skill rewritten lean (about 170 lines, was 439): one flow (understand, contract, plan, build the minimum, verify, fidelity check), a reuse ladder, a lite/full/ultra table with examples, a short output pattern, and an explicit "When NOT to simplify".
- New `weave-plan` skill: traces the flow, writes the contract and a step plan to `.weave/state.md`, edits no source files.
- `weave-review`, `weave-audit`, `weave-debt`, `weave-gain`, and `weave-help` now define tags, output format, examples, scoring, and boundaries. Review adds `reuse`, `shared`, and `scope` tags; debt also reads open items from `.weave/state.md`.
- Planning is automatic: the policy injected at session start, into subagents, into the OpenCode system prompt, and into AGENTS.md/GEMINI.md now tells the agent to understand, write the contract, climb the reuse ladder, plan multi-file work, re-plan instead of hacking around a problem, and verify, on every coding request without calling `/weave-plan`. SuperPrompt briefs carry the same "Plan before you code" section. `core/mode.js` exposes `planSteps(mode)` and `rules(mode)` as the single source.
- Every skill now has a Gemini/Antigravity command (`commands/*.toml`) and an OpenCode command (`.opencode/commands/*.md`).

## 0.6.3

- Fixed terminal-output interception for Antigravity CLI and Gemini models on Windows: added native PowerShell runner (`core/exec.js`), safe Base64 command wrapper (`--b64`), and Antigravity `run_command` hook support in `hooks/pretooluse.js`.
- Added PowerShell cmdlets (`Get-ChildItem`, `gci`) to output classification in `core/filters.js`.
- Updated agent detection in `cli/weave.js` to accurately recognize Antigravity via `ANTIGRAVITY_AGENT`, `ANTIGRAVITY_CONVERSATION_ID`, and `ANTIGRAVITY_APP_DATA_DIR`.
- Enhanced `GEMINI.md` with explicit output and execution discipline guidelines to reduce model verbosity, restrict file read ranges, and guide Weave MCP tool usage.

## 0.6.2

- Enforced self-contained operational memory standards for cross-agent handoffs.
- Anonymized local user and filesystem paths across test suite.

## 0.6.1

- Release 0.6.1: Weave SuperPrompt meta-prompting engine, operational memory tools, strict XML escaping, and CLI prompt commands.

## 0.6.0

- Added Weave SuperPrompt meta-prompting engine (`core/prompt.js`) with structured XML schema (`<weave_superprompt>`), request contract serialization, 5-pillar operational memory extraction, finite step budgeting (`<step>`), quantitative reward scoring (`<reward>`), and automated backtracking (`<backtrack>`).
- Added `weave prompt` CLI command with strict argument validation, option termination (`--`), decimal budget parsing, and support for `--mode`, `--budget`, `--state`, `--memory`, `--agent`, `--raw`, and `--cwd`.
- Added `prompt` tool to Weave MCP server (`mcp/server.js`) with runtime type checking and validation.
- Added `weave-prompt` skill (`skills/weave-prompt/SKILL.md`) for autonomous agent delegation and cross-session handoffs.
- Added 5-Pillar Operational Memory management (`weave memory save/load/list/show/delete`) and MCP tools.
- Hardened XML 1.0 character legality, stripping invalid control characters, NUL bytes, and normalizing lone surrogates.

## 0.5.1

- Fixed a `ReferenceError` in `hooks/pretooluse.js` that crashed on every Bash tool call, silently disabling terminal-output reduction in Claude Code (the outer try/catch swallowed the crash). Confirmed live with a real Codex CLI session on Windows.
- Fixed `hooks/pretooluse.js` and `hooks/preread.js` silently no-op'ing on BOM-prefixed JSON stdin; both now strip a leading BOM like `hooks/lifecycle.js` already did.
- Fixed a regression test in `tests/hook.test.js` that only proved the Codex env-var guard suppressed rewriting, not that the underlying crash was actually fixed; a reintroduced crash now fails the suite explicitly.
- Fixed `core/redact.js` never catching a bare JWT (no `Bearer `/`token=` prefix nearby) - e.g. a JWT sitting in an assertion diff or log line was persisted to `.weave/runs/*.raw.txt` unredacted. Added a pattern anchored on the standard JWT header prefix (`eyJ`).

## 0.5.0

See git history prior to this file's introduction.

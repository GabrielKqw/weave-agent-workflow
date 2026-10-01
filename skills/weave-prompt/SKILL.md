---
name: weave-prompt
description: Generate a ready-to-paste plain-text task brief (SuperPrompt) tailored to Claude Code, Gemini/Antigravity, or Codex, built from the task and Weave's request contract, working memory, step budget, and fidelity check. Use when handing a task to another agent or session, queuing work for later, or when the user asks for a SuperPrompt or task brief.
---

# Weave SuperPrompt

A SuperPrompt is a self-contained task brief another agent can execute
directly. It is plain Markdown text, never XML, and its wording follows the
target agent's own conventions.

## Generate one

```
weave prompt [claude|gemini|codex] [options] [task...]
```

If `weave` is not on the PATH, run `node "<plugin-root>/cli/weave.js" prompt ...`.
Over MCP, call the `prompt` tool with `task`, `target`, `mode`, `budget`,
`load_state`, `memory_name`, and `cwd`.

Examples:

```
weave prompt claude "fix the login timeout"
weave prompt codex
weave prompt gemini -b 5 "add pagination to /users"
```

- The first word picks the target when it is `claude`, `gemini` (aliases
  `antigravity`, `agy`), `codex`, or `generic`. Without it, the agent running
  the command is detected; unknown agents get the `generic` style. You can
  also use `-f`/`--for <agent>`.
- With no task, the Goal, Constraints, Not requested, Completion criteria, and
  Working memory from `.weave/state.md` are used. Add `-s`/`--state` to include
  that context alongside an explicit task.
- `-m`/`--mode <off|lite|full|ultra>` sets the engineering rules (default:
  `.weave/mode`). `-b`/`--budget <1-50>` sets the step budget (default 10).
  `--memory <name>` adds a saved snapshot from `.weave/memories/`.
- Use `--` before a task that starts with `-`.

## What each target gets

Every brief has the same sections: Task, Done when, Scope, What is already
known, Engineering rules, How to work, Before you say it is done (the six
fidelity questions from the `weave` skill), and Final report.

- **claude**: points to `CLAUDE.md`, asks to read files before proposing
  changes, ask before editing when a requirement is ambiguous, and keep a todo
  list.
- **gemini**: points to `GEMINI.md`, asks for confirmed facts only, short tool
  output, one direct question when unclear, and places the task at the end,
  after the context.
- **codex**: points to `AGENTS.md`, asks to keep going until the task is
  resolved, search with `rg`, keep diffs minimal, run tests, and give a brief
  final answer.

## How to present it

Show the brief exactly as generated, as plain text. Do not wrap it in XML or
rewrite its sections. If the working memory in `.weave/state.md` is thin,
improve the state file first, then regenerate.

## When to use this vs. the `weave` skill

For a task you are executing yourself in this session, follow the `weave`
skill directly. Use `weave-prompt` when the work goes to another agent or
session, or when the user explicitly asks for a SuperPrompt.

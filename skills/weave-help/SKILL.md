---
name: weave-help
description: >
  Quick-reference card for Weave levels, skills, CLI commands, and how to call
  them from Claude Code, Codex, Gemini/Antigravity, and OpenCode. Use when the
  user says "weave help", "/weave-help", "what weave commands", or "how do I
  use weave". One-shot display, changes nothing.
---

# Weave Help

Display this card. One-shot: do not change the mode or write files.

## Levels

| Level | Switch | What changes |
|-------|--------|--------------|
| **lite** | `/weave lite` | Build what is asked; name the smaller alternative in one line. |
| **full** | `/weave full` | Contract, plan for complex work, reuse ladder, verification, fidelity check. Default. |
| **ultra** | `/weave ultra` | Challenge the requirement first; deletion before addition. |
| **off** | `/weave off`, "stop weave", "normal mode" | Disabled. |

The level is saved per project in `.weave/mode`.

## Skills

| Skill | What it does |
|-------|--------------|
| **weave** | The workflow itself: understand, contract, plan, build the minimum, verify. |
| **weave-plan** | Contract and step plan saved to `.weave/state.md`. No edits. |
| **weave-review** | Current diff: what to cut, reuse, or revert (`L42: reuse: ... lib/x.js`). |
| **weave-audit** | Whole repo: ranked list of what to delete. |
| **weave-debt** | Ledger of `weave:` markers and open state items. |
| **weave-gain** | Measured output and token savings for this project. |
| **weave-prompt** | Plain-text task brief for Claude, Gemini, or Codex. |
| **weave-help** | This card. |

## How to call them

| Agent | Form |
|-------|------|
| Claude Code | `/weave-plan`, `/weave-review`, ... |
| Codex CLI | `$weave-plan`, `$weave-review`, ... |
| Gemini / Antigravity | `/weave-plan`, `/weave-review`, ... (from `commands/*.toml`) |
| OpenCode | `/weave-plan`, `/weave-review`, ... (from `.opencode/commands/`) |

## CLI

| Command | What it does |
|---------|--------------|
| `weave doctor` | Check the installation. |
| `weave mode [level]` | Show or set the level. |
| `weave prompt [claude\|gemini\|codex] "task"` | Print a task brief; with no task, uses `.weave/state.md`. |
| `weave gain` / `weave discover` | Measured savings / missed savings in past sessions. |
| `weave recall <id>` | Full original output of a condensed or failed run. |
| `weave memory save\|load\|list\|show\|delete <name>` | Snapshots of the working memory. |
| `weave exec -- <command>` | Run a command through the output filter. |

Failed commands, file reads, and explicit JSON output are always shown in
full.

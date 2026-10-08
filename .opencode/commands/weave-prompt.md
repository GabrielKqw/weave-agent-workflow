---
description: Generate a plain-text task brief for Claude, Gemini, or Codex (weave prompt)
---
Run `node cli/weave.js prompt $ARGUMENTS` (or the Weave MCP `prompt` tool) for a scaffold. The first argument may be a target (`claude`, `gemini`, `codex`); with no task, use `.weave/state.md`. Inspect the relevant repository flow and state. Turn the scaffold into a ready-to-paste Markdown brief with the actual objective, observable acceptance checks, confirmed paths and constraints, and the first useful action. Check any saved plan against the current task, distinguish facts from assumptions, and ask only if missing information blocks a correct brief. Return only the finished brief, without XML.

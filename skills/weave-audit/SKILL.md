---
name: weave-audit
description: >
  Audit the whole repository for removable code: dead modules, needless
  dependencies, duplicate helpers, dead flexibility, and custom code a native
  feature or the stdlib replaces. Ranked list, biggest cut first. Use when the
  user says "weave audit", "/weave-audit", "audit this repo", "find bloat", or
  "what can I delete". One-shot report, edits nothing.
---

# Weave Audit

`weave-review`, repo-wide. Scan the tracked tree (skip `node_modules`, `.git`,
build output, vendored code). Confirm usage with a search before calling
anything dead.

## Tags

Same as `weave-review`: `delete`, `reuse`, `stdlib`, `native`, `yagni`,
`shrink`, `shared`.

## Hunt

- Dependencies the stdlib or platform already ships, or used for one call.
- Two helpers doing the same job in different folders.
- Interfaces with one implementation, factories with one product, wrappers
  that only delegate.
- Flags, options, and config keys nothing sets.
- Exported functions with no importer.

## Output

One line per finding, ranked:

`<tag> <what to cut>. <replacement>. [path] evidence: <search or usage that proves it>`

Then two groups:

- **Safe now:** confirmed by search, no behavior change.
- **Needs a decision:** requires measurement, a product call, or touches a public API.

End with `net: -<N> lines, -<M> deps possible.` Nothing to cut:
`Lean already. Ship.`

## Boundaries

Complexity only; correctness, security, and performance belong elsewhere.
Lists findings, applies nothing. One-shot.

---
name: weave-review
description: >
  Review the current diff for avoidable complexity and scope drift: duplicated
  mechanisms, speculative abstractions, reinvented stdlib, dependencies the
  platform already covers, and changes outside the request contract. One line
  per finding. Use when the user says "weave review", "/weave-review",
  "simplification review", "what can we remove from this change", or "is this
  over-engineered". Reports only, edits nothing.
---

# Weave Review

Review only the current diff (`git diff` plus staged changes) and the direct
callers it touches. Do not edit files.

## Format

`<file>:L<line>: <tag> <what>. <replacement>.`

Tags:

- `delete:` dead code, unused option, speculative feature. Replacement: nothing.
- `reuse:` re-implements something already in this repo. Name the existing helper and its path.
- `stdlib:` hand-rolled thing the standard library ships. Name the function.
- `native:` dependency or code doing what the platform already does. Name the feature.
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` same logic, fewer lines. Show the shorter form.
- `shared:` fix applied at one call site while the cause lives in a shared function. Name the function.
- `scope:` change not required by the request contract in `.weave/state.md` (or the user's request). Revert it.

## Examples

- `core/date.js:L12-30: native: moment imported for one format call. Intl.DateTimeFormat, 0 deps.`
- `api/users.js:L44: reuse: new pagination helper. lib/paginate.js already does this.`
- `checkout.js:L88: shared: null guard added here only. Guard once in getCart(), all 4 callers covered.`
- `README.md:L10-40: scope: unrelated rewrite of the install section. Not requested; revert.`

## Scoring

Rank by impact, biggest first. End with `net: -<N> lines possible.`

Nothing to cut: `Lean already. Ship.`

## Boundaries

Complexity and scope only. Correctness bugs and security issues go to a
normal review; mention them in one line at the end if you saw one, without
analysis. A small test or self-check is the minimum, never flag it for
deletion. Lists findings, applies nothing.

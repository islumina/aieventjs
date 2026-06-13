# aieventjs Review

Current review state after the 2026-06-10 ai*js pass.

## Current Known Issues / Backlog

| Priority | Area | Status | Notes |
| --- | --- | --- | --- |
| P2 | Throttle clock | Open | `throttleMs` uses `Date.now()`. Clock regression can mute handlers until wall time catches up. |
| P3 | Wildcard once typing | Open | Public overload excludes `once("*")`, but unsafe casts can still reach runtime wildcard behavior. Prefer `on("*", ..., { once: true })`. |

## Fixed Summary

- Wildcard handler ordering and once cleanup are covered by tests.
- Typed array/payload truncation concerns from older reviews are resolved.
- STABILITY and README no longer overstate unimplemented async handler tracking.

## Verification Baseline

- `pnpm typecheck`
- `pnpm test`
- `pnpm verify:docs`
- `pnpm verify:exports`
- `pnpm verify:llms`
- `pnpm check:size`

# aieventjs Review

Current review state after the 2026-06-10 ai*js pass.

## Current Known Issues / Backlog

| Priority | Area | Status | Notes |
| --- | --- | --- | --- |
| P2 | Throttle clock | Fixed | Switched `Date.now()` → `performance.now()` (monotonic) in both throttle gates in `emit()`. JSDoc updated. Regression tests in `test/throttle-monotonic.test.ts`. |
| P3 | Wildcard once typing | Fixed | Added `once(type: "*", handler: never): never` rejection overload to `Emitter<Events>`. `once("*", h)` is now a compile-time type error. Supported path remains `on("*", h, { once: true })`. Tests in T03 block of `emitter.test.ts`. |

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

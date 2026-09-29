# aieventjs Review

Current review state after the 2026-09-28 ai*js pass.

## Current Known Issues / Backlog

| Priority | Area | Status | Notes |
| --- | --- | --- | --- |
| P3 | `once("*")` typing gap on index-signature Events | Open | The `once(type: "*", handler: never): never` rejection overload does not reject `once("*", h)` for an `Events` map with a string index signature (e.g. default `createEmitter()`), so it silently type-checks and registers a wildcard-once at runtime with `payload` typed as the event name. Fix: exclude `"*"` from the typed overloads' key constraint (`K extends Exclude<keyof Events, '*'>`). Deferred: changes the public overload signature (apiChange). |
| P3 | Capture callback gets non-string `type` for numeric Events keys | Open | `captureHandlerErrors`/`captureErrors` callbacks are typed and documented as receiving the event name as `string`, but `emit()` passes the raw key through; an `Events` map with a numeric literal key (e.g. `{ 404: string }`) delivers a `number` at runtime. Fix: coerce the key to string before calling the policy callback. Deferred: the coercion (`String(k)`/`k + ""`) pushed `dist/index.js` from 1149 B to ~1154-1157 B gzip, over the 1150 B budget, which has only ~1 B of headroom after this pass's other fixes. |

## Fixed Summary

- Wildcard handler ordering and once cleanup are covered by tests.
- Typed array/payload truncation concerns from older reviews are resolved.
- STABILITY and README no longer overstate unimplemented async handler tracking.
- Throttle clock: switched `Date.now()` → `performance.now()` (monotonic) in both throttle gates in `emit()`. JSDoc updated. Regression tests in `test/throttle-monotonic.test.ts`.
- Wildcard once typing: added `once(type: "*", handler: never): never` rejection overload to `Emitter<Events>`. `once("*", h)` is now a compile-time type error for literal-keyed Events maps. Supported path remains `on("*", h, { once: true })`. Tests in T03 block of `emitter.test.ts`.
- AbortSignal removal on a typed subscription now prunes the empty handler array from the internal Map (no unbounded Map growth for churning event names); routed abort-driven removal through the same prune step as the returned unsubscribe function.
- A `once` handler consumed by a re-entrant `emit()` (triggered from within another handler) no longer fires a second time when the outer dispatch's snapshot still holds it; the entry is made inert on first invocation.
- `sub()` no longer leaves a partial subscription (entry pushed, no usable unsubscribe) when `signal` is `null` or an otherwise-invalid `AbortSignal`; `null` is now treated the same as `undefined`, matching `on()`'s own `sig?.aborted` guard.
- README_ZHTW.md's `throttleMs` note updated from the stale `Date.now()` wording to match the monotonic `performance.now()` behavior already documented in README.md/STABILITY/CHANGELOG.
- README.md and README_ZHTW.md's Sharp Edges note on post-dispose behavior corrected: only `dispose()` itself and previously returned unsubscribe functions are no-ops after dispose; `off()`/`clear()` (and `on`/`once`/`emit`) throw `EmitterDisposedError` like everything else.
- Added regression tests pinning three previously-untested documented-intentional `emit()` behaviors: a wildcard handler already in the dispatch snapshot still fires after a typed sibling calls `dispose()` mid-emit; a throttled handler that throws still consumes its throttle window; `throttleMs: Infinity` is rejected at `on()` time (typed and wildcard).

## Verification Baseline

- `pnpm typecheck`
- `pnpm test`
- `pnpm verify:docs`
- `pnpm verify:exports`
- `pnpm verify:llms`
- `pnpm check:size`

# aieventjs Review

Current review state after the 2026-09-29 ai*js 0.6.0 pass. Fixed findings are summarised; only still-open risks remain in the backlog.

## Current Known Issues / Backlog

| Priority | Area | Status | Notes |
| --- | --- | --- | --- |
| P3 | Numeric and string spellings of one key on explicit index-signature maps | Deferred | For an `Events` map written with an explicit index signature (`{ [k: string]: T }`), `keyof Events` is `string \| number`, so `on("404", h)` and `emit(404, x)` both type-check but are different events at runtime (`h` never fires). Literal-keyed maps and the default `createEmitter()` map are not affected. Deferred: the 0.6.0 decision keeps the raw key for typed handlers, wildcard handlers and the internal map (only capture callbacks get `String(type)`); coercing every key would change the wildcard `type` argument and is best decided with the 1.0 surface freeze. |
| P3 | `emit(type)` for `void` payload events | Deferred | `emit("scene/end")` on a `"scene/end": void` event does not type-check (TS2554); callers must write `emit("scene/end", undefined)`. Deferred: an optional-payload `emit` overload is an API addition outside the 0.6.0 decisions; decide it with the 1.0 surface freeze. |

## Fixed Summary

- Re-entrancy (0.6.0, ai*js fan-out rule): every removal path (unsubscribe, abort, `off`, `clear`, `dispose`) makes the entry inert, so a dispatch whose snapshot still holds it skips it; nested `emit()` runs depth-first to completion; `once` entries go inert before their first call. Pinned by G5-G10, capture F1 and `prop4`. Breaking: removed handlers used to receive the in-flight event.
- `once("*")` (0.6.0, P3): the `handler: never` rejection overload (which never rejected `"*"` on index-signature maps) is replaced by a wildcard overload declared first; `once("*", h)` equals `on("*", h, { once: true })` for every `Events` map. T03 pins the types and runtime.
- Capture callback key (0.6.0, P3): callbacks receive `String(type)`, so numeric keys arrive as strings and symbol keys no longer make the report vanish; the duplicated sample/throttle gate in `emit()` was hoisted into one `gate()` to pay for it.
- Argument validation (0.6.0): `on()` / `once()` throw `EmitterError` for a non-function handler and a non-`AbortSignal` `signal` before anything is registered; option messages use `aieventjs: <subject> must be <constraint>`.
- The typed handler list is mapped only after the signal is wired, so a throwing `addEventListener` leaves no empty map key.
- Package `exports` nest `types` under `import` / `require` with `require.types` at `dist/index.d.cts` (TS1479 fix for `node16` CommonJS); `verify-exports` walks nested conditions.
- `pnpm typecheck` covers `test/` (it inherited `exclude: ["test"]`), so `expectTypeOf` and typed-assignment assertions are enforced.
- Typed and wildcard subscriptions share one code path: `dist/index.js` is 1,062 B gzip (from 1,149 B) under the unchanged 1,150 B budget.
- Map key pruning on unsubscribe, `off(type, handler)` and abort, with an identity guard against stale unsubscribes (0.5.9 / 2026-09-28).
- `null` signal treated like `undefined`; re-entrant `once` never fires twice (2026-09-28).
- Throttle clock is monotonic (`performance.now()`, 0.5.8); a throwing throttled handler still consumes its window; `throttleMs: Infinity` is rejected.
- Wildcard ordering, once cleanup and typed array truncation are covered by tests; README/STABILITY no longer overstate async handler tracking or post-dispose no-ops.

## Closed Without Change

- `on("*", oneParameterHandler)` on the default map: TypeScript already resolves inline handlers to the wildcard overload (the parameter is the event name), so the `on()` overload order needs no change.
- Explicit `{ signal: undefined }` under `exactOptionalPropertyTypes`: `OnOptions` keeps the family and DOM shape `signal?: AbortSignal`; the runtime treats `undefined` and `null` as no signal (E6/E7).

## Verification Baseline

- `pnpm typecheck`
- `pnpm test`
- `pnpm verify:docs`
- `pnpm verify:exports`
- `pnpm verify:llms`
- `pnpm check:size`
- `pnpm prepublishOnly` (all of the above plus lint, coverage thresholds and build)

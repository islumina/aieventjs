# Changelog

All notable changes to aieventjs are summarized here.

## [0.6.0] - 2026-09-29

### Breaking

- `emit()`: a handler removed during a dispatch (by a sibling's unsubscribe function, `off()`, `clear()`, `dispose()` or an aborted `signal`) is now skipped for the rest of that dispatch instead of still receiving the in-flight event, per the ai*js fan-out re-entrancy rule. Migration: if a removed handler must still see the current event, remove it after `emit()` returns (for example `queueMicrotask(off)`), and do not rely on the remaining handlers running after a mid-dispatch `dispose()`.
- `on()` / `once()`: a `handler` that is not a function, or a `signal` without `addEventListener` / `removeEventListener`, now throws `EmitterError` before anything is registered, instead of registering a handler that threw a bare `TypeError` at every `emit()` (or was silently swallowed under `captureHandlerErrors`) or throwing a bare `TypeError` from `on()`. Migration: pass a function and a real `AbortSignal` (or omit `signal`), and catch `EmitterError` where you caught `TypeError`.

### Changes

- Changed: `once("*", handler)` is now a typed overload, declared before the typed one and equivalent to `on("*", handler, { once: true })` (the handler receives `(type, payload)`, fires after typed handlers and goes inert before it is called); this reverses the 0.5.8 compile-time rejection, which never rejected `"*"` on index-signature maps such as the default `createEmitter()` map and there typed the event name as the payload.
- Changed: `EmitterError` messages follow the ai*js shape `aieventjs: <subject> must be <constraint>` (`captureErrors must be unset on *`, `sampleRate must be unset on typed events`, `throttleMs must be a finite number >= 0`); match on the class plus a regex rather than the exact text.
- Changed: `dist/index.js` shrinks from 1,149 B to 1,062 B gzip (budget unchanged at 1,150 B): typed and wildcard subscriptions share one registration path, one removal helper and one per-dispatch gate.
- Fixed: aborting a typed subscription's `AbortSignal` now prunes the empty handler array from the internal Map, the same as the returned unsubscribe function; previously only unsubscribe pruned, leaving one Map entry behind per aborted, unique event name.
- Fixed: a `once` handler consumed by a re-entrant `emit()` (called from within another handler during the same outer dispatch) no longer fires a second time when the outer dispatch's snapshot still holds it.
- Fixed: `on(type, handler, { signal })` no longer leaves a registered-but-unusable subscription when `signal` is `null` (or another invalid/throwing `AbortSignal`); `null` is now treated the same as `undefined`.
- Fixed: `captureHandlerErrors` / `captureErrors` callbacks now always receive the event name as a string, as typed and documented; a numeric `Events` key (e.g. `{ 404: string }`) used to arrive as a `number`, and a symbol key now arrives as `String(symbol)`. Handlers, wildcard handlers and the internal map keep the raw key.
- Fixed: `on()` with a `signal` whose `addEventListener` throws no longer leaves an empty handler list for that event name in the internal map.
- Fixed: `package.json` `exports` nests `types` under `import` and `require` (`require.types` points at `dist/index.d.cts`), so `node16` / `nodenext` CommonJS consumers no longer hit TS1479; `verify-exports` walks nested conditions.
- Fixed: `pnpm typecheck` now type-checks `test/` (the test tsconfig inherited `exclude: ["test"]`), so the suite's compile-time assertions are enforced.
- Docs: README.md and README_ZHTW.md's Sharp Edges note corrected — only `dispose()` itself and previously returned unsubscribe functions are no-ops after dispose; `off()`/`clear()` throw `EmitterDisposedError` like every other post-dispose call.
- Docs: README_ZHTW.md's `throttleMs` note updated to match the monotonic `performance.now()` behavior already documented elsewhere; it previously still described the stale `Date.now()` wall-clock caveat.
- Docs: STABILITY.md's "Behavior" section becomes the family "Behavioral Contract" and states the re-entrancy clause, the removal paths and the misuse errors; README and README_ZHTW Sharp Edges mirror it, and the Options line now says `captureErrors` is typed-only.

## [0.5.9] - 2026-06-29

- Fixed: per-handler unsubscribe now prunes the empty handler array from the typed-handler map (no unbounded growth on high-cardinality / churning event names), with a Map-identity guard so a stale or double unsubscribe after re-subscribing cannot delete a live key.
- Docs: `throttleMs` is documented as monotonic (`performance.now()`); removed the stale wall-clock caveat.

## [0.5.8] - 2026-06-14

- Fixed: per-handler `throttleMs` now uses the monotonic `performance.now()` clock instead of `Date.now()`, so a wall-clock regression can no longer silently mute throttled handlers.
- Changed: `once("*")` is now a compile-time type error; use `on("*", handler, { once: true })` for wildcard-once semantics.
- Documentation-only slimming pass across README, stability notes, review backlog, and LLM context.

## [0.5.6] - 2026-06-10

- Hardened wildcard/once documentation and wall-clock throttle caveats.
- Kept typed dispatch, wildcard dispatch, and AbortSignal behavior stable.
- Regenerated generated LLM context from canonical docs.

## Older releases

- `0.5.5` through `0.5.1` focused on release hygiene, docs accuracy, and regression tests for wildcard/once/error behavior.
- `0.4.0` declared the stable ai*js surface.
- `0.3.x` added sampling, throttle, capture-error options, and public stability docs.
- `0.1.x` introduced `createEmitter`, typed `on/once/off/emit`, wildcard handlers, abort cleanup, and dispose semantics.

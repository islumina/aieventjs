# Changelog

All notable changes to aieventjs are summarized here.

## [Unreleased]

- Fixed: aborting a typed subscription's `AbortSignal` now prunes the empty handler array from the internal Map, the same as the returned unsubscribe function; previously only unsubscribe pruned, leaving one Map entry behind per aborted, unique event name.
- Fixed: a `once` handler consumed by a re-entrant `emit()` (called from within another handler during the same outer dispatch) no longer fires a second time when the outer dispatch's snapshot still holds it.
- Fixed: `on(type, handler, { signal })` no longer leaves a registered-but-unusable subscription when `signal` is `null` (or another invalid/throwing `AbortSignal`); `null` is now treated the same as `undefined`.
- Docs: README.md and README_ZHTW.md's Sharp Edges note corrected — only `dispose()` itself and previously returned unsubscribe functions are no-ops after dispose; `off()`/`clear()` throw `EmitterDisposedError` like every other post-dispose call.
- Docs: README_ZHTW.md's `throttleMs` note updated to match the monotonic `performance.now()` behavior already documented elsewhere; it previously still described the stale `Date.now()` wall-clock caveat.

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

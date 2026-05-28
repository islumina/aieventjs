# aieventjs Stability Index

Tags follow Node's stability index conventions:

- `[stable]` — frozen API, semver-protected.
- `[experimental]` — usable but may change without major bump in 0.x; will stabilise pre-1.0.
- `[draft]` — placeholder; API not yet shipped.

## Public API

| Surface | Stability | Since |
|---|---|---|
| `createEmitter<Events>(opts?)` | [stable] | 0.1.0 |
| `on / once / off / emit / clear / dispose / disposed` | [stable] | 0.1.0 |
| `on(type, handler, { signal })` (AbortSignal) | [stable] | 0.1.0 |
| Wildcard `"*"` handler | [stable] | 0.1.0 |
| `EmitterOptions.captureHandlerErrors` (boolean) | [stable] | 0.3.0 |
| `EmitterOptions.captureHandlerErrors` (callback) | [stable] | 0.3.0 |
| `OnOptions.captureErrors` | [stable] | 0.3.0 |
| `OnOptions.sampleRate` (wildcard only) | [stable] | 0.3.0 |
| `OnOptions.throttleMs` (wildcard only) | [stable] | 0.3.0 |
| `EmitterError` / `EmitterDisposedError` | [stable] | 0.1.0 |

## Drafts (not yet implemented)

### Async handler tracking — [experimental] placeholder

Targeted for v0.6+. Concept sketch (subject to change):

```ts
// possibly via a new emitter option
createEmitter<Events>({
  awaitAsyncHandlers: true,
});
// emit() may return a Promise that resolves after Promise.allSettled over
// any handler that returned a Promise. Sync handlers run synchronously
// before any awaiting begins. Snapshot semantics preserved.
```

Not part of v0.3.0; do not depend on this API. The current `emit()` remains
fully synchronous and ignores handler return values.

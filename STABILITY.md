# aieventjs Stability Index

## Stable API

| Surface | Status | Notes |
| --- | --- | --- |
| `createEmitter(options?)` | Stable | Generic typed event map. |
| `Emitter.on` | Stable | Typed and wildcard overloads; returns unsubscribe. |
| `Emitter.once` | Stable | Typed events only; wildcard once uses `on("*", ..., { once: true })`. |
| `Emitter.off`, `clear`, `dispose` | Stable | Cleanup methods; dispose is permanent and idempotent. |
| `Emitter.emit` | Stable | Synchronous snapshot dispatch. |
| Error classes | Stable | `EmitterError`, `EmitterDisposedError`. |

## Behavior

- Type-matched handlers run before wildcard handlers.
- Handler lists are snapshotted before dispatch.
- Default handler errors propagate; capture options can swallow/report.
- `AbortSignal` removes subscriptions and pre-aborted signals do not register.
- `throttleMs` uses `performance.now()` (monotonic) and is unaffected by system-clock corrections.

## Drafts

- Async handler tracking is not implemented.

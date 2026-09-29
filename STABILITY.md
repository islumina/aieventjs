# aieventjs Stability Index

## Stable API

| Surface | Status | Notes |
| --- | --- | --- |
| `createEmitter(options?)` | Stable | Generic typed event map. |
| `Emitter.on` | Stable | Typed and wildcard overloads; returns unsubscribe. |
| `Emitter.once` | Stable | Typed and wildcard overloads; `once(type, handler)` equals `on(type, handler, { once: true })`, including `"*"`. |
| `Emitter.off`, `clear`, `dispose` | Stable | Cleanup methods; dispose is permanent and idempotent. |
| `Emitter.emit` | Stable | Synchronous snapshot dispatch. |
| Error classes | Stable | `EmitterError`, `EmitterDisposedError`. |

## Behavioral Contract

- Type-matched handlers run before wildcard handlers.
- Handler lists are snapshotted before dispatch.
- A nested `emit()` from inside a handler runs synchronously to completion before the outer dispatch resumes; the outer dispatch continues over its pre-taken snapshot, skipping handlers removed meanwhile; `once` handlers go inert before their first call.
- Every removal path counts for that skip: the returned unsubscribe function, `off`, `clear`, `dispose` and an aborted `signal`. Nested dispatch is never rejected or queued; there is no mailbox.
- Default handler errors propagate; capture options can swallow/report. Capture callbacks always receive the event name as a string (`String(type)`); handlers keep numeric or symbol keys as they are.
- Misuse is reported by `on()` / `once()` with `EmitterError` and a message of the form `aieventjs: <subject> must be <constraint>`, checked before anything is registered: a handler that is not a function, a `signal` that is not an `AbortSignal`, `captureErrors` on `"*"`, `sampleRate` on a typed event or outside `(0, 1]`, and a `throttleMs` that is not a finite number `>= 0`.
- `AbortSignal` removes subscriptions and pre-aborted signals do not register.
- `throttleMs` uses `performance.now()` (monotonic) and is unaffected by system-clock corrections.

## Drafts

- Async handler tracking is not implemented.

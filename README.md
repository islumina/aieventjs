# aieventjs

Small, strict, typed event emitter with ai*js lifecycle conventions: `on()` returns unsubscribe, `once` is built in, `AbortSignal` is first-class, wildcard handlers are supported, and `dispose()` is idempotent.

> **Status: 0.6.0 - stable 1.0-track surface.** The root entry is the public API.

## Install

```bash
pnpm add aieventjs
```

```ts
import { createEmitter } from "aieventjs";
```

## Quick Start

```ts
type Events = {
  "score/change": { value: number };
  "scene/end": void;
};

const events = createEmitter<Events>();

const off = events.on("score/change", ({ value }) => {
  console.log(value);
});

events.on("*", (type, payload) => console.log(type, payload), { sampleRate: 0.1 });
events.emit("score/change", { value: 10 });
off();
events.dispose();
```

## Core API

- `createEmitter<Events>(options?)` creates a typed emitter.
- `on(type, handler, options?)` subscribes and returns an unsubscribe function.
- `on("*", wildcard, options?)` subscribes to every event after type-matched handlers.
- `once(type, handler)` is shorthand for `on(type, handler, { once: true })`, for typed events and `"*"` alike.
- `off(type, handler?)`, `clear()`, and `dispose()` remove handlers at different scopes.
- `emit(type, payload)` dispatches synchronously over a snapshot of handlers.
- Options: `signal`, `once`, `captureErrors` for typed, `sampleRate` for wildcard, `throttleMs` for typed and wildcard.

## Sharp Edges

- Default error policy is mitt-like: the first throwing handler aborts dispatch. Use `captureHandlerErrors` or per-handler `captureErrors` to swallow/report and continue; report callbacks always get the event name as a string.
- Wildcard handlers receive `(type, payload)`, not just payload.
- `once("*", handler)` is equivalent to `on("*", handler, { once: true })`.
- A nested `emit()` from a handler runs to completion before the outer dispatch resumes; the outer dispatch skips handlers removed meanwhile (unsubscribe, `off`, `clear`, `dispose`, abort), and `once` handlers go inert before their first call.
- `throttleMs` uses `performance.now()` (monotonic); system-clock corrections do not affect throttle windows.
- `sampleRate` is wildcard-only and uses `Math.random()` per dispatch.
- Misuse throws `EmitterError` from `on()`/`once()` before anything is registered: a handler that is not a function, a `signal` that is not an `AbortSignal`, or an invalid option.
- `dispose()` is permanent; after it, `on`/`once`/`emit`/`off`/`clear` all throw `EmitterDisposedError`. Only `dispose()` itself and previously returned unsubscribe functions are safe no-ops post-dispose.

## AI Context

- Short index: [`llms.txt`](llms.txt)
- Full generated context: [`llms-full.txt`](llms-full.txt)
- Stability contract: [`STABILITY.md`](STABILITY.md)
- Current review backlog: [`REVIEW.md`](REVIEW.md)
- Release history: [`CHANGELOG.md`](CHANGELOG.md)

## License

MIT

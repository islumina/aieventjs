# aieventjs

Small, strict, typed event emitter with ai*js lifecycle conventions: `on()` returns unsubscribe, `once` is built in, `AbortSignal` is first-class, wildcard handlers are supported, and `dispose()` is idempotent.

> **Status: 0.5.9 - stable 1.0-track surface.** The root entry is the public API.

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
- `once(type, handler)` is shorthand for a one-shot typed handler.
- `off(type, handler?)`, `clear()`, and `dispose()` remove handlers at different scopes.
- `emit(type, payload)` dispatches synchronously over a snapshot of handlers.
- Options: `signal`, `once`, `captureErrors`, `sampleRate` for wildcard, `throttleMs` for typed and wildcard.

## Sharp Edges

- Default error policy is mitt-like: the first throwing handler aborts dispatch. Use `captureHandlerErrors` or per-handler `captureErrors` to swallow/report and continue.
- Wildcard handlers receive `(type, payload)`, not just payload.
- Use `on("*", handler, { once: true })` for wildcard-once. `once("*")` is intentionally not part of the typed public overload.
- `throttleMs` uses `performance.now()` (monotonic); system-clock corrections do not affect throttle windows.
- `sampleRate` is wildcard-only and uses `Math.random()` per dispatch.
- `dispose()` is permanent; post-dispose APIs throw `EmitterDisposedError` except cleanup calls that are no-ops by design.

## AI Context

- Short index: [`llms.txt`](llms.txt)
- Full generated context: [`llms-full.txt`](llms-full.txt)
- Stability contract: [`STABILITY.md`](STABILITY.md)
- Current review backlog: [`REVIEW.md`](REVIEW.md)
- Release history: [`CHANGELOG.md`](CHANGELOG.md)

## License

MIT

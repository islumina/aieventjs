# aieventjs

[![npm version](https://img.shields.io/npm/v/aieventjs.svg)](https://www.npmjs.com/package/aieventjs)
[![CI](https://github.com/yshengliao/aieventjs/actions/workflows/ci.yml/badge.svg)](https://github.com/yshengliao/aieventjs/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](LICENSE)
[![AI Generated](https://img.shields.io/badge/AI_Generated-Claude_Code_Opus_4.7_Max-blueviolet.svg)](https://www.anthropic.com/claude-code)
[![繁體中文](https://img.shields.io/badge/lang-繁體中文-red.svg)](README_ZHTW.md)

> A small, strict, typed event emitter — `on()` returns an unsubscribe function, `once` is built-in, `AbortSignal` is first-class, `dispose()` is idempotent, wildcard `*` handlers are preserved. Mitt-shaped API where it counts; ai\*js conventions everywhere else.

Part of the [ai\*js micro-runtime ecosystem](https://github.com/yshengliao) — see also [aifsmjs](https://github.com/yshengliao/aifsmjs) (FSM), [aiecsjs](https://github.com/yshengliao/aiecsjs) (ECS), [aibridgejs](https://github.com/yshengliao/aibridgejs) (cross-context RPC), [aipooljs](https://github.com/yshengliao/aipooljs) (object pool), [aiquadtreejs](https://github.com/yshengliao/aiquadtreejs) (spatial partitioning), and [aiaudiojs](https://github.com/yshengliao/aiaudiojs) (Web Audio shell).

> **Status: 0.1.0.** First npm release. Full implementation shipped; all methods are live. Coverage ≥ 95/90/100/100; ≤ 800 B gzip.

---

## Why aieventjs

Why not just use `mitt`? Honest answer: `mitt` is the right choice for many projects — it's MIT, ~282 B gzipped, and the API is genuinely well-shaped. We evaluated it and chose to write from scratch instead. Three reasons (full evaluation in [LEARNINGS.md](../LEARNINGS.md)):

- **mitt has been unmaintained since 2023-07-04.** The PRs the community most wants — `unsubscribe`-returning `on()`, `AbortSignal`, `sideEffects: false`, nodenext compatibility — are all open and untouched. Forking would mean shipping a copy with our name on it; the upstream couldn't accept improvements back even if we wanted.
- **The implementation is ~35 lines of pure logic.** "Fork and improve" doesn't really exist at that size class — any non-trivial change is a rewrite, and the cost of carrying the upstream copyright notice exceeds the benefit.
- **ai\*js conventions are pervasive enough that fitting them onto mitt's API surface would change every method signature.** `on()` returning `void` vs. returning an unsubscribe is the visible difference; the strict TypeScript posture (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no `!` non-null assertions) is the invisible one that touches every line.

So `aieventjs` is the ai\*js-shaped event emitter:

- **`on()` returns an unsubscribe function.** Cleanup via the standard "call this to undo" idiom — closes over nothing, survives handler renames, drops in to `$effect()` / `onScopeDispose()` / `useEffect` cleanup without ceremony.
- **`AbortSignal` everywhere it makes sense.** `on(type, handler, { signal })` removes the handler when the signal aborts. Pre-aborted signals never register. The whole library uses the same cancellation primitive as `fetch` and the rest of the platform.
- **`dispose()` is idempotent.** Post-dispose `on` / `emit` / `once` throw `EmitterDisposedError`. This is the family-wide convention; an emitter that "looks alive but does nothing" after teardown is the canonical leak vector and we refuse to ship it.
- **Wildcard `*` is preserved.** `bus.on("*", (type, payload) => ...)` works exactly like in `mitt`; wildcard handlers fire AFTER type-matched handlers. ~80 B gzip cost; kept to make migration mechanical.
- **Handler-array snapshot on `emit`.** Removing a handler inside its own callback does not skip subsequent handlers (mitt has this since 2.x; preserved).
- **Functional, destructurable.** `const { on, emit } = bus` works — no `this` capture anywhere.

What this is **not**: not an async event bus (handlers are synchronous), not a namespaced bus (`user.*` style wildcards are out), not a priority queue, not a transport. It is the in-process synchronous fan-out primitive — nothing more.

---

## Quick Start

```bash
pnpm add aieventjs
```

```typescript
import { createEmitter } from "aieventjs";

type Events = {
  "user:login":  { id: string };
  "user:logout": void;
  "score:tick":  { delta: number };
};

const bus = createEmitter<Events>();

// 1. Subscribe; capture the unsubscribe handle.
const off = bus.on("user:login", (u) => console.log("hi", u.id));

// 2. Or wire to an AbortSignal for framework-native cleanup.
const ctrl = new AbortController();
bus.on("score:tick", (e) => render(e.delta), { signal: ctrl.signal });

// 3. Wildcard receives (type, payload) — fires AFTER type-matched handlers.
bus.on("*", (type, payload) => trace(type, payload));

// 4. Dispatch.
bus.emit("user:login", { id: "alice" });

// 5. Tear down.
off();
ctrl.abort();
bus.dispose(); // idempotent; post-dispose calls throw EmitterDisposedError
```

`createEmitter()` returns a plain object whose methods do not depend on `this` — `const { on, emit } = bus` works fine.

---

## Capabilities / Limitations

| Will do (v1)                                              | Won't do                                              |
| --------------------------------------------------------- | ----------------------------------------------------- |
| Typed `createEmitter<Events>()`                           | Untyped string-key bus (the type is the point)        |
| `on()` returns unsubscribe function                       | Async / promise-returning handlers (sync only)        |
| `once(type, handler)` + `on(..., { once: true })`         | Namespaced wildcards (`"user.*"`) — out of scope      |
| `on(..., { signal })` — `AbortSignal` cleanup             | Priority / weight / ordering hints                    |
| Wildcard `"*"` handler — `(type, payload)`                | Cross-context transport (use `aibridgejs` for that)   |
| `dispose()` idempotent; post-dispose calls throw          | Error-event special casing (Node EventEmitter style)  |
| Handler-array snapshot on `emit` (safe re-entrancy)       | Persistent storage / replay (not its job)             |
| Destructurable methods (`const { on, emit } = bus`)       | Zero-allocation `emit` (one snapshot per dispatch is required for re-entrancy) |

---

## API sketch

```typescript
type EventHandler<P> = (payload: P) => void;

type WildcardHandler<Events extends Record<string, unknown>> =
  <K extends keyof Events>(type: K, payload: Events[K]) => void;

interface OnOptions {
  signal?: AbortSignal;
  once?: boolean;
}

interface EmitterOptions {
  // Reserved for 0.2.0 — collect throwing handlers into an AggregateError
  // instead of aborting the dispatch. Ignored in 0.1.0.
  captureHandlerErrors?: boolean;
}

interface Emitter<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>, opts?: OnOptions): () => void;
  on(type: "*", handler: WildcardHandler<Events>, opts?: OnOptions): () => void;
  once<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void;
  off<K extends keyof Events>(type: K, handler?: EventHandler<Events[K]>): void;
  off(type: "*", handler?: WildcardHandler<Events>): void;
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
  clear(): void;
  dispose(): void;
  readonly disposed: boolean;
}

class EmitterError extends Error {}
class EmitterDisposedError extends Error {}

function createEmitter<Events extends Record<string, unknown> = Record<string, unknown>>(
  opts?: EmitterOptions,
): Emitter<Events>;
```

Full JSDoc lives in [`src/index.ts`](src/index.ts).

---

## Roadmap

| Version    | Adds                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **0.0.1**  | Scaffold landed — frozen API surface as a `throw` stub; full config + CI walk clean.                                                |
| **0.1.0**  | First npm release. `on` / `once` / `off` / `emit` / `clear` / `dispose` implemented; coverage ≥ 95/90/100/100; ≤ 800 B gzip (strict-TS overhead lands at ~747 B). |
| **0.2.0**  | `captureHandlerErrors` option — collect throwing handlers into an `AggregateError` instead of aborting the dispatch. Opt-in.        |
| **0.3+**   | TBD — driven by integration feedback. Candidates: typed channel groups, structured-clone payload check, batch `emit`.               |

---

## License

[MIT](LICENSE).

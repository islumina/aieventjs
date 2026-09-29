// aieventjs — small, strict, typed event emitter for the ai*js family.
//
// Mitt-shaped API: snapshot dispatch (handlers removed mid-dispatch are
// skipped, per the ai*js fan-out rule), wildcard "*" handler, AbortSignal
// integration, once, idempotent dispose, destructurable methods (no `this`).

/**
 * Configuration for {@link createEmitter}. Controls the default error
 * policy for handlers thrown during `emit()`; per-handler
 * {@link OnOptions.captureErrors} overrides this default.
 *
 * @public
 */
export interface EmitterOptions {
  /**
   * Default error policy for all handlers when they throw during emit().
   *
   *  - undefined / false (default) — first throw aborts dispatch (mitt-compatible).
   *  - true — swallow; dispatch continues over all handlers in the snapshot.
   *  - (err, type, payload) => void — invoked with the unknown error, the
   *    event name as a string (numeric and symbol keys are converted with
   *    `String()`), and the payload as unknown. If this callback itself
   *    throws, the error is silently ignored.
   *
   * Per-subscription OnOptions.captureErrors overrides this for that handler.
   */
  captureHandlerErrors?: boolean | ((err: unknown, type: string, payload: unknown) => void);
}

/**
 * Handler invoked for a single typed event.
 *
 * @public
 */
export type EventHandler<Payload> = (payload: Payload) => void;

/**
 * Handler invoked for the wildcard `"*"` subscription. Receives the actual
 * event type alongside the payload.
 *
 * @public
 */
export type WildcardHandler<Events extends Record<string, unknown>> = <K extends keyof Events>(
  type: K,
  payload: Events[K],
) => void;

/**
 * Subscription options accepted by {@link Emitter.on}.
 *
 * @public
 */
export interface OnOptions {
  /**
   * Aborting this signal removes the handler. The same effect as calling
   * the returned unsubscribe function. Pre-aborted signals never register.
   * A value without `addEventListener` / `removeEventListener` throws
   * EmitterError; `null` is treated like `undefined`.
   */
  signal?: AbortSignal;

  /** Auto-remove the handler after the first dispatch. Equivalent to `once()`. */
  once?: boolean;

  /**
   * Override emitter-level captureHandlerErrors for this handler.
   *  - undefined — fall through to emitter-level.
   *  - false — force re-throw, even when emitter-level is true / callback.
   *  - true — swallow.
   *  - (err, type, payload) => void — same semantics as the emitter-level callback.
   *
   * Throws EmitterError if set on a wildcard "*" subscription.
   * @invariant does not break snapshot-before-iterate semantics.
   */
  captureErrors?: boolean | ((err: unknown, type: string, payload: unknown) => void);

  /**
   * Wildcard "*" only. Probability in (0, 1] that a dispatch reaches this
   * handler. Math.random() is sampled per dispatch. Values <= 0 or > 1 are
   * rejected at on() time.
   *
   * Throws EmitterError if set on a typed handler.
   */
  sampleRate?: number;

  /**
   * Per-handler leading-edge throttle. Minimum milliseconds between successive
   * calls to this handler. The first dispatch after subscription always fires;
   * subsequent dispatches within `throttleMs` are dropped (not queued).
   * Uses `performance.now()` (monotonic). 0 = no throttle. Non-finite or
   * negative values are rejected at `on()` time.
   *
   * Valid on both typed and wildcard `"*"` subscriptions (since v0.5.3); each
   * handler keeps its own throttle clock. Useful for per-event HUD throttling,
   * e.g. a `credits/change` event that fires every frame.
   *
   * @remarks
   * The throttle clock uses `performance.now()`, which is monotonic and
   * unaffected by system-clock corrections (NTP step-backs, manual adjustments).
   * This ensures handlers are never silently muted by a wall-clock regression.
   */
  throttleMs?: number;
}

/**
 * Strongly-typed event emitter. Subscribe with {@link Emitter.on} (returns
 * an unsubscribe function), dispatch with {@link Emitter.emit}, dispose
 * with {@link Emitter.dispose} when finished.
 *
 * @typeParam Events — a string-keyed map from event name to payload type.
 * @public
 */
export interface Emitter<Events extends Record<string, unknown>> {
  /**
   * Subscribe to a single event type. Returns an unsubscribe function;
   * calling it (or aborting `opts.signal`) removes the handler.
   */
  on<K extends keyof Events>(
    type: K,
    handler: EventHandler<Events[K]>,
    opts?: OnOptions,
  ): () => void;

  /**
   * Subscribe to every event with a single handler that receives
   * `(type, payload)`. Wildcard handlers fire AFTER type-matched
   * handlers — same ordering as `mitt`.
   */
  on(type: "*", handler: WildcardHandler<Events>, opts?: OnOptions): () => void;

  /**
   * Wildcard-once: subscribe to every event and auto-remove after the first
   * dispatch. Equivalent to `on("*", handler, { once: true })`: the handler
   * receives `(type, payload)`, fires after type-matched handlers, and goes
   * inert before it is called.
   *
   * @remarks
   * Declared before the typed overload so `"*"` always resolves here, even
   * when `Events` has a string index signature (EVT-B-02).
   */
  once(type: "*", handler: WildcardHandler<Events>): () => void;

  /**
   * Subscribe and auto-remove after the first dispatch. Equivalent to
   * `on(type, handler, { once: true })`.
   */
  once<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void;

  /**
   * Imperative unsubscribe. Prefer the unsubscribe function returned by
   * `on()` — it's faster (no reference lookup) and survives renames.
   * If `handler` is omitted, removes every handler for `type`.
   */
  off<K extends keyof Events>(type: K, handler?: EventHandler<Events[K]>): void;

  /**
   * Imperative wildcard unsubscribe.
   */
  off(type: "*", handler?: WildcardHandler<Events>): void;

  /**
   * Dispatch synchronously. Handlers receive `payload`; wildcard handlers
   * receive `(type, payload)`. Handler lists are snapshotted before iteration:
   * a handler added during the dispatch waits for the next `emit()`, and a
   * handler removed during it (unsubscribe, `off`, `clear`, `dispose` or an
   * aborted signal) is skipped for the rest of it. A nested `emit()` from a
   * handler runs to completion before the outer dispatch resumes. By default,
   * the first throwing handler aborts the dispatch; set
   * EmitterOptions.captureHandlerErrors (or per-handler OnOptions.captureErrors)
   * to swallow or report errors and continue.
   */
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;

  /**
   * Remove every handler for every event (including wildcards). The
   * emitter remains usable. Use {@link dispose} for permanent teardown.
   */
  clear(): void;

  /**
   * Idempotent teardown. Drops every handler; subsequent `on` / `once` /
   * `emit` / `off` / `clear` throw {@link EmitterDisposedError}.
   */
  dispose(): void;

  /** `true` once {@link dispose} has been called. */
  readonly disposed: boolean;
}

/**
 * Recoverable emitter error. Thrown by `on()` / `once()` before anything is
 * registered when `handler` is not a function, or when `OnOptions` violates a
 * precondition: `signal` is not an `AbortSignal`; `captureErrors` set on a
 * wildcard `"*"` subscription; `sampleRate` set on a typed subscription;
 * `sampleRate` outside `(0, 1]`; or `throttleMs` non-finite or negative.
 * Messages read `aieventjs: <subject> must be <constraint>`.
 *
 * @public
 */
export class EmitterError extends Error {
  override readonly name = "EmitterError";
}

/**
 * Thrown by `on`/`once`/`emit`/`off`/`clear` when called after
 * {@link Emitter.dispose}. `dispose()` itself never throws — it is
 * idempotent — and unsubscribe functions returned before dispose remain
 * safe no-ops afterward.
 *
 * @public
 */
export class EmitterDisposedError extends Error {
  override readonly name = "EmitterDisposedError";
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type ErrorPolicy = boolean | ((err: unknown, type: string, payload: unknown) => void);

// Stored handler shape: typed entries are called as h(payload), wildcard
// entries as h(type, payload).
type F = (...a: unknown[]) => void;

// One subscription (typed or wildcard). Short field names reduce minified
// output size. Fields are typed `T | undefined` so exactOptionalPropertyTypes
// permits assigning `undefined` (avoids TS2375 / TS2412).
interface E {
  h: F; // handler: the user's, a once-wrapper, or N once removed
  c: (() => void) | undefined; // abortCleanup
  u: F; // user-provided handler (off matching)
  ce: ErrorPolicy | undefined; // captureErrors override (typed only)
  r: number | undefined; // sampleRate (wildcard only)
  tm: number | undefined; // throttleMs (typed or wildcard; v0.5.3)
  ts?: number | undefined; // last call timestamp — mutated during dispatch (throttle clock)
}

// Inert handler swapped into every removed entry (see kill()).
const N: F = () => {};

// Detach an entry on every removal path (unsubscribe, abort, off, clear,
// dispose): run its abort cleanup and make it inert, so an emit() whose
// snapshot still holds the entry skips it for the rest of that dispatch
// (ai*js fan-out re-entrancy rule). Idempotent.
function kill(e: E): void {
  e.c?.();
  e.c = undefined;
  e.h = N;
}

// Detach every entry of an array (clear / dispose / off without handler).
function flush(arr: E[]): void {
  for (const e of arr) kill(e);
}

// Per-dispatch gate shared by the typed and wildcard loops of emit(): the
// wildcard-only sampleRate draw, then the leading-edge throttle. The throttle
// timestamp is written before the handler runs, so a throwing handler still
// consumes its window, and a sample miss never touches it.
function gate(e: E): boolean {
  if (e.r !== undefined && Math.random() >= e.r) return false;
  if (e.tm) {
    const now = performance.now();
    if (e.ts !== undefined && now - e.ts < e.tm) return false;
    e.ts = now;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Construct a strongly-typed event emitter.
 *
 * @remarks
 * Declare the event map with a `type` alias, not an `interface`. The `Events`
 * generic is constrained to `Record<string, unknown>`, and a *plain* TypeScript
 * `interface` has no implicit index signature, so it fails the constraint with
 * *"Index signature for type 'string' is missing in type ..."*. A `type` object
 * literal satisfies the constraint structurally. (An `interface` with an explicit
 * index signature or `extends Record<string, unknown>` also compiles, but widens
 * `keyof Events` to `string`, losing strict event-name checking.)
 *
 * ```ts
 * // ❌ interface — fails the Record<string, unknown> constraint
 * interface Events { "user:login": { id: string } }
 * const bus = createEmitter<Events>(); // TS2344
 *
 * // ✅ type — satisfies the constraint
 * type Events = { "user:login": { id: string } };
 * const bus = createEmitter<Events>();
 * ```
 *
 * @example
 * ```ts
 * import { createEmitter } from "aieventjs";
 *
 * type Events = {
 *   "user:login": { id: string };
 *   "user:logout": void;
 * };
 *
 * const bus = createEmitter<Events>();
 *
 * const off = bus.on("user:login", (u) => console.log("hi", u.id));
 * bus.emit("user:login", { id: "alice" });
 * off();
 *
 * bus.on("*", (type, payload) => console.log("event", type, payload));
 * ```
 *
 * @public
 */
export function createEmitter<Events extends Record<string, unknown> = Record<string, unknown>>(
  opts?: EmitterOptions,
): Emitter<Events> {
  const cap = opts?.captureHandlerErrors;

  const t: Map<string, E[]> = new Map();
  const w: E[] = [];
  let d = false;

  function ck(): void {
    if (d) throw new EmitterDisposedError("aieventjs: emitter has been disposed");
  }

  function on(type: string, handler: F, o?: OnOptions): () => void {
    ck();
    // Validate everything before any side effect; misuse is EmitterError with
    // the ai*js `aieventjs: <subject> must be <constraint>` message shape.
    // Cross-domain options: captureErrors is typed-only, sampleRate
    // wildcard-only; throttleMs is valid on both (v0.5.3, per-handler clock).
    const sr = o?.sampleRate;
    const tm = o?.throttleMs;
    const ce = o?.captureErrors;
    const wild = type === "*";
    if (typeof handler !== "function")
      throw new EmitterError("aieventjs: handler must be a function");
    if (wild) {
      if (ce !== undefined) throw new EmitterError("aieventjs: captureErrors must be unset on *");
    } else if (sr !== undefined)
      throw new EmitterError("aieventjs: sampleRate must be unset on typed events");
    if (sr !== undefined && (!Number.isFinite(sr) || sr <= 0 || sr > 1))
      throw new EmitterError("aieventjs: sampleRate must be in (0,1]");
    if (tm !== undefined && (!Number.isFinite(tm) || tm < 0))
      throw new EmitterError("aieventjs: throttleMs must be a finite number >= 0");
    // Duck-typed (not instanceof) so polyfilled and cross-realm signals pass;
    // `null` is treated like `undefined` here and below.
    const sig = o?.signal;
    if (
      sig &&
      (typeof sig.addEventListener !== "function" || typeof sig.removeEventListener !== "function")
    )
      throw new EmitterError("aieventjs: signal must be an AbortSignal");
    if (sig?.aborted) return () => {};

    // The checks above keep `ce` off wildcard entries and `r` off typed ones,
    // so one entry shape serves both lists.
    const arr = wild ? w : (t.get(type) ?? []);
    const e: E = { h: handler, u: handler, c: undefined, ce, r: sr, tm };
    const rm = () => {
      const i = arr.indexOf(e);
      if (i >= 0) arr.splice(i, 1);
      kill(e);
      // Prune an emptied typed key. Identity guard: only while `arr` is STILL
      // the array mapped to `type` — a key re-subscribed after pruning gets a
      // new array, so a stale/double unsubscribe must not delete the live key.
      // Never true for "*": wildcards live in `w`, not in `t`.
      if (!arr.length && t.get(type) === arr) t.delete(type);
    };
    // rm() makes the entry inert before the call: an outer emit's snapshot
    // may still hold it after a nested emit consumed it (never fire twice).
    if (o?.once)
      e.h = (...a) => {
        rm();
        handler(...a);
      };
    // Wire the signal before touching any list or Map key, so a throwing
    // addEventListener leaves no partial state.
    if (sig) {
      sig.addEventListener("abort", rm, { once: true });
      e.c = () => sig.removeEventListener("abort", rm);
    }
    arr.push(e);
    if (!wild) t.set(type, arr);
    return rm;
  }

  // Both overloads (typed and "*") delegate to on(): on() routes "*" to the
  // wildcard list, so once("*", h) === on("*", h, { once: true }).
  function once(type: string, handler: F): () => void {
    return on(type, handler, { once: true });
  }

  function off(type: string, handler?: F): void {
    ck();
    const arr = type === "*" ? w : t.get(type);
    if (arr === undefined) return;
    if (handler === undefined) {
      flush(arr);
      arr.length = 0;
    } else {
      // First entry registered with `handler` (matched by the user-provided
      // handler, so once-wrapped entries match too).
      const i = arr.findIndex((e) => e.u === handler);
      if (i >= 0) flush(arr.splice(i, 1));
    }
    if (!arr.length) t.delete(type);
  }

  // Inline error policy handler — policy undefined/false → re-throw; true → swallow;
  // function → invoke and swallow; if callback throws, ignore silently.
  // The callback's `type` is always a string: numeric or symbol Events keys
  // reach emit() raw (handlers and Map keys keep them), so coerce here.
  function ap(pol: ErrorPolicy | undefined, err: unknown, k: string, p: unknown): void {
    if (pol === undefined || pol === false) throw err;
    if (typeof pol === "function")
      try {
        pol(err, String(k), p);
      } catch {
        /* silent */
      }
  }

  function emit(type: string, payload: unknown): void {
    ck();
    // Both slices happen BEFORE any handler call (snapshot-before-iterate);
    // entries removed meanwhile are inert (kill()), so they are skipped.
    const ts = (t.get(type) ?? []).slice();
    const ws = w.slice();
    for (const e of ts) {
      if (gate(e))
        try {
          e.h(payload);
        } catch (err) {
          ap(e.ce !== undefined ? e.ce : cap, err, type, payload);
        }
    }
    for (const e of ws) {
      if (gate(e))
        try {
          e.h(type, payload);
        } catch (err) {
          ap(cap, err, type, payload);
        }
    }
  }

  function purge(): void {
    for (const a of [...t.values(), w]) {
      flush(a);
      a.length = 0;
    }
    t.clear();
  }

  // _mapSize: test-only observation seam (not on the public Emitter interface).
  // Casted away at the return type; exposes t.size for Map-pruning regression tests.
  return {
    on: on as Emitter<Events>["on"],
    once: once as Emitter<Events>["once"],
    off: off as Emitter<Events>["off"],
    emit: emit as Emitter<Events>["emit"],
    clear() {
      ck();
      purge();
    },
    dispose() {
      if (!d) {
        purge();
        d = true;
      }
    },
    get disposed() {
      return d;
    },
    get _mapSize() {
      return t.size;
    },
  } as unknown as Emitter<Events>;
}

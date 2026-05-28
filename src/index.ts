// aieventjs — small, strict, typed event emitter for the ai*js family.
//
// v0.1.0: full implementation of the frozen API surface. Mitt-compatible
// snapshot semantics, wildcard "*" handler, AbortSignal integration, once,
// idempotent dispose, destructurable methods (no `this`).

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
   *    event name as string, and the payload as unknown. If this callback
   *    itself throws, the error is silently ignored.
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
   * Wildcard "*" only. Minimum milliseconds between successive calls.
   * Leading-edge: the first dispatch after subscription always fires;
   * subsequent dispatches within `throttleMs` are dropped (not queued).
   * Uses Date.now(). 0 = no throttle. Negative values are rejected.
   *
   * Throws EmitterError if set on a typed handler.
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
   * receive `(type, payload)`. Handler lists are snapshotted before iteration,
   * so removing a handler inside its own callback does not skip subsequent
   * handlers. By default, the first throwing handler aborts the dispatch;
   * set EmitterOptions.captureHandlerErrors (or per-handler OnOptions.captureErrors)
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
 * Recoverable emitter error. Thrown by `on()` when `OnOptions` violates a
 * precondition: `captureErrors` set on a wildcard `"*"` subscription;
 * `sampleRate` / `throttleMs` set on a typed subscription; `sampleRate`
 * outside `(0, 1]`; or `throttleMs` negative.
 *
 * @public
 */
export class EmitterError extends Error {
  override readonly name = "EmitterError";
}

/**
 * Thrown by any emitter method called after {@link Emitter.dispose}.
 *
 * @public
 */
export class EmitterDisposedError extends Error {
  override readonly name = "EmitterDisposedError";
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

// Mutable `c` field (not optional `?:`) avoids exactOptionalPropertyTypes TS2412
// when assigning undefined. Short field names reduce minified output size.
type ErrorPolicy = boolean | ((err: unknown, type: string, payload: unknown) => void);

interface E<H> {
  h: H; // handler (may be a once-wrapper)
  c: (() => void) | undefined; // abortCleanup
  u: H; // user-provided handler (off matching)
  // v0.3.0: per-handler error policy and wildcard throttle/sample state.
  // Fields typed as `T | undefined` (not just `T`) so that exactOptionalPropertyTypes
  // permits assigning `undefined` in object literals (avoids TS2375).
  ce?: ErrorPolicy | undefined; // captureErrors override (typed only)
  r?: number | undefined; // sampleRate (wildcard only)
  tm?: number | undefined; // throttleMs (wildcard only)
  ts?: number | undefined; // last call timestamp — mutated during dispatch (wildcard only)
}

type AH = EventHandler<unknown>;
type WH = WildcardHandler<Record<string, unknown>>;

// Remove one entry by user-identity from an array; run its abort cleanup.
function rmByUser<H>(arr: E<H>[], user: H): void {
  const i = arr.findIndex((e) => e.u === user);
  if (i >= 0) {
    const e = arr[i];
    if (e !== undefined) {
      e.c?.();
      e.c = undefined;
    }
    arr.splice(i, 1);
  }
}

// Flush all abort cleanups from an array (for clear / dispose).
function flush<H>(arr: E<H>[]): void {
  for (const e of arr) {
    e.c?.();
    e.c = undefined;
  }
}

// Push entry onto arr, wire AbortSignal, return unsubscribe.
function sub<H>(arr: E<H>[], e: E<H>, sig: AbortSignal | undefined): () => void {
  arr.push(e);
  const rm = () => {
    const i = arr.indexOf(e);
    if (i >= 0) arr.splice(i, 1);
    e.c?.();
    e.c = undefined;
  };
  if (sig !== undefined) {
    const fn = () => rm();
    sig.addEventListener("abort", fn, { once: true });
    e.c = () => sig.removeEventListener("abort", fn);
  }
  return rm;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Construct a strongly-typed event emitter.
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

  const t: Map<string, E<AH>[]> = new Map();
  const w: E<WH>[] = [];
  let d = false;

  function ck(): void {
    if (d) throw new EmitterDisposedError("aieventjs: emitter has been disposed");
  }

  // Get or create typed handler array for a key.
  function ga(k: string): E<AH>[] {
    let a = t.get(k);
    if (a === undefined) {
      a = [];
      t.set(k, a);
    }
    return a;
  }

  function on(type: string | "*", handler: AH | WH, o?: OnOptions): () => void {
    ck();
    // v0.3.0 guards: cross-domain options + range checks
    const sr = o?.sampleRate;
    const tm2 = o?.throttleMs;
    if (type === "*") {
      if (o?.captureErrors !== undefined)
        throw new EmitterError("aieventjs: captureErrors invalid on *");
    } else {
      if (sr !== undefined) throw new EmitterError("aieventjs: sampleRate wildcard-only");
      if (tm2 !== undefined) throw new EmitterError("aieventjs: throttleMs wildcard-only");
    }
    if (sr !== undefined && (sr <= 0 || sr > 1))
      throw new EmitterError("aieventjs: sampleRate must be in (0,1]");
    if (tm2 !== undefined && tm2 < 0) throw new EmitterError("aieventjs: throttleMs must be >= 0");
    const sig = o?.signal;
    if (sig?.aborted) return () => {};

    if (type === "*") {
      const fn = handler as WH;
      if (o?.once) {
        const e: E<WH> = {
          h: (tp, p) => {
            rm();
            fn(tp, p);
          },
          u: fn,
          c: undefined,
          r: sr,
          tm: tm2,
        };
        const rm = sub(w, e, sig);
        return rm;
      }
      return sub(w, { h: fn, u: fn, c: undefined, r: sr, tm: tm2 }, sig);
    }

    const fn = handler as AH;
    const ce = o?.captureErrors;
    if (o?.once) {
      const e: E<AH> = {
        h: (p) => {
          rm();
          fn(p);
        },
        u: fn,
        c: undefined,
        ce: ce,
      };
      const rm = sub(ga(type), e, sig);
      return rm;
    }
    return sub(ga(type), { h: fn, u: fn, c: undefined, ce: ce }, sig);
  }

  function once<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void {
    return on(type as string, handler as AH, { once: true });
  }

  function off(type: string | "*", handler?: AH | WH): void {
    ck();
    if (type === "*") {
      if (handler === undefined) {
        flush(w);
        w.length = 0;
      } else {
        rmByUser(w, handler as WH);
      }
      return;
    }
    const arr = t.get(type);
    if (arr === undefined) return;
    if (handler === undefined) {
      flush(arr);
      t.delete(type);
    } else {
      rmByUser(arr, handler as AH);
    }
  }

  // Inline error policy handler — policy undefined/false → re-throw; true → swallow;
  // function → invoke and swallow; if callback throws, ignore silently.
  function ap(pol: ErrorPolicy | undefined, err: unknown, k: string, p: unknown): void {
    if (pol === undefined || pol === false) throw err;
    if (typeof pol === "function")
      try {
        pol(err, k, p);
      } catch {
        /* silent */
      }
  }

  function emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    ck();
    // Both slices happen BEFORE any handler call (snapshot-before-iterate).
    const k = type as string;
    const p = payload as unknown;
    const ts = (t.get(k) ?? []).slice();
    const ws = w.slice();
    for (const e of ts) {
      try {
        e.h(p);
      } catch (err) {
        ap(e.ce !== undefined ? e.ce : cap, err, k, p);
      }
    }
    for (const e of ws) {
      if (e.r !== undefined && Math.random() >= e.r) continue;
      if (e.tm) {
        const now = Date.now();
        if (e.ts !== undefined && now - e.ts < e.tm) continue;
        e.ts = now;
      }
      try {
        e.h(k, p as never);
      } catch (err) {
        ap(cap, err, k, p);
      }
    }
  }

  function purge(): void {
    for (const a of t.values()) flush(a);
    flush(w);
    t.clear();
    w.length = 0;
  }

  return {
    on: on as Emitter<Events>["on"],
    once,
    off: off as Emitter<Events>["off"],
    emit,
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
  };
}

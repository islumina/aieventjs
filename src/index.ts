// aieventjs — small, strict, typed event emitter for the ai*js family.
//
// v0.1.0: full implementation of the frozen API surface. Mitt-compatible
// snapshot semantics, wildcard "*" handler, AbortSignal integration, once,
// idempotent dispose, destructurable methods (no `this`).

/**
 * Configuration for {@link createEmitter}. Reserved for future options
 * (e.g. handler error policy); the scaffold accepts an empty object.
 *
 * @public
 */
export interface EmitterOptions {
  /**
   * If true, throwing handlers do not abort the remaining dispatch — the
   * error is collected and re-thrown as a single `AggregateError` after
   * all handlers ran. Default `false` (mitt-compatible: first throw wins).
   *
   * Reserved for 0.2.0; ignored in 0.1.0.
   */
  captureHandlerErrors?: boolean;
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
   * receive `(type, payload)`. Handler list is snapshotted before
   * iteration, so removing a handler inside its own callback does not
   * skip subsequent handlers. The first throwing handler aborts the
   * dispatch; remaining handlers (typed and wildcard) do not fire.
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
 * Recoverable emitter error. Reserved for future precondition violations.
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
interface E<H> {
  h: H; // handler (may be a once-wrapper)
  c: (() => void) | undefined; // abortCleanup
  u: H; // user-provided handler (off matching)
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
  void opts;

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
        };
        const rm = sub(w, e, sig);
        return rm;
      }
      return sub(w, { h: fn, u: fn, c: undefined }, sig);
    }

    const fn = handler as AH;
    if (o?.once) {
      const e: E<AH> = {
        h: (p) => {
          rm();
          fn(p);
        },
        u: fn,
        c: undefined,
      };
      const rm = sub(ga(type), e, sig);
      return rm;
    }
    return sub(ga(type), { h: fn, u: fn, c: undefined }, sig);
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

  function emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    ck();
    // Snapshot BOTH arrays before either dispatch loop, so a typed handler
    // that adds/removes a wildcard handler during dispatch does not affect
    // the wildcards that fire in this same emit (spec §2 / §5).
    const k = type as string;
    const ts = (t.get(k) ?? []).slice();
    const ws = w.slice();
    for (const e of ts) e.h(payload as unknown);
    for (const e of ws) e.h(type as string, payload);
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

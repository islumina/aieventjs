// aieventjs — small, strict, typed event emitter for the ai*js family.
//
// v0.0.1 scaffold: types and JSDoc are stable; implementation is intentionally
// stubbed (`throw`) until the next cycle wires up the runtime. The shape is
// deliberately close to `mitt` so migrating from mitt is mechanical, while
// adding the ai*js conventions: `on()` returns an unsubscribe; `once` and
// `AbortSignal` are first-class; `dispose()` is idempotent and surfaced via
// a named error class.

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
   * skip subsequent handlers.
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
  // v0.0.1 scaffold — implementation lands with 0.1.0.
  void opts;
  throw new Error("aieventjs: not implemented (v0.0.1 scaffold)");
}

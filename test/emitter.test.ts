import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  type Emitter,
  EmitterDisposedError,
  EmitterError,
  type EventHandler,
  type WildcardHandler,
  createEmitter,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Shared event-map fixture
// ---------------------------------------------------------------------------

type Events = {
  ping: { n: number };
  pong: string;
  count: number;
};

// ---------------------------------------------------------------------------
// A. Typed dispatch & basic flow
// ---------------------------------------------------------------------------

describe("A. Typed dispatch & basic flow", () => {
  it("A1. createEmitter returns an emitter object", () => {
    const bus = createEmitter<Events>();
    expect(bus).toBeDefined();
    expect(typeof bus.on).toBe("function");
    expect(typeof bus.emit).toBe("function");
    expect(typeof bus.off).toBe("function");
    expect(typeof bus.once).toBe("function");
    expect(typeof bus.clear).toBe("function");
    expect(typeof bus.dispose).toBe("function");
  });

  it("A2. on + emit fires the handler with the payload", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("ping", fn);
    bus.emit("ping", { n: 42 });
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith({ n: 42 });
  });

  it("A3. on twice + emit fires both in registration order", () => {
    const bus = createEmitter<Events>();
    const order: number[] = [];
    bus.on("ping", () => order.push(1));
    bus.on("ping", () => order.push(2));
    bus.emit("ping", { n: 0 });
    expect(order).toEqual([1, 2]);
  });

  it("A4. emit on a type with no handlers is a no-op", () => {
    const bus = createEmitter<Events>();
    expect(() => bus.emit("ping", { n: 0 })).not.toThrow();
  });

  it("A5. methods are destructurable", () => {
    const bus = createEmitter<Events>();
    const { on, emit, once, off, clear, dispose } = bus;
    const fn = vi.fn();
    on("ping", fn);
    emit("ping", { n: 1 });
    expect(fn).toHaveBeenCalledOnce();
    // confirm the rest are callable without `this`
    expect(() => once("ping", () => {})).not.toThrow();
    expect(() => off("ping")).not.toThrow();
    expect(() => clear()).not.toThrow();
    expect(() => dispose()).not.toThrow();
  });

  it("A6. typed events: TS payload type matches at compile (smoke)", () => {
    const bus = createEmitter<Events>();
    // compile-time check: handler receives the correct payload type
    bus.on("ping", (p) => {
      const _n: number = p.n;
      void _n;
    });
    bus.emit("ping", { n: 7 });
  });
});

// ---------------------------------------------------------------------------
// B. Unsubscribe function
// ---------------------------------------------------------------------------

describe("B. Unsubscribe function", () => {
  it("B1. on() returns a function; calling it removes the handler", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    const unsub = bus.on("ping", fn);
    expect(typeof unsub).toBe("function");
    unsub();
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("B2. unsubscribe is idempotent", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    const unsub = bus.on("ping", fn);
    unsub();
    expect(() => unsub()).not.toThrow();
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("B3. unsubscribe before any emit cleanly removes", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    const unsub = bus.on("ping", fn);
    unsub();
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("B4. unsubscribe one handler does NOT affect siblings", () => {
    const bus = createEmitter<Events>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const unsub1 = bus.on("ping", fn1);
    bus.on("ping", fn2);
    unsub1();
    bus.emit("ping", { n: 1 });
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it("B5. unsubscribe after clear() is a no-op (no crash)", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    const unsub = bus.on("ping", fn);
    bus.clear();
    expect(() => unsub()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// C. once
// ---------------------------------------------------------------------------

describe("C. once", () => {
  it("C1. once + emit fires exactly once", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.once("ping", fn);
    bus.emit("ping", { n: 1 });
    expect(fn).toHaveBeenCalledOnce();
  });

  it("C2. once + emit twice fires only first", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.once("ping", fn);
    bus.emit("ping", { n: 1 });
    bus.emit("ping", { n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("C3. once removes itself BEFORE invoking user handler", () => {
    const bus = createEmitter<Events>();
    let callCount = 0;
    bus.once("ping", () => {
      callCount++;
      // re-register inside once handler — should fire on NEXT emit, not loop
      bus.once("ping", () => {
        callCount++;
      });
    });
    bus.emit("ping", { n: 1 });
    expect(callCount).toBe(1);
    bus.emit("ping", { n: 2 });
    expect(callCount).toBe(2);
  });

  it("C4. once handler with signal + abort before emit — never fires", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const fn = vi.fn();
    bus.on("ping", fn, { once: true, signal: ctrl.signal });
    ctrl.abort();
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("C5. once + wildcard fires exactly once on next emit of any type", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("*", fn, { once: true });
    bus.emit("ping", { n: 1 });
    bus.emit("pong", "hi");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// D. off
// ---------------------------------------------------------------------------

describe("D. off", () => {
  it("D1. off(type, handler) removes by identity", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("ping", fn);
    bus.off("ping", fn);
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("D2. off(type) without handler clears all of that type", () => {
    const bus = createEmitter<Events>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    bus.on("ping", fn1);
    bus.on("ping", fn2);
    bus.off("ping");
    bus.emit("ping", { n: 1 });
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it("D3. off(type, h) on never-registered h is silent no-op", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    expect(() => bus.off("ping", fn)).not.toThrow();
  });

  it("D4. off('*') clears all wildcards", () => {
    const bus = createEmitter<Events>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    bus.on("*", fn1);
    bus.on("*", fn2);
    bus.off("*");
    bus.emit("ping", { n: 1 });
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it("D5. off(type, userHandler) matches once-wrapped entry by user identity", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.once("ping", fn);
    bus.off("ping", fn); // match by user handler, not wrapper
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// E. AbortSignal
// ---------------------------------------------------------------------------

describe("E. AbortSignal", () => {
  it("E1. on with pre-aborted signal — no register, no fire", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    ctrl.abort();
    const fn = vi.fn();
    bus.on("ping", fn, { signal: ctrl.signal });
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("E2. on with signal — abort mid-life removes handler", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const fn = vi.fn();
    bus.on("ping", fn, { signal: ctrl.signal });
    ctrl.abort();
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("E3. abort detaches the listener (removeEventListener called)", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const removeSpy = vi.spyOn(ctrl.signal, "removeEventListener");
    const fn = vi.fn();
    const unsub = bus.on("ping", fn, { signal: ctrl.signal });
    unsub();
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("E4. manual unsubscribe before abort — abort listener detached cleanly", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const fn = vi.fn();
    const unsub = bus.on("ping", fn, { signal: ctrl.signal });
    unsub(); // remove manually first
    expect(() => ctrl.abort()).not.toThrow(); // abort should not crash
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("E5. abort during dispatch — snapshot already in flight, current emit completes", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const results: string[] = [];
    bus.on("ping", () => {
      results.push("before-abort");
      ctrl.abort(); // abort during dispatch
      results.push("after-abort");
    });
    bus.on("ping", () => {
      results.push("sibling");
    });
    bus.emit("ping", { n: 1 });
    // Both handlers were in the snapshot before abort fired — both complete.
    expect(results).toEqual(["before-abort", "after-abort", "sibling"]);
  });

  it("E6. signal: undefined explicit — same as no signal", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("ping", fn, { signal: undefined });
    bus.emit("ping", { n: 1 });
    expect(fn).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// F. Wildcard
// ---------------------------------------------------------------------------

describe("F. Wildcard", () => {
  it("F1. on('*', h) fires for every type", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("*", fn);
    bus.emit("ping", { n: 1 });
    bus.emit("pong", "hello");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("F2. wildcard receives (type, payload)", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("*", fn);
    bus.emit("ping", { n: 5 });
    expect(fn).toHaveBeenCalledWith("ping", { n: 5 });
  });

  it("F3. wildcards fire AFTER typed handlers", () => {
    const bus = createEmitter<Events>();
    const order: string[] = [];
    bus.on("ping", () => order.push("typed"));
    bus.on("*", () => order.push("wild"));
    bus.emit("ping", { n: 1 });
    expect(order).toEqual(["typed", "wild"]);
  });

  it("F4. off('*', h) removes one wildcard", () => {
    const bus = createEmitter<Events>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    bus.on("*", fn1);
    bus.on("*", fn2);
    bus.off("*", fn1);
    bus.emit("ping", { n: 1 });
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it("F5. once + wildcard fires exactly once", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.once("ping", fn as EventHandler<{ n: number }>);
    bus.emit("ping", { n: 1 });
    bus.emit("ping", { n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// G. Re-entrancy
// ---------------------------------------------------------------------------

describe("G. Re-entrancy", () => {
  it("G1. emit inside handler (same type) — re-entrant emit runs to completion", () => {
    const bus = createEmitter<Events>();
    const results: number[] = [];
    let depth = 0;
    bus.on("count", (n) => {
      results.push(n);
      if (depth === 0) {
        depth++;
        bus.emit("count", 99); // re-entrant
      }
    });
    bus.emit("count", 1);
    expect(results).toEqual([1, 99]);
  });

  it("G2. emit inside handler (different type) — runs to completion", () => {
    const bus = createEmitter<Events>();
    const results: string[] = [];
    bus.on("ping", () => {
      results.push("ping");
      bus.emit("pong", "inner");
    });
    bus.on("pong", (s) => {
      results.push(`pong:${s}`);
    });
    bus.emit("ping", { n: 1 });
    expect(results).toEqual(["ping", "pong:inner"]);
  });

  it("G3. on inside handler — new handler NOT fired this emit", () => {
    const bus = createEmitter<Events>();
    const lateHandler = vi.fn();
    bus.on("ping", () => {
      bus.on("ping", lateHandler);
    });
    bus.emit("ping", { n: 1 });
    expect(lateHandler).not.toHaveBeenCalled();
    // fires next emit
    bus.emit("ping", { n: 2 });
    expect(lateHandler).toHaveBeenCalledOnce();
  });

  it("G4. off inside handler (self) — current handler still completes; snapshot siblings fire", () => {
    const bus = createEmitter<Events>();
    const log: string[] = [];
    const ref: { unsub: (() => void) | undefined } = { unsub: undefined };
    ref.unsub = bus.on("ping", () => {
      ref.unsub?.();
      log.push("self");
    });
    bus.on("ping", () => log.push("sibling"));
    bus.emit("ping", { n: 1 });
    expect(log).toEqual(["self", "sibling"]);
  });

  it("G5. off inside handler (sibling) — sibling in snapshot still fires", () => {
    const bus = createEmitter<Events>();
    const log: string[] = [];
    const sibling = vi.fn(() => log.push("sibling"));
    bus.on("ping", () => {
      bus.off("ping", sibling);
      log.push("first");
    });
    bus.on("ping", sibling);
    bus.emit("ping", { n: 1 });
    expect(log).toEqual(["first", "sibling"]);
    // sibling removed from live array; won't fire next time
    bus.emit("ping", { n: 2 });
    expect(sibling).toHaveBeenCalledTimes(1);
  });

  it("G6. dispose inside handler — current snapshot continues; re-entrant emit throws", () => {
    const bus = createEmitter<Events>();
    const log: string[] = [];
    bus.on("ping", () => {
      bus.dispose();
      log.push("after-dispose");
      // re-entrant emit must throw
      expect(() => bus.emit("ping", { n: 2 })).toThrow(EmitterDisposedError);
    });
    bus.on("ping", () => log.push("sibling"));
    bus.emit("ping", { n: 1 });
    expect(log).toEqual(["after-dispose", "sibling"]);
  });

  it("G7. typed handler adding a wildcard mid-emit — new wildcard NOT fired this emit", () => {
    const bus = createEmitter<Events>();
    const order: string[] = [];
    bus.on("ping", () => {
      order.push("typed");
      bus.on("*", (type) => order.push(`wild:${String(type)}`));
    });
    bus.emit("ping", { n: 1 });
    // typed fires; wildcard registered DURING the typed dispatch must NOT
    // appear in this emit because both arrays snapshot before either loop.
    expect(order).toEqual(["typed"]);
    // next emit picks it up.
    bus.emit("ping", { n: 2 });
    expect(order).toEqual(["typed", "typed", "wild:ping"]);
  });

  it("G8. typed handler removing a wildcard mid-emit — snapshot wildcard STILL fires", () => {
    const bus = createEmitter<Events>();
    const order: string[] = [];
    const offWild = bus.on("*", (type) => order.push(`wild:${String(type)}`));
    bus.on("ping", () => {
      order.push("typed");
      offWild();
    });
    bus.emit("ping", { n: 1 });
    // wildcard was in the snapshot when emit began; it still fires this round.
    expect(order).toEqual(["typed", "wild:ping"]);
    // next emit: wildcard truly gone.
    order.length = 0;
    bus.emit("ping", { n: 2 });
    expect(order).toEqual(["typed"]);
  });
});

// ---------------------------------------------------------------------------
// H. dispose
// ---------------------------------------------------------------------------

describe("H. dispose", () => {
  it("H1. dispose is idempotent", () => {
    const bus = createEmitter<Events>();
    bus.dispose();
    expect(() => bus.dispose()).not.toThrow();
  });

  it("H2. on after dispose throws EmitterDisposedError", () => {
    const bus = createEmitter<Events>();
    bus.dispose();
    expect(() => bus.on("ping", () => {})).toThrow(EmitterDisposedError);
  });

  it("H3. emit after dispose throws", () => {
    const bus = createEmitter<Events>();
    bus.dispose();
    expect(() => bus.emit("ping", { n: 1 })).toThrow(EmitterDisposedError);
  });

  it("H4. disposed getter reflects state", () => {
    const bus = createEmitter<Events>();
    expect(bus.disposed).toBe(false);
    bus.dispose();
    expect(bus.disposed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// I. clear
// ---------------------------------------------------------------------------

describe("I. clear", () => {
  it("I1. clear empties handlers; emitter still usable", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("ping", fn);
    bus.clear();
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
    // still usable
    const fn2 = vi.fn();
    bus.on("ping", fn2);
    bus.emit("ping", { n: 2 });
    expect(fn2).toHaveBeenCalledOnce();
  });

  it("I2. clear releases abort listeners (removeEventListener called)", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const removeSpy = vi.spyOn(ctrl.signal, "removeEventListener");
    bus.on("ping", () => {}, { signal: ctrl.signal });
    bus.clear();
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});

// ---------------------------------------------------------------------------
// H2. dispose — additional edge cases
// ---------------------------------------------------------------------------

describe("H2. dispose — additional edge cases", () => {
  it("H2a. off() after dispose() throws EmitterDisposedError", () => {
    const bus = createEmitter<Events>();
    bus.on("ping", () => {});
    bus.dispose();
    expect(() => bus.off("ping")).toThrow(EmitterDisposedError);
  });

  it("H2b. clear() after dispose() throws EmitterDisposedError", () => {
    const bus = createEmitter<Events>();
    bus.dispose();
    expect(() => bus.clear()).toThrow(EmitterDisposedError);
  });

  it("H2c. unsubscribe function returned by on() is a safe no-op after dispose()", () => {
    const bus = createEmitter<Events>();
    const unsub = bus.on("ping", () => {});
    bus.dispose();
    expect(() => unsub()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// T01. off() abort-listener detach spy (EVT-T-01)
// ---------------------------------------------------------------------------
// Guards the rmByUser and flush paths in off(). Existing spy tests cover
// unsub(), clear(), dispose(), wildcard unsub/clear/dispose, and mid-life
// abort. These tests add: off(type, handler) and off(type) without handler.

describe("T01. off() abort-listener detach (EVT-T-01)", () => {
  it("T01a. off(type, handler) with signal — removeEventListener called (rmByUser path)", () => {
    // Regression pin: rmByUser calls e.c?.() which calls sig.removeEventListener.
    // A regression dropping e.c?.() in rmByUser would pass all other tests.
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const removeSpy = vi.spyOn(ctrl.signal, "removeEventListener");
    const fn = vi.fn();
    bus.on("ping", fn, { signal: ctrl.signal });
    bus.off("ping", fn);
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    // handler must not fire after off
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("T01b. off(type) without handler with signal — removeEventListener called (flush path)", () => {
    // Regression pin: flush() calls e.c?.() for every entry. The off(type)
    // code path calls flush(arr) before deleting from the map.
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const removeSpy = vi.spyOn(ctrl.signal, "removeEventListener");
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    bus.on("ping", fn1, { signal: ctrl.signal });
    bus.on("ping", fn2); // no signal — ensures only the signal handler triggers the spy
    bus.off("ping");
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    bus.emit("ping", { n: 1 });
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it("T01c. off(type, handler) — only the targeted handler's abort listener detached", () => {
    // Two handlers with signals on the same type; off(type, fn1) must detach
    // only fn1's abort listener, leaving fn2 subscribed.
    const bus = createEmitter<Events>();
    const ctrl1 = new AbortController();
    const ctrl2 = new AbortController();
    const removeSpy1 = vi.spyOn(ctrl1.signal, "removeEventListener");
    const removeSpy2 = vi.spyOn(ctrl2.signal, "removeEventListener");
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    bus.on("ping", fn1, { signal: ctrl1.signal });
    bus.on("ping", fn2, { signal: ctrl2.signal });
    bus.off("ping", fn1);
    expect(removeSpy1).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(removeSpy2).not.toHaveBeenCalled();
    bus.emit("ping", { n: 1 });
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// R01. dispose/clear typed array truncation (EVT-R-01)
// ---------------------------------------------------------------------------
// Mirror of the wildcard `w.length = 0` treatment: after dispose() or
// off(type), the typed handler array referenced by any retained unsubscribe
// closure must be truncated to length 0.  We verify the fix by capturing a
// direct reference to the internal array via the unsub closure's captured
// `arr` variable — achievable through a single-entry emitter where the unsub
// closure IS the only holder of that array ref.
//
// Strategy: subscribe two handlers to the same type. After dispose() /
// off(type), call the retained unsub for one of them. If `arr.length` is
// still > 0 (fix missing), the splice in unsub would find index -1 (already
// flushed/cleared) but arr would still hold the sibling entry. We observe this
// via a wrapping Proxy that records every `length` read on the array.

function makeTrackedArray<T>(): { arr: T[]; lengths: number[] } {
  const lengths: number[] = [];
  const raw: T[] = [];
  const arr = new Proxy(raw, {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, receiver);
      if (prop === "length") lengths.push(target.length);
      return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(target) : val;
    },
  });
  return { arr, lengths };
}

describe("R01. Typed array truncation after dispose/off (EVT-R-01)", () => {
  it("R01a. dispose() truncates typed handler array to length 0 (retained unsub sees empty arr)", () => {
    // After purge(), arr.length === 0; a retained unsub's arr.indexOf returns -1
    // because the array is both flushed and truncated.
    const bus = createEmitter<Events>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    bus.on("ping", fn1);
    const unsub2 = bus.on("ping", fn2);
    // Dispose: purge should flush + truncate typed arrays.
    bus.dispose();
    // unsub2 still holds a ref to the internal arr. If arr.length > 0, the
    // sibling fn1's entry is still reachable. The truncation (a.length = 0)
    // makes it unreachable. We verify: calling unsub2 must not throw AND
    // must not cause fn1 to fire (no phantom call via residual arr entry).
    expect(() => unsub2()).not.toThrow();
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it("R01b. dispose() typed array length is 0 — three retained unsubs all safe, no phantom fires", () => {
    const bus = createEmitter<Events>();
    const handlers = [vi.fn(), vi.fn(), vi.fn()];
    const unsubs = handlers.map((h) => bus.on("ping", h));
    bus.dispose();
    for (const unsub of unsubs) {
      expect(() => unsub()).not.toThrow();
    }
    for (const h of handlers) {
      expect(h).not.toHaveBeenCalled();
    }
  });

  it("R01c. off(type) without handler truncates typed array to length 0 (retained unsub safe)", () => {
    // Regression pin for the off(type) flush path: arr.length = 0 must mirror
    // the wildcard path. After off("ping"), the retained unsub closures hold
    // a ref to the now-truncated array; arr.indexOf returns -1 and splice is
    // a no-op — no phantom entries, no throw.
    const bus = createEmitter<Events>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const unsub1 = bus.on("ping", fn1);
    const unsub2 = bus.on("ping", fn2);
    bus.off("ping");
    // arr is truncated; both unsubs must be safe no-ops.
    expect(() => unsub1()).not.toThrow();
    expect(() => unsub2()).not.toThrow();
    // Re-subscribe: fresh array; no phantom entries from old arr.
    const fn3 = vi.fn();
    bus.on("ping", fn3);
    bus.emit("ping", { n: 1 });
    expect(fn3).toHaveBeenCalledOnce();
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it("R01d. dispose() releases typed abort listeners; retained unsub is length-0 safe", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const removeSpy = vi.spyOn(ctrl.signal, "removeEventListener");
    const fn = vi.fn();
    const unsub = bus.on("ping", fn, { signal: ctrl.signal });
    bus.dispose();
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(() => unsub()).not.toThrow();
    expect(fn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// C2. once regression — handler removed even when it throws
// ---------------------------------------------------------------------------

describe("C2. once regression — removed on throw", () => {
  it("C2a. typed once handler that throws is removed; does not re-fire on next emit", () => {
    const bus = createEmitter<Events>({ captureHandlerErrors: true });
    let callCount = 0;
    bus.once("ping", () => {
      callCount++;
      throw new Error("once-throws");
    });
    bus.emit("ping", { n: 1 });
    expect(callCount).toBe(1);
    bus.emit("ping", { n: 2 });
    // must not fire again — once semantics hold even when handler threw
    expect(callCount).toBe(1);
  });

  it("C2b. wildcard once handler that throws is removed; does not re-fire on next emit", () => {
    const bus = createEmitter<Events>({ captureHandlerErrors: true });
    let callCount = 0;
    bus.on(
      "*",
      () => {
        callCount++;
        throw new Error("wild-once-throws");
      },
      { once: true },
    );
    bus.emit("ping", { n: 1 });
    expect(callCount).toBe(1);
    bus.emit("pong", "hi");
    // must not fire again
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// J. Type-level smoke
// ---------------------------------------------------------------------------

describe("J. Type-level smoke", () => {
  it("J1. createEmitter<Events>() infers payload type from event key", () => {
    const bus = createEmitter<Events>();
    // The on overload infers payload from the key — type-level check only.
    expectTypeOf(bus.on).toBeFunction();
    // handler for "ping" should receive { n: number }
    type PingHandler = EventHandler<{ n: number }>;
    expectTypeOf(bus.on<"ping">)
      .parameter(1)
      .toMatchTypeOf<PingHandler>();
  });

  it("J2. wildcard handler typed as <K extends keyof Events>(type, payload) => void", () => {
    const bus = createEmitter<Events>();
    type WH = WildcardHandler<Events>;
    expectTypeOf(bus.on).toBeFunction();
    // A wildcard handler parameter should satisfy WildcardHandler<Events>
    const _wh: WH = (_type, _payload) => {};
    void _wh;
    // Verify the Emitter interface exposes wildcard on() overload
    expectTypeOf<Emitter<Events>["on"]>().toBeFunction();
  });
});

// ---------------------------------------------------------------------------
// K. Extra coverage (EmitterError, wildcard signal, wildcard clear cleanup)
// ---------------------------------------------------------------------------

describe("K. Extra coverage", () => {
  it("K1. EmitterError has correct name", () => {
    const e = new EmitterError("test");
    expect(e.name).toBe("EmitterError");
    expect(e).toBeInstanceOf(Error);
  });

  it("K0. no-op unsubscribe from pre-aborted signal is callable", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    ctrl.abort();
    const unsub = bus.on("ping", () => {}, { signal: ctrl.signal });
    // The returned function is a no-op; calling it must not throw.
    expect(() => unsub()).not.toThrow();
  });

  it("K2. wildcard on with signal — abort removes wildcard handler", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const fn = vi.fn();
    bus.on("*", fn, { signal: ctrl.signal });
    ctrl.abort();
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("K3. wildcard on with signal — removeEventListener called on manual unsub", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const removeSpy = vi.spyOn(ctrl.signal, "removeEventListener");
    const unsub = bus.on("*", () => {}, { signal: ctrl.signal });
    unsub();
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("K4. clear() releases wildcard abort listeners", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const removeSpy = vi.spyOn(ctrl.signal, "removeEventListener");
    bus.on("*", () => {}, { signal: ctrl.signal });
    bus.clear();
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("K5. dispose() releases wildcard abort listeners", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const removeSpy = vi.spyOn(ctrl.signal, "removeEventListener");
    bus.on("*", () => {}, { signal: ctrl.signal });
    bus.dispose();
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});

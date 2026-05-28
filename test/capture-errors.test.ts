import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { EmitterDisposedError, EmitterError, createEmitter } from "../src/index.js";

type Events = {
  ping: { n: number };
  pong: string;
};

// ---------------------------------------------------------------------------
// A. Default behaviour (mitt-compatible)
// ---------------------------------------------------------------------------

describe("A. Default behaviour (mitt-compatible)", () => {
  it("A1. first throwing typed handler aborts dispatch; second typed handler does not run", () => {
    const bus = createEmitter<Events>();
    const second = vi.fn();
    bus.on("ping", () => {
      throw new Error("boom");
    });
    bus.on("ping", second);
    expect(() => bus.emit("ping", { n: 1 })).toThrow("boom");
    expect(second).not.toHaveBeenCalled();
  });

  it("A2. typed handler throws; wildcard handler does not run", () => {
    const bus = createEmitter<Events>();
    const wh = vi.fn();
    bus.on("ping", () => {
      throw new Error("typed");
    });
    bus.on("*", wh);
    expect(() => bus.emit("ping", { n: 1 })).toThrow("typed");
    expect(wh).not.toHaveBeenCalled();
  });

  it("A3. first typed handler runs to completion; second typed handler throws; snapshot still has first run", () => {
    const bus = createEmitter<Events>();
    const order: string[] = [];
    bus.on("ping", () => {
      order.push("first");
    });
    bus.on("ping", () => {
      throw new Error("second-throws");
    });
    expect(() => bus.emit("ping", { n: 1 })).toThrow("second-throws");
    expect(order).toEqual(["first"]);
  });
});

// ---------------------------------------------------------------------------
// B. Emitter-level captureHandlerErrors: true
// ---------------------------------------------------------------------------

describe("B. Emitter-level captureHandlerErrors: true", () => {
  it("B1. all typed handlers run even when one throws", () => {
    const bus = createEmitter<Events>({ captureHandlerErrors: true });
    const calls: number[] = [];
    bus.on("ping", () => {
      calls.push(1);
      throw new Error("e1");
    });
    bus.on("ping", () => {
      calls.push(2);
    });
    bus.on("ping", () => {
      calls.push(3);
      throw new Error("e3");
    });
    expect(() => bus.emit("ping", { n: 0 })).not.toThrow();
    expect(calls).toEqual([1, 2, 3]);
  });

  it("B2. both typed and wildcard handlers run when all throw; emit does not throw", () => {
    const bus = createEmitter<Events>({ captureHandlerErrors: true });
    const calls: string[] = [];
    bus.on("ping", () => {
      calls.push("typed");
      throw new Error("t");
    });
    bus.on("*", () => {
      calls.push("wild");
      throw new Error("w");
    });
    expect(() => bus.emit("ping", { n: 0 })).not.toThrow();
    expect(calls).toEqual(["typed", "wild"]);
  });
});

// ---------------------------------------------------------------------------
// C. Emitter-level callback
// ---------------------------------------------------------------------------

describe("C. Emitter-level captureHandlerErrors callback", () => {
  it("C1. callback receives (err, type: string, payload) in throw order", () => {
    const received: Array<[unknown, string, unknown]> = [];
    const cb = (err: unknown, type: string, payload: unknown) => {
      received.push([err, type, payload]);
    };
    const bus = createEmitter<Events>({ captureHandlerErrors: cb });
    const e1 = new Error("first");
    const e2 = new Error("second");
    bus.on("ping", () => {
      throw e1;
    });
    bus.on("ping", () => {
      throw e2;
    });
    expect(() => bus.emit("ping", { n: 5 })).not.toThrow();
    expect(received).toHaveLength(2);
    expect(received[0]).toEqual([e1, "ping", { n: 5 }]);
    expect(received[1]).toEqual([e2, "ping", { n: 5 }]);
  });

  it("C2. callback that throws itself does not abort emit; other handlers still run", () => {
    const badCb = () => {
      throw new Error("cb-throws");
    };
    const bus = createEmitter<Events>({ captureHandlerErrors: badCb });
    const second = vi.fn();
    bus.on("ping", () => {
      throw new Error("handler");
    });
    bus.on("ping", second);
    expect(() => bus.emit("ping", { n: 0 })).not.toThrow();
    expect(second).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// D. Per-handler override
// ---------------------------------------------------------------------------

describe("D. Per-handler captureErrors override", () => {
  it("D1. captureErrors:true per-handler swallows that handler; subsequent handler default-throws", () => {
    const bus = createEmitter<Events>();
    const order: string[] = [];
    bus.on(
      "ping",
      () => {
        throw new Error("h1");
      },
      { captureErrors: true },
    );
    bus.on("ping", () => {
      order.push("h2");
      throw new Error("h2");
    });
    bus.on("ping", () => {
      order.push("h3");
    });
    // h1 swallowed, h2 throws with default policy → aborts, h3 never runs
    expect(() => bus.emit("ping", { n: 0 })).toThrow("h2");
    expect(order).toEqual(["h2"]);
  });

  it("D2. captureErrors:false per-handler forces re-throw even when emitter-level is true", () => {
    const bus = createEmitter<Events>({ captureHandlerErrors: true });
    const second = vi.fn();
    bus.on(
      "ping",
      () => {
        throw new Error("force-rethrow");
      },
      { captureErrors: false },
    );
    bus.on("ping", second);
    expect(() => bus.emit("ping", { n: 0 })).toThrow("force-rethrow");
    expect(second).not.toHaveBeenCalled();
  });

  it("D3. captureErrors:fn per-handler callback receives err while emitter-level true swallows others", () => {
    const perHandlerCb = vi.fn();
    const emitterCb = vi.fn();
    const bus = createEmitter<Events>({ captureHandlerErrors: emitterCb });
    const e1 = new Error("per-handler-error");
    bus.on(
      "ping",
      () => {
        throw e1;
      },
      { captureErrors: perHandlerCb },
    );
    expect(() => bus.emit("ping", { n: 0 })).not.toThrow();
    expect(perHandlerCb).toHaveBeenCalledWith(e1, "ping", { n: 0 });
    expect(emitterCb).not.toHaveBeenCalled();
  });

  it("D4. captureErrors set on wildcard '*' subscription throws EmitterError", () => {
    const bus = createEmitter<Events>();
    expect(() => bus.on("*", vi.fn(), { captureErrors: true })).toThrow(EmitterError);
    expect(() => bus.on("*", vi.fn(), { captureErrors: true })).toThrow(/captureErrors/);
  });
});

// ---------------------------------------------------------------------------
// E. Dispose / type smoke
// ---------------------------------------------------------------------------

describe("E. Dispose / type smoke", () => {
  it("E1. dispose then emit throws EmitterDisposedError regardless of captureHandlerErrors", () => {
    const bus = createEmitter<Events>({ captureHandlerErrors: true });
    bus.dispose();
    expect(() => bus.emit("ping", { n: 0 })).toThrow(EmitterDisposedError);
  });

  it("E2. captureHandlerErrors callback type is (err: unknown, type: string, payload: unknown) => void", () => {
    expectTypeOf<
      NonNullable<Parameters<typeof createEmitter>[0]>["captureHandlerErrors"]
    >().toEqualTypeOf<
      boolean | ((err: unknown, type: string, payload: unknown) => void) | undefined
    >();
  });
});

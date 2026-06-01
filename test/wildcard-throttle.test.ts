import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmitterError, createEmitter } from "../src/index.js";

type Events = {
  ping: { n: number };
  pong: string;
};

// ---------------------------------------------------------------------------
// A. sampleRate
// ---------------------------------------------------------------------------

describe("A. sampleRate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("A1. sampleRate=1 means every dispatch reaches the handler regardless of Math.random", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("*", fn, { sampleRate: 1 });
    bus.emit("ping", { n: 1 });
    bus.emit("ping", { n: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("A2. sampleRate=0 throws EmitterError at on() time", () => {
    const bus = createEmitter<Events>();
    expect(() => bus.on("*", vi.fn(), { sampleRate: 0 })).toThrow(EmitterError);
    expect(() => bus.on("*", vi.fn(), { sampleRate: 0 })).toThrow(/sampleRate/);
  });

  it("A3. sampleRate=1.1 throws EmitterError at on() time", () => {
    const bus = createEmitter<Events>();
    expect(() => bus.on("*", vi.fn(), { sampleRate: 1.1 })).toThrow(EmitterError);
    expect(() => bus.on("*", vi.fn(), { sampleRate: 1.1 })).toThrow(/sampleRate/);
  });

  it("A4. sampleRate=-0.1 throws EmitterError at on() time", () => {
    const bus = createEmitter<Events>();
    expect(() => bus.on("*", vi.fn(), { sampleRate: -0.1 })).toThrow(EmitterError);
    expect(() => bus.on("*", vi.fn(), { sampleRate: -0.1 })).toThrow(/sampleRate/);
  });

  it("A6. sampleRate=NaN throws EmitterError at on() time", () => {
    const bus = createEmitter<Events>();
    expect(() => bus.on("*", vi.fn(), { sampleRate: Number.NaN })).toThrow(EmitterError);
    expect(() => bus.on("*", vi.fn(), { sampleRate: Number.NaN })).toThrow(/sampleRate/);
  });

  it("A5. sampleRate=0.5: random=0.4 calls handler; random=0.6 skips handler", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("*", fn, { sampleRate: 0.5 });

    // random < sampleRate → passes (0.4 < 0.5)
    vi.spyOn(Math, "random").mockReturnValue(0.4);
    bus.emit("ping", { n: 1 });
    expect(fn).toHaveBeenCalledTimes(1);

    // random >= sampleRate → drops (0.6 >= 0.5)
    vi.spyOn(Math, "random").mockReturnValue(0.6);
    bus.emit("ping", { n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// B. throttleMs
// ---------------------------------------------------------------------------

describe("B. throttleMs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("B1. throttleMs=100: first dispatch fires; within 100ms second dropped; after 101ms third fires", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("*", fn, { throttleMs: 100 });

    // First dispatch — leading edge, always fires
    bus.emit("ping", { n: 1 });
    expect(fn).toHaveBeenCalledTimes(1);

    // Within throttle window — dropped
    vi.advanceTimersByTime(50);
    bus.emit("ping", { n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);

    // Past throttle window — fires
    vi.advanceTimersByTime(51); // total 101ms
    bus.emit("ping", { n: 3 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("B2. throttleMs=0 is treated as no throttle; every dispatch calls handler", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("*", fn, { throttleMs: 0 });
    bus.emit("ping", { n: 1 });
    bus.emit("ping", { n: 2 });
    bus.emit("ping", { n: 3 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("B3. throttleMs=-1 throws EmitterError at on() time", () => {
    const bus = createEmitter<Events>();
    expect(() => bus.on("*", vi.fn(), { throttleMs: -1 })).toThrow(EmitterError);
    expect(() => bus.on("*", vi.fn(), { throttleMs: -1 })).toThrow(/throttleMs/);
  });

  it("B4. throttleMs=NaN throws EmitterError at on() time", () => {
    const bus = createEmitter<Events>();
    expect(() => bus.on("*", vi.fn(), { throttleMs: Number.NaN })).toThrow(EmitterError);
    expect(() => bus.on("*", vi.fn(), { throttleMs: Number.NaN })).toThrow(/throttleMs/);
  });
});

// ---------------------------------------------------------------------------
// C. wildcard-only enforcement
// ---------------------------------------------------------------------------

describe("C. Wildcard-only enforcement", () => {
  it("C1. sampleRate on typed handler throws EmitterError", () => {
    const bus = createEmitter<Events>();
    expect(() => bus.on("ping", vi.fn(), { sampleRate: 0.5 })).toThrow(EmitterError);
    expect(() => bus.on("ping", vi.fn(), { sampleRate: 0.5 })).toThrow(/sampleRate/);
  });

  it("C2. throttleMs on typed handler throws EmitterError", () => {
    const bus = createEmitter<Events>();
    expect(() => bus.on("ping", vi.fn(), { throttleMs: 100 })).toThrow(EmitterError);
    expect(() => bus.on("ping", vi.fn(), { throttleMs: 100 })).toThrow(/throttleMs/);
  });
});

// ---------------------------------------------------------------------------
// D. Combined sampleRate + throttleMs
// ---------------------------------------------------------------------------

describe("D. Combined sampleRate + throttleMs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("D1. sample miss does not update throttle timestamp; next dispatch still fires as leading-edge", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("*", fn, { sampleRate: 0.5, throttleMs: 100 });

    // First dispatch: random=0.6 → sample miss → handler NOT called, ts NOT updated
    vi.spyOn(Math, "random").mockReturnValue(0.6);
    bus.emit("ping", { n: 1 });
    expect(fn).toHaveBeenCalledTimes(0);

    // Second dispatch (immediately, no time advance): random=0.4 → sample pass
    // ts is still undefined (no previous hit), so throttle also passes → leading edge fires
    vi.spyOn(Math, "random").mockReturnValue(0.4);
    bus.emit("ping", { n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("D2. sample pass + throttle pass: handler called and timestamp recorded; within window dropped", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("*", fn, { sampleRate: 1, throttleMs: 100 });

    // First dispatch: sample=1 always passes, no ts yet → leading edge fires
    bus.emit("ping", { n: 1 });
    expect(fn).toHaveBeenCalledTimes(1);

    // Within window: throttle blocks
    vi.advanceTimersByTime(50);
    bus.emit("ping", { n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// E. Lifecycle
// ---------------------------------------------------------------------------

describe("E. Lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("E1. unsubscribe and re-subscribe: throttle timestamp resets (new entry, ts=undefined)", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();

    const off = bus.on("*", fn, { throttleMs: 100 });
    bus.emit("ping", { n: 1 }); // fires, ts set
    expect(fn).toHaveBeenCalledTimes(1);

    // Within throttle window — dropped
    vi.advanceTimersByTime(30);
    bus.emit("ping", { n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);

    // Unsubscribe and re-subscribe → fresh entry with ts=undefined
    off();
    bus.on("*", fn, { throttleMs: 100 });

    // Immediately after re-subscribe: new leading edge fires
    bus.emit("ping", { n: 3 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("E2. abort signal with throttleMs: after abort, dispatches do not trigger handler", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    const ctrl = new AbortController();

    bus.on("*", fn, { throttleMs: 100, signal: ctrl.signal });
    bus.emit("ping", { n: 1 }); // fires
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance past throttle
    vi.advanceTimersByTime(200);

    // Abort the signal
    ctrl.abort();

    // Dispatch after abort — handler no longer subscribed
    bus.emit("ping", { n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// F. AbortSignal + guard ordering (v0.3 options)
// ---------------------------------------------------------------------------

describe("F. AbortSignal + guard ordering (v0.3 options)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("F1. pre-aborted signal + sampleRate: no registration, never fires", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    const ctrl = new AbortController();
    ctrl.abort();
    bus.on("*", fn, { signal: ctrl.signal, sampleRate: 0.5 });
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  // pin: on() validates OnOptions BEFORE checking sig?.aborted
  it("F2. invalid option (typed + sampleRate) throws EmitterError even with pre-aborted signal", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    ctrl.abort();
    expect(() => bus.on("ping", vi.fn(), { signal: ctrl.signal, sampleRate: 0.5 })).toThrow(
      EmitterError,
    );
  });

  it("F3. captureErrors typed handler: abort mid-life removes the listener cleanly", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    const ctrl = new AbortController();
    const removeSpy = vi.spyOn(ctrl.signal, "removeEventListener");
    bus.on("ping", fn, { signal: ctrl.signal });
    ctrl.abort();
    expect(removeSpy).toHaveBeenCalled();
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });

  it("F4. throttled wildcard + abort during dispatch: snapshot-in-flight completes", () => {
    const bus = createEmitter<Events>();
    const ctrl = new AbortController();
    const log: string[] = [];

    bus.on(
      "*",
      () => {
        log.push("first");
        ctrl.abort();
      },
      { signal: ctrl.signal, throttleMs: 100 },
    );

    bus.on("*", () => {
      log.push("sibling");
    });

    bus.emit("ping", { n: 1 });

    // Both wildcard handlers were in the snapshot before dispatch started,
    // so sibling still runs even though ctrl was aborted inside "first".
    expect(log).toEqual(["first", "sibling"]);
  });

  it("F5. sampleRate boundary: Math.random() === sampleRate drops the dispatch (guard is >=)", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("*", fn, { sampleRate: 0.5 });
    vi.spyOn(Math, "random").mockReturnValue(0.5); // exactly equal → drop
    bus.emit("ping", { n: 1 });
    expect(fn).not.toHaveBeenCalled();
  });
});

// throttle-monotonic.test.ts
// Regression pin for P2 "Throttle clock" (EVT-R-02).
//
// The throttle gate was using Date.now() — a non-monotonic wall clock. A
// system-clock regression (NTP step-back, manual correction) after the first
// dispatch sets e.ts = T1; on the next dispatch Date.now() returns T1 - Δ,
// making now - e.ts negative.  Since negative < throttleMs, every subsequent
// dispatch is silently dropped until wall time re-passes T1 — potentially Δ ms
// of silence with no error.
//
// Fix: switch to performance.now() (monotonic). This file:
//   1. Confirms the regression with Date.now() (RED test — currently fails).
//   2. Verifies correct behaviour under a normal forward clock (must stay GREEN).
//   3. Verifies correct behaviour with a typed handler throttle (same source).
//
// Note: these tests mock Date.now() directly without vi.useFakeTimers() so that
// performance.now() remains real and monotonic — the exact condition needed to
// distinguish the two clock sources.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEmitter } from "../src/index.js";

type Events = {
  tick: { t: number };
  ping: { n: number };
};

// ---------------------------------------------------------------------------
// P2-A. Backward wall-clock regression — wildcard throttle
// ---------------------------------------------------------------------------

describe("P2-A. Backward wall-clock does not mute wildcard throttle handler", () => {
  let realDateNow: typeof Date.now;

  beforeEach(() => {
    realDateNow = Date.now;
  });

  afterEach(() => {
    // Restore Date.now whether or not vi.restoreAllMocks ran.
    Date.now = realDateNow;
    vi.restoreAllMocks();
  });

  it("P2-A1. (RED→GREEN) backward clock jump: handler must still fire after throttleMs has elapsed in monotonic time", async () => {
    // Strategy:
    //   - Subscribe wildcard with throttleMs=50.
    //   - Emit once (leading edge) — records ts.
    //   - Mock Date.now() to return a value 1000ms in the PAST (simulating NTP
    //     step-back).  With Date.now()-based throttle, now - ts < 0 < 50, so the
    //     handler would be incorrectly dropped on every subsequent dispatch.
    //   - Wait real time > 50ms so monotonic time (performance.now()) has
    //     definitely advanced past the throttle window.
    //   - Emit again — must fire (GREEN after fix, fails before fix).

    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("*", fn, { throttleMs: 50 });

    // Leading edge — always fires regardless of clock source.
    bus.emit("tick", { t: 1 });
    expect(fn).toHaveBeenCalledTimes(1);

    // Capture the real Date.now() value at this point so we can regress it.
    const capturedNow = realDateNow();

    // Mock Date.now() to simulate a 1000ms step-back.
    Date.now = () => capturedNow - 1_000;

    // Wait for real monotonic time to advance well past 50ms.
    await new Promise<void>((resolve) => setTimeout(resolve, 80));

    // Second emit: monotonic clock (performance.now) has advanced ~80ms > 50ms.
    // With performance.now()-based throttle → fires.
    // With Date.now()-based throttle → (capturedNow - 1000) - capturedNow = -1000 < 50 → dropped.
    bus.emit("tick", { t: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("P2-A2. (RED→GREEN) backward clock jump: typed handler throttle must also still fire", async () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("ping", fn, { throttleMs: 50 });

    bus.emit("ping", { n: 1 });
    expect(fn).toHaveBeenCalledTimes(1);

    const capturedNow = realDateNow();
    Date.now = () => capturedNow - 500;

    await new Promise<void>((resolve) => setTimeout(resolve, 80));

    bus.emit("ping", { n: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// P2-B. Normal forward clock — behaviour must be identical after fix
// ---------------------------------------------------------------------------

describe("P2-B. Normal forward clock behaviour unchanged after monotonic fix", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("P2-B1. wildcard: leading edge fires, within window dropped, past window fires", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("*", fn, { throttleMs: 100 });

    bus.emit("tick", { t: 1 });
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(50);
    bus.emit("tick", { t: 2 });
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(51); // total 101ms
    bus.emit("tick", { t: 3 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("P2-B2. typed: leading edge fires, within window dropped, past window fires", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("ping", fn, { throttleMs: 100 });

    bus.emit("ping", { n: 1 });
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(50);
    bus.emit("ping", { n: 2 });
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(51);
    bus.emit("ping", { n: 3 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("P2-B3. throttleMs=0 is still no-throttle after fix; every dispatch fires", () => {
    const bus = createEmitter<Events>();
    const fn = vi.fn();
    bus.on("ping", fn, { throttleMs: 0 });
    bus.emit("ping", { n: 1 });
    bus.emit("ping", { n: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

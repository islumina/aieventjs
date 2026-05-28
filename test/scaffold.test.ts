// Scaffold-stage placeholder test. Asserts that the public surface compiles
// and is shaped correctly so vitest can run against a non-empty test set
// while the implementation is still a `throw` stub. Real tests land in 0.1.0.

import { describe, expect, it } from "vitest";

import {
  type Emitter,
  EmitterDisposedError,
  EmitterError,
  type EmitterOptions,
  createEmitter,
} from "../src/index.js";

describe("aieventjs scaffold", () => {
  it("exports a callable createEmitter factory", () => {
    expect(typeof createEmitter).toBe("function");
  });

  it("exports EmitterError and EmitterDisposedError classes", () => {
    expect(new EmitterError("x")).toBeInstanceOf(Error);
    expect(new EmitterDisposedError("x")).toBeInstanceOf(Error);
    expect(new EmitterError("x").name).toBe("EmitterError");
    expect(new EmitterDisposedError("x").name).toBe("EmitterDisposedError");
  });

  it("createEmitter throws the scaffold sentinel until 0.1.0", () => {
    const opts: EmitterOptions = {};
    expect(() => createEmitter(opts)).toThrow(/not implemented/);
  });

  it("public Emitter<Events> shape compiles", () => {
    type Events = { ping: { n: number }; pong: void };
    // Type-level assertion only: this code path is never executed.
    const _typeProbe = (e: Emitter<Events>): void => {
      void e.on;
      void e.once;
      void e.off;
      void e.emit;
      void e.clear;
      void e.dispose;
      void e.disposed;
    };
    void _typeProbe;
  });
});

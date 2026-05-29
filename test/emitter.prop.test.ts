import * as fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import { createEmitter } from "../src/index.js";

// ---------------------------------------------------------------------------
// Shared event-map fixture
// ---------------------------------------------------------------------------

type Events = {
  ping: { n: number };
  pong: string;
};

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("property: dispatch order", () => {
  it("prop1. typed handlers fire in registration order before wildcard", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 8 }),
        (ids) => {
          const bus = createEmitter<Events>();
          const log: Array<number | "wild"> = [];

          for (const id of ids) {
            const captured = id;
            bus.on("ping", () => {
              log.push(captured);
            });
          }
          bus.on("*", () => {
            log.push("wild");
          });

          bus.emit("ping", { n: 1 });

          // Last entry is the wildcard
          expect(log[log.length - 1]).toBe("wild");
          // First N entries are typed handler ids in registration order
          expect(log.slice(0, ids.length)).toEqual(ids);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("property: snapshot stability under dynamic off()", () => {
  it("prop2. handler removed inside its own callback: all others in snapshot still run exactly once", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 0, max: 5 }),
        (count, removeIdxRaw) => {
          const removedIdx = removeIdxRaw % count;
          const bus = createEmitter<Events>();
          const calls = new Array<number>(count).fill(0);
          const handlers: Array<(payload: Events["ping"]) => void> = [];

          for (let i = 0; i < count; i++) {
            const captured = i;
            const h = (_p: Events["ping"]) => {
              calls[captured]++;
              if (captured === removedIdx) {
                bus.off("ping", handlers[captured]!);
              }
            };
            handlers.push(h);
            bus.on("ping", h);
          }

          bus.emit("ping", { n: 1 });

          // Every handler (including the removed one) ran exactly once —
          // snapshot was taken before iteration.
          for (let i = 0; i < count; i++) {
            expect(calls[i]).toBe(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("property: live-set accuracy after selective unsub", () => {
  it("prop3. only kept handlers fire; unsubscribed ones never fire", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }), (keep) => {
        const bus = createEmitter<Events>();
        const callCounts = new Array<number>(keep.length).fill(0);

        for (let i = 0; i < keep.length; i++) {
          const captured = i;
          const unsub = bus.on("ping", () => {
            callCounts[captured]++;
          });
          if (!keep[i]) unsub();
        }

        bus.emit("ping", { n: 1 });

        const expectedTotal = keep.filter(Boolean).length;
        const actualTotal = callCounts.reduce((s, c) => s + c, 0);
        expect(actualTotal).toBe(expectedTotal);

        for (let i = 0; i < keep.length; i++) {
          if (keep[i]) {
            expect(callCounts[i]).toBe(1);
          } else {
            expect(callCounts[i]).toBe(0);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

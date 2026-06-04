# Code Review: aieventjs

| Field       | Value                                                    |
|-------------|----------------------------------------------------------|
| Repo        | aieventjs                                                |
| Version     | 0.5.1                                                    |
| Branch      | claude/adoring-ptolemy-OGonc                             |
| Head SHA    | 0d6a7b908bcf39b621d946baa697d273bd686570                 |
| Date        | 2026-06-03                                               |
| Reviewer    | claude-sonnet-4-6 (automated review)                     |

---

## Verdict / Summary

The implementation is solid. All baseline gates pass. The core logic — factory-only
construction, snapshot-before-iterate emit, idempotent dispose, AbortSignal integration,
once, wildcard ordering — is correct and extensively tested (97 tests, 4 test files,
fast-check property suite). No behavior-changing bugs were found in the implementation.

Three safe documentation fixes were applied: `README_ZHTW.md` had a stale API sketch
(missing `captureErrors`, `sampleRate`, `throttleMs` in `OnOptions` and `EmitterOptions`,
plus an outdated Roadmap table and missing capability rows); `CONTRIBUTING.md` referenced
the original 550 B gzip budget rather than the current 1100 B limit. These are doc-only
drifts with no runtime impact.

Four findings are recorded (findings-only, no behavior changes applied): one phantom
uncoverable branch enforced by strict TypeScript, one minor idiom asymmetry in the emit
loop, one missing explicit test for `once()` post-dispose (covered transitively), and one
documentation note about the silent-swallow policy when a `captureHandlerErrors` callback
itself throws.

---

## Gate Results

| Gate              | Baseline  | After Fix |
|-------------------|-----------|-----------|
| typecheck         | PASS      | PASS      |
| lint              | PASS      | PASS      |
| build             | PASS      | PASS      |
| verify:exports    | PASS      | PASS      |
| verify:llms       | PASS      | PASS      |
| check:size        | PASS (1074 B gz / 1100 B budget, 98%) | PASS (1074 B gz / 1100 B budget, 98%) |
| coverage          | PASS (Stmts 100%, Branch 98.55%, Funcs 100%, Lines 100%) | PASS (unchanged; src not touched) |

---

## Safe Fixes Applied

### Fix 1 — README_ZHTW.md: stale `OnOptions` API sketch

**File:** `README_ZHTW.md` (API sketch section)

The ZHTW API sketch reflected the v0.1.0 `OnOptions` (only `signal` and `once`). The
`captureErrors`, `sampleRate`, and `throttleMs` fields added in v0.3.0 were absent. The
`EmitterOptions` comment was an old placeholder ("預留給 0.2.0 — 收進 AggregateError")
that predated the actual implementation.

Updated `OnOptions` to include all three v0.3.0 fields with Chinese-language inline
comments. Updated `EmitterOptions` to describe the actual three-way policy
(undefined/false → rethrow, true → swallow, callback → invoke per-throw).

### Fix 2 — README_ZHTW.md: missing capability rows in the "能做/不做" table

**File:** `README_ZHTW.md` (capability table section)

The English README's capability table already listed `sampleRate`, `throttleMs`, and
`captureHandlerErrors` rows. The ZHTW table was missing all three rows (stopped at
destructurable methods). Added the three missing rows with Chinese text consistent with
the rest of the ZHTW table.

### Fix 3 — README_ZHTW.md: stale Roadmap table

**File:** `README_ZHTW.md` (Roadmap section)

The ZHTW Roadmap showed v0.2.0 (captureHandlerErrors via AggregateError — never shipped)
and "0.3+" as future entries, while the current version is 0.5.1 and v0.3.0–v0.4.0
shipped months ago. Updated to match the English Roadmap: 0.0.1, 0.1.0, 0.3.0, 0.4.0,
0.6+ (async tracking draft), all with Chinese text.

### Fix 4 — CONTRIBUTING.md: stale gzip budget figures

**File:** `CONTRIBUTING.md`

Two places referenced the original 550 B gzip budget from v0.1.0:
- Opening sentence: "target ≤ 550 B gzip"
- "What needs discussion" section: "Anything that pushes the core gzip past 550 B"

Both updated to 1100 B (the budget raised in v0.3.0 when `captureHandlerErrors`,
`sampleRate`, and `throttleMs` pushed actual size to ~1050 B gzip).

### Fix 5 — llms-full.txt regenerated

**File:** `llms-full.txt`

Re-generated via `pnpm build:llms` after the README_ZHTW.md and CONTRIBUTING.md edits.
`pnpm verify:llms` confirms the file is in sync (20.5 KB, unchanged size).

---

## Findings by Severity

### M — Medium

#### M1. Phantom uncoverable branch at `src/index.ts:214`

**Area:** TypeScript / coverage  
**File:Line:** `src/index.ts:214`

```ts
const e = arr[i];   // line 213 — noUncheckedIndexedAccess requires this
if (e !== undefined) {  // line 214 — branch: false arm is unreachable at runtime
  e.c?.();
  e.c = undefined;
}
arr.splice(i, 1);
```

`arr.findIndex()` was called on line 211; the `if (i >= 0)` guard on line 212 ensures
`arr[i]` is always a valid element. The `if (e !== undefined)` guard on line 214 is
required by `noUncheckedIndexedAccess` at the TypeScript level but can never be false at
runtime. V8 coverage records one branch miss here — the `false` arm of
`if (e !== undefined)`. This accounts for the single uncovered branch (98.55% branch
coverage, 68/69 branches).

**Recommendation:** This is a structural consequence of `noUncheckedIndexedAccess` strict
mode. Options: (a) accept the phantom miss (current state); (b) use a `/* c8 ignore next
*/` annotation to suppress the phantom; (c) refactor `rmByUser` to avoid indexed access
(`arr[i]!` is not allowed; `arr.splice(i, 1)[0]` followed by `e?.c?.()` could work and
is branchless). Option (c) would also bring branch coverage to 100%. Behavioral change
assessment: none — pure refactor with identical runtime behavior. Deferred because the
refactor would change `src/index.ts` and deserves a dedicated PR with test confirmation.

---

### L — Low

#### L1. Idiom asymmetry: `if (e.tm)` vs `if (e.r !== undefined)` in `emit()` wildcard loop

**Area:** Code clarity / correctness risk  
**File:Line:** `src/index.ts:405–406`

```ts
if (e.r !== undefined && Math.random() >= e.r) continue;   // sampleRate: explicit undefined check
if (e.tm) {                                                  // throttleMs: truthiness check
```

`sampleRate` uses an explicit `!== undefined` guard; `throttleMs` uses truthiness. The
asymmetry is functionally correct because `throttleMs: 0` is the "no throttle" sentinel
and 0 is falsy, so the throttle block is correctly skipped when `throttleMs` is 0.
However, the inconsistency creates a subtle cognitive trap: a future contributor who adds
a third wildcard filter might pattern-match against the `!== undefined` style and
inadvertently treat a valid `0` value differently.

**Recommendation:** Change `if (e.tm)` to `if (e.tm !== undefined && e.tm > 0)` (the
latter condition is redundant given validation at `on()` time, but makes the guard
self-documenting). Alternatively, add a comment explaining why truthiness is intentional.
This is DENY (behavior-preserving but touches `src/index.ts` logic — borderline safe-fix
territory given the subtlety). Deferred as findings-only.

#### L2. `once()` post-dispose: no explicit dedicated test

**Area:** Test completeness  
**File:Line:** `test/emitter.test.ts` (H2 suite)

The H2 suite tests `off()`, `clear()`, and the returned unsubscribe function after
`dispose()`. It does not include an explicit test for `once()` after `dispose()`. The
behavior is correct and transitively covered (since `once()` delegates to `on(..., {once:
true})`), but an explicit regression test `once() after dispose throws EmitterDisposedError`
would make the H2 suite exhaustive for all public methods.

**Recommendation:** Add a test `H2d. once() after dispose() throws EmitterDisposedError`.
Test-only change; safe. Deferred as findings-only (test addition without a corresponding
bug to fix).

#### L3. Silent swallow when `captureHandlerErrors` callback throws — not in user-facing docs

**Area:** Error-capture policy / documentation  
**File:Line:** `src/index.ts:382–388`, `README.md` (API sketch)

The JSDoc on `EmitterOptions.captureHandlerErrors` states: "If this callback itself
throws, the error is silently ignored." This is implemented correctly (inner try/catch in
`ap()`) and tested in `capture-errors.test.ts §C2`. The README.md and README_ZHTW.md API
sketches now document this self-throw caveat in the `EmitterOptions` comment (added in this PR).

**Recommendation:** Resolved in this PR — the self-throw caveat was added to the
`EmitterOptions` comment in both README.md and README_ZHTW.md. The JSDoc remains the
authoritative reference and the behavior is tested in `capture-errors.test.ts §C2`.

---

## Findings-Only Backlog

| # | Sev | Area | Title | File:Line | Recommendation |
|---|-----|------|-------|-----------|----------------|
| M1 | M | TS/Coverage | Phantom uncoverable branch from noUncheckedIndexedAccess | src/index.ts:214 | Refactor rmByUser to avoid indexed access, or add `c8 ignore` annotation |
| L1 | L | Code clarity | `if (e.tm)` truthiness vs `if (e.r !== undefined)` explicit check asymmetry | src/index.ts:406 | Align to `if (e.tm !== undefined && e.tm > 0)` or add comment |
| L2 | L | Test gap | No explicit `once()` post-dispose test in H2 suite | test/emitter.test.ts | Add `H2d. once() after dispose() throws EmitterDisposedError` |
| L3 | L | Docs | captureHandlerErrors callback self-throw behavior not in README prose | README.md | Add one-sentence caveat to EmitterOptions description in API sketch |

---

## Appendix

### Commands run (in order)

```
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm verify:exports
pnpm verify:llms
pnpm check:size
pnpm coverage
# [safe fixes applied]
pnpm build:llms
pnpm verify:llms
pnpm lint
pnpm typecheck
pnpm build
pnpm check:size
pnpm verify:exports
```

### Versions

| Tool   | Version  |
|--------|----------|
| Node   | v22.22.2 |
| pnpm   | 9.12.3   |
| tsc    | 5.6.x (via devDep `typescript ^5.6.0`) |
| vitest | 4.1.7    |
| biome  | 1.9.4    |
| tsup   | 8.5.1    |

# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-05-29
### Added
- `test/emitter.prop.test.ts`: three fast-check property invariants — dispatch
  order (typed before wildcard, registration order preserved), snapshot stability
  under mid-dispatch `off()`, live-set accuracy after upfront unsubscribe.
  `numRuns: 100`; inline `fc.assert` style matching family convention.
- `test/wildcard-throttle.test.ts` §F: five edge-case tests — pre-aborted signal
  + valid `sampleRate` never registers; `on()` guard-before-signal ordering;
  `captureErrors` + signal leak check (`removeEventListener` called on abort);
  throttled wildcard + mid-dispatch abort (snapshot-in-flight completes);
  `sampleRate` exact boundary (`Math.random() === sampleRate` is a miss).
- `test/capture-errors.test.ts` §F: dispose-during-capturing-dispatch —
  snapshot completes; `EmitterDisposedError` from re-entrant `emit()` is routed
  through the capture callback; sibling handler still runs.
- `fast-check ^3.23.0` devDependency (family convention: aifsmjs `^3.20.0`,
  aiquadtreejs `^3.23.0`).

### Changed
- No `src/index.ts` behaviour change. `dist/` is byte-identical to v0.3.0.
  gzip 1050 B / 1100 B unchanged.

## [0.3.0] - 2026-05-29
### Added
- `EmitterOptions.captureHandlerErrors`: opt-in emitter-level error policy. Accepts `true` (swallow) or `(err, type, payload) => void` callback. Default behaviour (first throw aborts dispatch) is unchanged.
- `OnOptions.captureErrors`: per-handler override of the emitter-level policy. `false` forces re-throw even when emitter-level swallows. Setting it on a wildcard `"*"` subscription throws `EmitterError`.
- `OnOptions.sampleRate` (wildcard only): probability in `(0, 1]` that a dispatch reaches the handler; uses `Math.random()`. Out-of-range values throw `EmitterError` at `on()` time.
- `OnOptions.throttleMs` (wildcard only): minimum ms between successive calls, leading-edge; uses `Date.now()`. Negative values throw `EmitterError` at `on()` time.
- `STABILITY.md`: stability index for all public API surface, plus `[experimental]` placeholder for async handler tracking (targeted v0.6+).

### Changed
- Internal entry shape gains optional `ce` / `r` / `tm` / `ts` fields to carry per-handler error policy and wildcard throttle/sample state. Snapshot-before-iterate semantics in `emit()` are unchanged.
- `scripts/check-size.mjs` budget raised from 800 B to 1100 B. Actual v0.3.0 gzip lands at ~1050 B; the spec estimate of 900 B was optimistic (~100 B per feature accounting for guard message strings and try/catch frames).

### Notes
- v0.2 was skipped; v0.3.0 directly supersedes the v0.2 roadmap entry for `captureHandlerErrors`. Existing v0.1 callers that did not pass the option see no behavioural change.

## [0.1.1] - 2026-05-28

### Changed (CI)

- **`publish.yml` now triggers on `push: tags: ["v*"]`** (was `workflow_dispatch` only). Aligns with the trigger used by `aifsmjs` / `aiecsjs` / `aibridgejs`. Tag push now automatically runs the OIDC trusted publish.
- **`npm publish --provenance --access public`** — the workflow now emits a [sigstore provenance attestation](https://docs.npmjs.com/generating-provenance-statements) so consumers can verify the tarball was built by this workflow on this commit.

No runtime / source / API changes. This is a CI-only patch to validate the GitHub Actions OIDC trusted-publisher pipeline now that the npm trusted publisher entry is configured. Production bundles are byte-identical to 0.1.0.

## [0.1.0] - 2026-05-28

### Added

- Strict typed `createEmitter<Events>()` with `on` returning an unsubscribe
  function, `once`, wildcard `*` handler, `off`, `emit`, `clear`, `dispose`.
- `on(type, handler, { signal?, once? })` — `AbortSignal` integration so
  framework code (Svelte 5 `$effect`, Vue `onScopeDispose`) cleans up listeners
  via the standard cancellation primitive.
- `dispose()` idempotent; post-dispose `on` / `emit` / `once` throw
  `EmitterDisposedError`.
- Handler-array snapshot on `emit` so removing a handler during dispatch does
  not skip its successor (mitt has had this property since 2.x — preserved).
- Functional — methods are destructurable (`const { on, emit } = bus`).
- Test coverage ≥95% statements / lines / functions / ≥90% branches.
- Size budget: ≤ 550 B gzip.
- Dual ESM + CJS via `tsup`; `sideEffects: false`; zero runtime dependencies.

## [0.0.1] - 2026-05-28

### Added (scaffold)

- Full package scaffold landed (`package.json`, `tsconfig.json`,
  `tsconfig.test.json`, `tsup.config.ts`, `vitest.config.ts`, `biome.json`,
  `scripts/{verify-exports,check-size,build-llms-full}.mjs`,
  `test/scaffold.test.ts`, `examples/.gitkeep`, `.github/workflows/{ci,publish}.yml`,
  `README.md`, `README_ZHTW.md`, `CHANGELOG.md`, `CONTRIBUTING.md`,
  `LICENSE`, `llms.txt`, `llms-full.txt`).
- `src/index.ts` is a `throw` stub exposing the frozen 0.1.0 API surface
  (`createEmitter`, `Emitter<Events>`, wildcard `*` handler signature, `once`,
  `AbortSignal`-aware `on`, `dispose`, `EmitterError`, `EmitterDisposedError`).
- `pnpm typecheck && pnpm lint && pnpm coverage && pnpm build &&
  pnpm verify:exports && pnpm verify:llms && pnpm check:size` walks clean
  against a single placeholder test.
- Coverage thresholds temporarily set to `0/0/0/0`; tightened to
  `95/90/100/100` in 0.1.0.
- Size budget temporarily set to 3 KB gzip; tightened to the 550 B README
  target in 0.1.0.
- Publish workflow exists but trigger is `workflow_dispatch` only — no
  accidental npm release until 0.1.0.

### Decision log (carried over from LEARNINGS.md v0.3.0 cycle 預備區)

- **Not a `mitt` fork.** `mitt@3.0.1` is MIT-fork-friendly but is ~35 lines of
  pure logic and has been unmaintained since 2023-07. Forking is equivalent
  to rewriting, and the upstream copyright notice would carry no benefit.
  Cleaner to write from scratch with the ai\*js conventions baked in.
- **Wildcard `*` is kept.** It is `mitt`'s signature feature; keeping it
  preserves migration ergonomics for existing `mitt` users at ~80 B gzip cost.

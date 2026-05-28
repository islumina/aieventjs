# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

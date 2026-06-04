# Contributing to aieventjs

Thanks for taking the time to look. aieventjs is a deliberately small library
(target ≤ 1100 B gzip); contributions that keep the surface narrow are easier
to accept than ones that expand it.

## Quick start

```bash
pnpm install
pnpm test            # vitest
pnpm coverage        # vitest with v0.1.0 thresholds (95/90/100/100)
pnpm typecheck       # tsc --noEmit on strict mode
pnpm lint            # biome check
pnpm build           # tsup; dual ESM/CJS + .d.ts
pnpm verify:exports  # ensures package.json#exports matches dist/
pnpm verify:llms     # ensures llms-full.txt is in sync with README + CHANGELOG
pnpm check:size      # gzip per subpath against the size budget
```

## What gets in easily

- Bug fixes with a failing test added first
- README / typing corrections
- Tests that lock down existing behaviour (especially the re-entrancy
  invariant on `emit`)
- Performance work that keeps `on()` / `emit()` O(1) on the dispatch path

## What needs discussion first

- Anything that changes the public surface (`createEmitter`, `Emitter<Events>`,
  `OnOptions`, error classes)
- Namespaced wildcards (`user.*`) — explicit non-goal; bring `eventemitter2`
  if you need that
- Async / promise-returning handlers — explicit non-goal (handlers are
  synchronous; resolve promises in user-land)
- Anything that pushes the core gzip past 1100 B

## Design principles

aieventjs follows the ai*js library-core priority order:

> Security > Correctness > Simplicity > YAGNI > Performance

Key invariants:

- `on()` returns a callable unsubscribe; calling it (or aborting
  `opts.signal`) removes the handler in O(1).
- `emit()` snapshots the handler array before iterating — handlers added
  during dispatch do NOT fire this round; handlers removed during dispatch
  do NOT skip their successor.
- Wildcard `*` handlers fire AFTER type-matched handlers.
- `dispose()` is idempotent.
- All methods are destructurable: `const { on, emit } = bus` works.

## Commit & PR style

- Commit messages: imperative subject under 70 chars; body explains *why*.
- PRs: keep scope to one topic. Link the issue if any.
- Tests required for any behaviour change.

## Reporting issues

- Minimal reproduction welcome (paste the smallest `createEmitter` + on /
  emit sequence that shows the bug).
- For security issues, please email the maintainer rather than filing
  publicly.

## License

By contributing, you agree your changes will be licensed under the MIT
license that covers this project.

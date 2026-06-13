# Contributing to aieventjs

Keep the emitter small, synchronous, and predictable.

## Local workflow

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm verify:docs
pnpm build:llms
pnpm verify:llms
pnpm check:size
```

Run `pnpm lint` before PRs. If docs change, regenerate `llms-full.txt`.

## Rules

- Preserve snapshot-before-iterate dispatch semantics.
- Keep wildcard ordering after typed handlers.
- Add tests for `AbortSignal`, `once`, wildcard, throttle, sample, and error policy changes.
- Do not add async queueing to the stable emitter without a separate design note.

## License

MIT

# Changelog

All notable changes to aieventjs are summarized here.

## [Unreleased]

- Documentation-only slimming pass across README, stability notes, review backlog, and LLM context.
- Known follow-ups: consider monotonic `performance.now()` throttling and a clearer runtime guard for `once("*")`.

## [0.5.6] - 2026-06-10

- Hardened wildcard/once documentation and wall-clock throttle caveats.
- Kept typed dispatch, wildcard dispatch, and AbortSignal behavior stable.
- Regenerated generated LLM context from canonical docs.

## Older releases

- `0.5.5` through `0.5.1` focused on release hygiene, docs accuracy, and regression tests for wildcard/once/error behavior.
- `0.4.0` declared the stable ai*js surface.
- `0.3.x` added sampling, throttle, capture-error options, and public stability docs.
- `0.1.x` introduced `createEmitter`, typed `on/once/off/emit`, wildcard handlers, abort cleanup, and dispose semantics.

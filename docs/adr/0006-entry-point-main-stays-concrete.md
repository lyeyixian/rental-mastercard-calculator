# Entry-point `main()` functions stay concrete — no DI for testability

`src/index.ts` and `src/notify.ts` import concrete effects (`sendMessage`, `new Date()`, `createStateStore(STATE_FILE)`, `chromium.launch`) directly inside `main()`. An architecture review on 2026-05-27 flagged this as untestable orchestration and suggested lifting the effects into a `run({ now, store, send })` shell so each `NotifyAction` branch could be verified end-to-end with fakes. We rejected the refactor.

## Considered Options

- **Lift effects into `run(deps)` and write integration tests** — Rejected. The two adapters (prod + test) would satisfy the rule-of-two and the dispatch through `decideNotifyAction → renderMessage → persistNotifiedAt` would gain real coverage. But this is a one-laptop personal tool with a single owner. The bug classes integration tests catch (wrong-action dispatch, double-notify, off-by-one date logic) are already covered by the unit tests on `notifyDecision.ts` and `state.ts`. The additional safety doesn't pay back the deps-passing scaffolding.
- **Keep `main()` concrete** — Chosen. The orchestration in each entry point is ~25 lines of imperative composition and is exercised every month in production.

## Consequences

- A future architecture review will see two `main()` functions with concrete imports and almost certainly re-suggest this refactor. This ADR exists so it can be dismissed quickly.
- If the codebase grows a third entry point, or the dispatch logic in `notify.ts` gains more branches, this decision should be revisited — the cost-benefit shifts as orchestration grows.
- The `NotifyAction → message + persist` dispatch in `notify.ts` remains untested as a whole; reviewers and contributors should treat changes there with extra care since the safety net is exhaustiveness checking, not tests.

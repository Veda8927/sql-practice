# Contributing

Thanks for poking at this. The project is small and intentionally so — keep PRs focused.

## Dev setup

See [README.md → Quick start](README.md#quick-start). You'll need Docker, [uv](https://github.com/astral-sh/uv), and [pnpm](https://pnpm.io).

## Code style

### Python (backend)

- Formatter + linter: [ruff](https://github.com/astral-sh/ruff). Run `uv run ruff check . && uv run ruff format .`.
- Type hints required on public functions.
- Async everywhere. Don't introduce sync DB calls.

### TypeScript (frontend)

- ESLint via `next lint`. Run `pnpm lint`.
- Strict mode is on. Don't add `any` — narrow with a proper type guard.
- Components live under `src/components/`. Generic primitives go to `src/components/ui/`.

## Commit messages

Conventional Commits, lowercase scope:

```text
feat(frontend): add chat-style question bar
fix(backend): handle null status in orders grading
chore: bump postgres image to 16.3-alpine
docs: clarify give_up endpoint semantics
```

## Tests

There's no test suite yet (PR welcome). The grader and scenarios are the most valuable surfaces to cover — start with `app.grader._compare` and `app.data_gen.SCENARIOS`.

## PRs

- One topic per PR.
- If you change the UI, attach before/after screenshots.
- If you change the LLM prompts, paste a sample response in the PR description.

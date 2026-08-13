# TinyEnginy — working notes

Leads-management take-home. React + Vite frontend, Express + Prisma/SQLite backend, Temporal for workflows.

## Answering style

**Be brief.** I am working against a clock. Lead with the answer, cut the preamble, and stop.

- Findings: the fact and the `file:line`. No build-up.
- Trade-offs: name them in a line each, don't essay them.
- Skip recaps of what you just did — the diff shows it.
- Long prose is a failure mode here, not thoroughness. Expand only when asked.

**Always close with trade-offs and gaps.** After any change, state unprompted: the trade-off you
made and its alternative, what you deliberately didn't do, and anything you couldn't verify. A few
lines, not an essay. Say plainly when a code path is untested rather than implying it works.

## Running it (three processes, in this order)

```zsh
# 1 — Temporal first. The backend exits if it can't reach 7233.
temporal server start-dev            # server :7233, web UI :8233, in-memory

# 2 — Express API :4000 AND the Temporal worker, same process
cd backend && nvm use && pnpm run dev

# 3 — Vite :5173
cd frontend && nvm use && pnpm run dev
```

`nvm use` in **every** terminal. `.nvmrc` says `v22` → resolves to v22.23.2. A fresh shell
defaults to v20.11.1, which is below pnpm 11's v22.13 floor.

`backend/prisma/dev.db` is tracked in git and dirties whenever the app is used — `git restore` it
rather than committing the churn. Stop the backend first; swapping the file under a live SQLite
connection can corrupt it.

## Architecture

- **`backend/src/index.ts`** — every Express route and all business logic inline. Also calls
  `runTemporalWorker()`, so API and worker share one process.
- **`backend/src/workflows/`** — `workflows.ts` (definitions), `activities/` (side effects).
  Workflow code must stay deterministic, so every read and write lives in an activity.
- **`frontend/src/api/`** — typed layer worth matching. `types/leads/<op>.ts` declares
  `<Op>Input`/`<Op>Output`; `modules/leads.ts` wires them through `endpoint(method, path)`;
  `mutations/useApiMutation.ts` holds react-query options incl. optimistic updates.

## Conventions

Prettier (identical both sides): **no semicolons**, single quotes, 2-space tabs, printWidth 110,
trailingComma es5. Match it — `pnpm format` in either directory.

Tests are vitest: `pnpm test`. Frontend also has `pnpm lint` (max-warnings 0).

Prisma: after editing `schema.prisma` → `pnpm migrate:dev` then `pnpm gen:prisma`.

## Git — read before any write

`origin`'s **push URL is deliberately set to `DISABLED`** so pushes to the evaluator's repo fail
closed. Fetch works. Don't "fix" it.

**Never commit or push without me asking for that specific action.**

**The disabled push URL does not cover GitHub API writes.** `gh pr review`, `gh pr comment`,
`gh issue` and `gh api` writes go over HTTPS with an OAuth token and bypass the git remote entirely
— they would succeed and be immediately visible to the evaluators. **Never post anything to
GitHub** without me asking. Reading (`gh pr view`, `gh pr diff`, `gh pr list`) is fine.

## Database — I run these, not you

**Never run migrations or database commands.** No `prisma migrate dev`, `migrate deploy`,
`migrate reset`, `db push`, or `sqlite3` writes. `migrate dev` in particular offers to reset the
database when it detects drift, which wipes the seed leads. Tell me what needs running and I'll run
it in my own terminal.

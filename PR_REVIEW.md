# Review — PR #1 `feature/implement-gender-guessing`

Reviewed against `main` @ 9c0bd3e. Line numbers are on the PR head unless stated.

---

## 1. CSV gender import is dead code — the modal never sends it

`frontend/src/components/CsvImportModal.tsx:96-103` (not touched by this PR)

The whole gender path is wired *except* the one place it has to cross the wire: the parser
extracts and normalizes `gender`, `LeadsBulkImportInput` accepts it, and the backend persists it
(`backend/src/index.ts:303`) — but `leadsToImport` maps only `firstName`, `lastName`, `email`,
`jobTitle`, `countryCode`, `companyName`. Importing a CSV with a `gender` column silently drops
every value.

Worse than a no-op: a row with `gender=invalid` is marked `isValid: false` by the new check in
`csvParser.ts:108-110`, so the *whole lead* is now rejected over a field that would have been
discarded anyway.

Add `gender: lead.gender || undefined` to the payload, and show the column in the preview table
(`CsvImportModal.tsx:241`, `:311`) so users can see what was parsed.

**Blocking.**

## 2. Unbounded serial fetches inside the HTTP handler

`backend/src/index.ts:199-228`

One `fetch` per lead, sequentially, with no timeout and no retry, all inside the request that the
browser is waiting on. 50 selected leads is 50 serial round trips; Node's `fetch` has no default
request timeout, so a single stalled connection holds the response open for minutes.

This is the same failure mode as the verify-email hang fixed in 9c0bd3e, reintroduced in a
different endpoint.

Minimum fix: `AbortSignal.timeout(5_000)` on the fetch. Better: genderize supports batching —
`?name[]=a&name[]=b` up to 10 names per call — so chunk the leads and dedupe repeated first names
before calling (a 200-lead list is often <100 distinct names, and the free tier is metered per
name). If you want retries and observability to match `verify-emails`, this belongs in a Temporal
activity rather than inline.

**Blocking.**

## 3. Confidence is discarded, and misses overwrite existing data

`backend/src/index.ts:210-218`

genderize returns `probability` and `count`; both are dropped. A name resolved at 0.51 with
`count: 3` is stored exactly like one at 0.99 with `count: 50000`, and downstream there's no way to
tell a guess from a fact. For a feature whose entire output is a guess, that's the thing worth
persisting.

Separately, when the API returns `gender: null` the code writes the literal `'unknown'` over the
existing value — so re-running the guess on a lead whose gender came from the CSV replaces
user-supplied data with a failed lookup. Skip the write when the API can't resolve the name, and
either store `probability` or threshold on it (e.g. <0.8 → leave null).

## 4. `gender` enters the DB unvalidated on bulk import

`backend/src/index.ts:303`

`lead.gender.trim()` trusts the client. `isValidGender`/`normalizeGender` exist only in
`frontend/src/utils/csvParser.ts:21-33` — a direct POST to `/leads/bulk` puts any string into the
column, and the badge rendering in `LeadsList.tsx:314-320` falls through to the neutral style for
anything unrecognised. The validation belongs on the server; the frontend copy is UX.

Given the column is a free-text `String?` with exactly three intended values, an enum (or a CHECK
constraint) would be stronger still — worth a line in the PR description if it was a deliberate
call.

## 5. Total failure is reported as success

`frontend/src/components/LeadsList.tsx:61-65`

When `updatedCount === 0` and every lead errored, the message is correct but it's shown via
`toast.success` with a green tick. Use `toast.error` in that branch.

Related: `updatedCount` counts leads set to `'unknown'`, so "Successfully guessed genders for 12
leads" can mean 12 lookups that resolved nothing.

---

## Notes (non-blocking)

- **Conflicts with `main`.** The branch predates 9c0bd3e, which rewrote the same enrich-dropdown
  block in `LeadsList.tsx`. Rebase, and pick up that commit's loading-toast pattern
  (`toast.loading` held for the run, replaced in place) rather than the bare spinner here —
  #2 makes this run long enough to need it.
- **`GENDERIZE_API_BASE_URL` is undocumented.** `dotenv` was added as a dependency but there's no
  `.env.example` and no README line; the default keeps it working, so this will only bite whoever
  tries to point it at a mock.
- **No test covers the new endpoint.** The parser additions are well covered
  (`csvParser.test.ts:23-60`, `:266-296`), including the `m`/`f`/`u` normalization — the backend
  side has none, and #3's confidence handling is exactly the logic a test would pin down.
- **Lockfile churn.** `backend/pnpm-lock.yaml` lost ~1176 lines while gaining one dependency. I
  checked: package count goes 632 → 633 and resolutions 407 → 408, so nothing was dropped — it's a
  different pnpm version reformatting the `snapshots` section. Harmless, but it inflates the diff.

## Verdict

**Request changes.** The feature works for the button path and the UI/API layering is clean and
matches existing conventions. But the CSV half of the feature is inert (#1) and the endpoint can
hang the request the same way verify-email did (#2) — both need fixing before merge. #3 is a
design question worth answering in the PR description even if the answer is "later".

Not verified: I read the diff and did not run the app, the frontend tests, or `tsc` against this
branch. Formatting is untouched as a finding — `LeadsList.tsx` already fails `prettier --check` on
`main`, so that's pre-existing, not this PR.

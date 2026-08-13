# Task plan

## 1 — Bug: CSV country codes

`Manual`

**Task description from README**

> When importing leads from CSV using the example file, the country column displays garbled
> characters instead of valid country codes.

**Prompt**

> As a user, I want to import leads from a CSV. I import csv files from the docs directory via
> Import CSV, and the Country column shows garbled characters instead of valid country codes.
> Reproduce it and show me the actual bad value before changing anything, then fix the cause.

## 2 — Feature: New lead fields

`Plan mode` → `Auto` once the approach is agreed

**Task description from README**

> Add three new data points for leads: **phone number**, **years at current company**, and
> **LinkedIn profile URL**.
>
> Users should be able to: see these fields in the leads table; set them via CSV import; use them in
> message composition.
>
> Since the field list will keep growing, the message composition UX needs to scale accordingly (no
> design provided).

**Prompt**

> As a user, I want three more data points on my leads: phone number, years at the current company,
> and LinkedIn profile URL. I need to see them in the leads table, set them via CSV import, and use
> them when composing messages.
>
> There's no design for this, and the field list will keep growing. My musts: the field selection
> area should have a search box, and each field should indicate whether the selected leads actually
> have a value for it.
>
> Show me your approach before implementing, and tell me where you'd disagree with mine. Don't run
> migrations or any database commands — I'll run those myself.

## 3 — Bug: Email verification stalls

`Manual`

**Task description from README**

> The email verification process hangs indefinitely for some leads and never reports a success or
> failure outcome.

**Prompt**

> As a user, I want to verify an email from the leads table. I select Jane Smith's lead, run Verify
> Email from the Enrich dropdown, and the response hangs indefinitely. Analyze the issue, fix it and
> add feedback to the user: at least a persistent indicator while loading and a (temporary)
> notification when finished (success or error).
>
> I analyzed the codebase myself and saw hardcoded values for jane.smith and john.doe. Is this
> affecting the issue?

## 4 — PR review

`Manual` · read-only, nothing posted

**Task description from README**

> Review the open PR as if it were from a teammate. Leave inline comments where relevant and provide
> a summary with a clear approve or request-changes decision.

**Prompt**

> I've reviewed PR #1 `feature/implement-gender-guessing` myself and left a couple of comments.
> Review it independently — I want a second opinion, not a continuation of mine, so I'm not telling
> you what I found. Comments keyed to `file:line`, then a summary with an explicit approve or
> request-changes. Prioritise: the few that matter, not everything you can find. Draft to
> `PR_REVIEW.md`. **Do not post anything to GitHub** — I post it myself.

## 5 — Codebase Analysis & Roadmap

`Edit-auto`

**Task description from README**

> Create an `IMPROVEMENTS.md` file as if it were a document in our project management tool.

**Prompt**

> `IMPROVEMENTS.md` has a `## Raw notes` section — my observations from working through this
> codebase. Restructure it in place into a codebase assessment and roadmap. My notes are the
> backbone: keep every one, sharpen and group them, drop the heading. Don't invent findings to pad
> it, don't discard one for looking minor. Ground every item in a file or line, sequence by impact
> and effort, and say what you'd _not_ do.

## 6 — Feature: Enrich phone

`Plan mode`

**Task description from README**

> Implement a Temporal workflow that finds a lead's phone number by querying three providers in
> sequence: Provider One → if no phone found, Provider Two → if no phone found, Provider Three → if
> no phone found, mark as **No data found**.
>
> **Requirements:** each provider call is an activity with a short timeout and a retry policy (e.g. 3
> attempts, exponential backoff); stop early when a phone is found; idempotent workflow (only one per
> lead); abstraction layer to handle different provider inputs; show process feedback to the user;
> update frontend accordingly.
>
> **Nice to have:** take into account provider rate limits — unlimited RPS/RPM now, but they will add
> limits.

**Providers**

|          | Orion Connect                      | Astra Dialer                           | Nimbus Lookup                           |
| -------- | ---------------------------------- | -------------------------------------- | --------------------------------------- |
|          | best data, slow, fails sometimes   | worst data, fastest                    | new                                     |
| URL      | `/api/tmp/orionConnect`            | `/api/tmp/astraDialer`                 | `/api/tmp/numbusLookup`                 |
| Request  | `{fullName, companyWebsite}`       | `{email}`                              | `{email, jobTitle}`                     |
| Auth     | header `x-auth-me: mySecretKey123` | header `apiKey: 1234jhgf`              | query `?api=000099998888`               |
| Response | `{phone: string\|null}`            | `{phoneNmbr: string\|null\|undefined}` | `{number: number, countryCode: string}` |

Base URL: `https://api.enginy.ai`

**Prompt**

> Implement a Temporal workflow that finds a lead's phone by calling Orion Connect → Astra Dialer →
> Nimbus Lookup in sequence, stopping at the first hit, marking "No data found" if all three miss.
> Spec and provider details above. Each provider is an activity with a short timeout and a bounded
> retry policy. Idempotent per lead. The three providers disagree on request shape, auth and response
> field names, so the abstraction layer is the interesting part. Prioritise design over completeness,
> and tell me what you're leaving unbuilt.

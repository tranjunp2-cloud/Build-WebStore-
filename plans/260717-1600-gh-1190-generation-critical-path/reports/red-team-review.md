# Red-Team Review - GH-1190 Plan

## Verdict

Proceed. The plan is implementable without a queue if product/blog fallback media is visible before `done` and deferred work only upgrades relevance.

## Challenges and Resolutions

### 1. "Defer images" can repeat the #1644 regression

- Failure: a shared promise or shared pool lets product work consume/block page media; `done` arrives with fallback blocks.
- Resolution added: page/block media is a named mandatory barrier; product/blog fallback media is also required. Better-match enrichment has separate promises and exact-row ownership. Regression tests delay enrichment and require no empty image slots at `done`.

### 2. `after()` is not a durable queue

- Failure: Vercel terminates deferred work at function duration; rows stay permanently un-enriched.
- Resolution added: every deferred operation is bounded, returns its Promise to `after()`, preserves visible fallback media, and is canaried. Target `done` <=50s and stop all upgrades by <=58s. If that cannot fit, open a durable-job follow-up.

### 3. Timeout policy may trade latency for low-quality fallback

- Failure: aggressive timeout sends too many runs to composer and passes SLA by lowering quality.
- Resolution added: benchmark fallback rate and five-page/content quality alongside latency. Keep one structural retry only when budget remains; network timeout falls back directly.

### 4. Request ID alone does not provide idempotency

- Failure: serverless instances cannot dedupe from logs or memory.
- Resolution added: plan does not claim backend resume/dedupe. Immediate fix stops browser re-POST after stream acceptance. Durable idempotency remains out of scope.

### 5. Moving work behind first SSE event can weaken authorization

- Failure: stream says accepted before subscription/tenant eligibility is known.
- Resolution added: auth, rate limit, input validation, tenant isolation, and subscription remain before acceptance. Translation and capture move after it.

### 6. p95 benchmark can be gamed

- Failure: exclude failures/cold starts or compare different flags/cohorts.
- Resolution added: fixed cohort, >=20 successes/language, separate failure rate and cold/warm classification, record effective flags/deployment SHA, retain all failed attempts.

### 7. Route `maxDuration=60` conflicts with `after()`

- Failure: `done` is fast but deferred tasks are killed, violating enrichment expectations and repo deployment rule.
- Resolution added: enforce 60 only after required plus deferred work is bounded. Failure triggers architecture escalation, not a silent timeout increase.

### 8. Product/blog rows before `done` still allow stale updates

- Failure: regeneration deletes/replaces rows while old enrichment finishes.
- Resolution added: closures receive exact created IDs; updates re-read row ownership/state and skip deleted, reassigned, or already-enriched rows.

## Rejected Alternatives

- Full BullMQ/queue/job table: stronger durability, disproportionate for current issue and requires schema/worker/UX changes.
- Parallel Payload media creates: known transaction race; keep global lock.
- Raise warning to 90s: hides AC4 without satisfying p95 SLA.
- Fire-and-forget promises outside `after()`: unreliable on Vercel.
- Defer all products/blogs: repeats incomplete-preview behavior and violates issue acceptance criteria.

## Remaining Decision

QC should confirm that an on-topic fallback image which is later upgraded does not violate the completeness AC. Blank images, grey boxes, placeholder text, and missing rows remain explicitly disallowed.

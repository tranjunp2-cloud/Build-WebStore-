# F40 — QA ingest data contract

`POST /api/admin/qa/ingest` is an internal endpoint used by the staging GitHub Actions workflow after a terminal test suite finishes.

- Send the exact JSON body with `x-qa-timestamp` (Unix seconds or milliseconds) and `x-qa-signature: sha256=<hex>`.
- The signature is HMAC SHA-256 of `${timestamp}.${rawBody}` using `QA_INGEST_SECRET`. Requests older than five minutes are rejected.
- The idempotency key for a run is `(workflowRunId, attempt, targetId, suite)`. An exact duplicate body returns the original run without writes; a different body for that terminal key returns `409`.
- A change snapshot is immutable by `(pullRequest, commitSha, environment)`. Its canonical digest is checked on retry: a different mapping for the same immutable key returns `409`. It includes changed paths, mapped target IDs and unmapped paths, never a raw source diff.
- Results accept only structured metadata: `assertionCode`, optional expected/actual counts and duration. Do not send free-form CI output, cookies, authorization headers, raw HTTP bodies, traces, screenshots or video.
- An artifact is stored only as a temporary HTTPS URL from `QA_ARTIFACT_ALLOWED_HOSTS` under `/sanitized/`, with an exact `expiresAt=<ISO date>` query parameter matching `artifactExpiresAt`; it must expire within seven days.
- The server derives terminal run status from testcase results. A request is streamed with a 1 MB cap and is committed atomically.

Studio uses `GET /api/admin/qa/runs` for safe run summaries and `GET /api/admin/qa/change-snapshots` to show mapped targets and coverage gaps. Both read endpoints require a super-admin session.

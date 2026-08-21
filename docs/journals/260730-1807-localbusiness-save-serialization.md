---
date: 2026-07-30
session: F37 localBusiness save serialization
---

# Journal: 2026-07-30 — Local Business Save Serialization

## Context

PR #1708 saved a full `localBusiness` snapshot for every field edit while allowing address PATCHes to overlap. A slower older request could therefore finish last, overwrite newer state/city/postcode values in storage, and silently break #1309 AC-1 after reload even though the optimistic UI still showed the newest values.

## What Happened

- `SettingsPanel` now emits a sparse edited-field patch, including the required `MY` country backfill.
- The Editor parent owns the latest full snapshot and a per-site single-flight save queue. Later same-site edits are coalesced into one queued snapshot and sent only after that site's active PATCH settles.
- Queue batches, in-flight locks, and revisioned snapshots are keyed by `siteId`. Navigation preserves queued work for the previous site, lets the new site save independently, and cancelled loads cannot install stale data for another site.
- Deterministic regressions defer save and load responses to prove no same-site overlapping PATCH is issued, the follow-up contains every newest address value, site A data cannot drain through or block site B, and late A data cannot replace B.
- Merged `origin/staging` at `b26637321` and resolved the builder save-guard conflict by retaining both delayed-reset stabilization and staging's connection-loss assertion.
- A revisioned snapshot and queue are retained per site. Site navigation no longer drops queued work, and a same-site page refetch cannot replace pending edits with an older DB snapshot.
- Save analytics moved to the queue owner and now fire once per successful persisted batch using that batch's full snapshot.
- Verification passed: focused editor regressions 48/48, expanded F37 gate 136/136, builder conflict regression 6/6, TypeScript typecheck, lint with existing warnings only, clean production build, `git diff --check`, and the unmerged-path check.

## Reflection

The existing E2E waited for every PATCH before editing the next field, so it proved sequential persistence but could not exercise the real autosave race. Full-group writes are safe only when one owner controls ordering and builds each request from the latest aggregate state.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Serialize and coalesce in the Editor parent | The parent survives panel rerenders and owns authoritative optimistic state | At most one `localBusiness` PATCH per site is active; later same-site edits collapse into the newest full snapshot |
| Keep child updates sparse | A render-stale child must not reconstruct and submit sibling fields | Field edits cannot directly reintroduce stale state/city/postcode values |
| Preserve queued batches per site | Navigation must not silently resolve unsaved edits as false | Site A finishes through the site A endpoint while site B saves independently |
| Guard hydration with per-site revisions | A same-site page reload may return an older DB snapshot while autosave is pending | Pending optimistic state remains authoritative until its batch settles |
| Emit analytics in the queue owner | Coalesced child promises otherwise duplicate events and use render-stale counts | Exactly one event per successful persisted batch, counted from that batch snapshot |
| Scope batches, locks, and loads by `siteId` | A queue or request can outlive a client-side route transition | Prevents cross-site writes, cross-site blocking, and stale-load snapshot replacement |
| Use deferred-response regression tests | Request ordering must be deterministic to reproduce the loss | Guards both same-site out-of-order completion and cross-site queue isolation |

## Next Steps

- After final review approval, commit and push the resolved branch so PR CI can validate the same gates.
- Keep the guarded live-staging F37 persistence run as the remaining environment-level evidence.

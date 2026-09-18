# V3 classification / artifact review — 2026-09-17

Scope: classification.ts, diagnostics.ts, artifact.ts, credentials.ts, runner.ts against phase07. Independent source review; no DB writes or application edits by reviewer.

## Findings and correction status

1. **P1 — Diagnostic Store ownership was not cross-checked before selected-scope exclusion.** A source-row diagnostic could name an unrelated/unselected Store and disappear from gates although its classified row belongs to selected scope. Accepted fix: classifier records compact source diagnostics, validates them against report ownership, and emits global SOURCE_CLASSIFICATION_INVALID on mismatch. Present in source. Global diagnostics remain global; known ref normalization requires matching source table.
2. **P1 — Diagnostic retention bounded count but not bytes.** Up to100000 buckets/five samples plus unbounded code strings could retain excessive memory before blocked input was rejected. Accepted fix present: code max128, metadata max512, approximate retained key/group/sample budget128MiB. This is a defensive metadata limit, not a measured RSS ceiling.
3. **P1 — Leaf compression makes diagnostic cross-check depend on report JSON property order.** With store_deliveries source123 owned by205, diagnostics-first validates; rows-first loses original leaf identity and produces SOURCE_CLASSIFICATION_INVALID. Synthetic in-memory reproduction confirmed both outputs; tester added a reproducing artifact regression. Corrected: root added two-pass report stream (diagnostics before rows, both pinned to expected hash). Final source re-review and rows-first artifact regression PASS.
4. **P1 — Leaf compression no longer rejects duplicate source identities.** Two store_deliveries rows with sourceId123 and sequential record1/2 collapse into one synthetic leaf entry; finish returns no error. Parent tables remain checked; the eight reconciliation tables are separately checked, but this leaf is outside both safeguards. Confirmed with synthetic in-memory reproduction. Corrected: every leaf identity is fingerprinted before aggregation; repeat identity or fingerprint collision fails closed. Source-count1M and estimated metadata128MiB caps remain. Final same-owner/cross-owner duplicate regressions PASS.

## Other checked behavior

Exact contract/version/profile dispatch, both receipt hashes in prepare manifest/credential AAD/batch binding, and mutation hash rechecks are present. Master precedes report/receipts independent of manifest artifact key ordering. Unknown/global business diagnostics remain blocking. Page-only model_settings discharge now requires parent identity and valid ownership shape; malformed owner/store or retention-rule placement throws structurally. Missing fieldRetentionRules alone is not a defect: upstream approved policy/archive paths legitimately omit explicit rules.

Subscription no-cancellation warning is target-check-required and checked against emitted source entity canceledAt=null with no fabricated canceledImmediately field. Creator binding and tenant slug schema gates remain independent. No additional unsafe acceptance was found in the reviewed credential/profile wiring.

## Limits

The existing per-Store memory check happens after assembling/stringifying a Store; the index/collector limits do not prove arbitrary single-Store masters have bounded RSS. Current whole-artifact performance and real data readiness must come from their own evidence. Review reproduction used metadata only and performed no DB/file mutation beyond this report.

Final verification reported by tester: full116tests/9files PASS (34v3), typecheck PASS after both final fixes. Synthetic profile3 clone evidence `/tmp/pw1-cli-rehearsal-1789638687596` preceded the final two-pass/duplicate-reader fixes; no DB rerun after those read-only changes. No unresolved source defect remains from this review; real-source gate status belongs to the actual artifact report.

Intermediate caveat (superseded by structural result below): root reported classification-001 validation fails CLASSIFICATION_MEMORY_LIMIT with the compact index. That is an unresolved real-input compatibility/resource gate; the source-review corrections and116test pass do not establish actual artifact readiness. Classifier owner is investigating further compaction; later changes require their own re-review/tests.

Resource follow-up:922580rows measured estimated245398940B metadata and standalone peakRSS526864KiB. Root approved256MiB classifier metadata budget with1Msource-row limit unchanged; including diagnostic ownership checks and whole-loader validation remains pending. Diagnostic collector retains its separate128MiB limit. This is an explicit bounded-budget revision, not evidence of256MiB whole-process RSS. Five global-invalid tables remain under investigation; no new source acceptance claim.


Final narrow review of real-data conventions: shipping fallback normalization applies only to three documented fallback reasons and exact Store-ID identity; shared global Page definitions apply only to the specified raw-structure diagnostic signature; banner mismatch retains the original blocker. Other diagnostic ownership mismatches remain fail-closed. Classification finishes and releases general maps before receipt validation; Page-only discharge metadata remains available. Both diagnostic checks and source rows are charged to the same256MiB metadata counter.

One final compression edge was corrected during review: duplicate model_settings identity split between resolved leaf storage and unresolved indexed storage. All model_settings identities now share duplicate detection regardless storage mode. Fresh direct synthetic check rejected both insertion orders with CLASSIFICATION_DUPLICATE_SOURCE. No additional safety defect found in this final narrow review. Actual CLI dry-run outcome is still reported separately; this is not real apply approval.


Latest frozen-code evidence: full128/128tests9files PASS,46v3cases, typecheck and gitdiffcheck PASS. Whole real-artifact CLI validation subsequently reached ARTIFACT_CHECKED with both receipts/master coverage valid and no classification/memory failure. Completed dry-run remains exit3 semantic-blocked; final Page-only correction run subsequently completed as documented below. The remaining role blocker concerns one model_has_roles row sourceId record:5753 referencing absent users5753, with3diagnostics—not5753occurrences. No real apply claimed.


Final actual CLI outcome supplied by root: ARTIFACT_CHECKED with both receipts/all hashes valid; exit3 ARTIFACT_BLOCKED and blockerCount3 exactly SOURCE_OWNERSHIP_UNRESOLVED, SOURCE_FIELDS_UNRESOLVED, REPORT_ROW_UNRESOLVED for the orphan role row. No Page/classification-invalid/memory-limit errors. Two pending target checks: SUBSCRIPTION_CANCEL_FLAG_ABSENT and TARGET_USER_CREATOR_BINDING_REQUIRED. Fresh real clone retains0batches; no actual-source apply. Source/target business readiness remains blocked despite completed structural validation and regression verification.

# Phase07 — Exporter1.2 compatibility and selected-source rehearsal

Status: selected Store205 actual-source VERIFIED on local clone; broader real-Store coverage remains unverified.

- [x] Strict exporter1.2/hash27fbef7ec0fc73e58029295c8fbbe7d276c4d6095e358fe57e3058e1eb4f4567 dispatch; keep old profiles exact. New import version3/profilepw1-json-v3 pins classification and both receipt hashes in manifest/credential AAD/batch.
- [x] Stream master then report then reconciliation receipts independent of manifest key order. Bounded semantic indexes validate source ownership, receipt closure, null/quarantined targets and source snapshot. No full-report/master buffers.
- [x] Validate typed ownership/retention evidence; preserve all raw diagnostics and derived dispositions. Page-only records excluded as authorized; unknown global/business fields remain blocked. Selected-scope orphan handling requires exact parent/source evidence and proves no selected dependency; never blanket-ignore global warnings or model_settings.
- [x] Resolve documented NO_CANCELLATION_DATE warning only against actual emitted subscription state; no fabricated canceled flag.
- [x] Select Store inventory before spooling to avoid unnecessary resource use. Supply useful prerequisite errors; preserve CREATE/verifiedREUSE/resume safety and actor verification.
- [x] Ledger/SQL profilev3 upgrade verified twice on new disposable clone; no source DB writes or old partialrun rebind.
- [x] Regression tests + typecheck: full128tests/9files PASS;46v3cases include report key-order and duplicate-leaf identity corrections.
- [x] Synthetic v3 actual CLI apply/verify/replay/resume PASS on disposable clone.
- [x] Whole real-artifact structural validation completed after historical prepare failure; selected dry-run executed and BLOCKED.
- [ ] Final selected semantic preflight PASS and actual-source apply; final dry-run completed exit3 with3orphan-role diagnostics.
- [ ] Real apply: only after source gates, correct credentials and authoritative creator51 binding; one orphan model_has_roles row sourceId`record:5753`→users5753 still requires disposition evidence/decision (3diagnostics;5753 is an ID), never fabricated approval.
- [x] Update runbook/plan/evidence. No commit/push, no Vercel/pages work.

Current source: worktree2 `.migration/exports/pw1-prod-20260917-classification-001`; hashes verified previous review.2918source/2799emitted/118blocked/1deferred.205/285 each4foundationentities, only perStorecreatorblocker; globalorphan model_has_roles1/model_settings26/shortlist_items4749 need evidence-aware handling. Current local private env key values are not logged; Store205 crypto correctness has now been verified separately (see final evidence below), other Store coverage is not implied. Structural profile changes invalidate previouspartialbatches.


## Demonstrated evidence and remaining gates

Clone `pw1_import_1886_v3_20260917`, private synthetic evidence `/tmp/pw1-cli-rehearsal-1789638687596`: profile3 and both receipts checked;18entities/2Stores; dry-run unchanged tracked counts, apply SIGINT exit4 after Store1, resume exit0, new batch REUSE18, actor/password/schema checks and alias/drift rejection. Main `json:0310dec1-122e-4c28-8caa-048b7caa449a`; replay `json:0ae8d3aa-504b-4ec6-a87d-41f4531e9ef9`.

DB rehearsal preceded final two-pass report-reader and duplicate-leaf hardening. Full116tests/9files and typecheck passed afterward; no DB rerun for those reader-only changes. [Independent review](reports/260917-v3-classification-review.md) findings corrected. Do not conflate this with actual-source acceptance.

Current real publication is classification-001. Earlier prepare/validation memory failures are historical; final CLI verified whole-master coverage/hash/classification and both receipts using `/home/liam/migration-data/pw1/local-20260917/prepared-v3-preflight/import-manifest.json`. Original prepare exit2 is not relabeled exit0. **Final Store205 dry-run exit3 ARTIFACT_BLOCKED, blockerCount3**: SOURCE_OWNERSHIP_UNRESOLVED + SOURCE_FIELDS_UNRESOLVED + REPORT_ROW_UNRESOLVED for one model_has_roles source row`record:5753`→missing users5753. No remaining Page/classification/memory blocker.

TARGET_CHECKS_PENDING2: SUBSCRIPTION_CANCEL_FLAG_ABSENT and TARGET_USER_CREATOR_BINDING_REQUIRED. Source gate stops before target checks can discharge. Fresh real clone has0migration_import_batches after dry-run; no actual-source apply. Two external decisions remain: creator51 authoritative mapping to existing target User, and orphan-role disposition.5753 is an identity, not a count.


Latest bounded-resource investigation:922580classification rows consume estimated245398940metadata bytes (~234MiB); standalone peakRSS526864KiB (~515MiB). Root approved explicit256MiB classifier metadata cap, retaining1Mrow limit; implementation/accounting of diagnostic ownership checks reviewed; actual-loader structural revalidation completed; final semantic dry-run completed and BLOCKED. Do not describe this as whole-process256MiB RSS. Five artificial global-invalid tables were resolved by narrow exporter conventions; original semantic blockers remain, with no blanket waiver.

Fresh real-source baseline clone `pw1_import_1886_real_20260917` created; all3schemahelpers twice PASS. Private `clone.env` under `/home/liam/migration-data/pw1/local-20260917/` contains DATABASE_URI only (0600; parent0700); source it before npm to override `.env.local`. No actual-source apply claimed.


Store205 credential check: STORE205_CREDENTIAL_CRYPTO_VERIFIED exit0; v3sidecarAEAD, fullmasterhash streaming, LaravelMAC/decrypt, bcryptmatch và SSOkeyshape PASS, không DB writes. Đây là kiểm chứng crypto cho Store205, không chỉ presence env và không chứng nhận mọi User/Store hoặc DB-import roundtrip.

Latest frozen code: full128/128tests9files, typecheck and gitdiffcheck PASS. Users CSV5893rows independently confirms users5753 absent. Final CLI result is exit3 with exactly3diagnostics for one orphan row; target checks2pending and0actualbatches.


## Selected-scope correction — latest evidence

User explicitly corrected the import boundary to selected mapped master dependencies. Implemented bounded source-scope index, reachable external creator ancestry and selected report contributions. Proven unrelated orphan rows remain auditable as OUT_OF_SCOPE; missing actual dependencies and unknown/structural failures still block. Nine new v3 regression cases cover mixed summaries, selected/unselected/all, direct User references, report contributions and creator ancestry.132tests/7files and typecheck PASS.

Actual apply Store205 now clears source-report gating and ends at CREATOR_BINDINGS_REQUIRED (exit3). Role5753 no longer requires approval to exclude for this Store; it is proven unrelated. Creator51 target binding is still required because master references it. Subscription target check is not yet reached. Clone counts unchanged (tenants1212/users1279/sites1203/plan_subscriptions1266), zero import batches. Earlier3-source-blocker results above are historical, superseded by this evidence. No business DB writes, commit or push.


## Actual Store205 completed — latest 2026-09-17

Operator identified system user email sso-service@primeweb.app. Exact clone lookup resolved User7; prepared new hash-bound creator51 binding and encrypted artifact, PREPARED exit0. Store205 actualapply exit0 VERIFIED, batch json:2d61fef5-3689-4d03-80da-265823fd1540,4creates/0reuses. User432→User1354 createdBy7 verified independently. System User row and roles/memberships/permissions fingerprints unchanged. Counts: tenants1213/users1280/sites1204/subscriptions1267/batches1. Earlier remaining creator/orphan blockers are historical for this Store; no further decision needed for this completed run. This validates foundation entities for Store205, not all Stores or live migration.

- [x] Selected Store205 semantic preflight and actual-source apply verified on clone.
- [x] Creator resolution uses operator-specified system user, preserves existing account.
- [x] Runbook updated with prepared-v3-system path and actual batch evidence.

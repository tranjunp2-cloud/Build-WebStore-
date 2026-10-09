# Independent creator-binding review — 2026-09-17

Scope: creator-bindings.ts, ledger.ts, projection.ts, writer.ts, Users.ts; read-only source review against phase05. No application edits, database writes, or production sign-off in this review.

## Findings accepted for correction

1. **P1 — Unstructured evidence does not establish the declared source-to-target decision.** `creator-bindings.ts:91` checks only private evidence bytes/hash; lines144–147 accept `operator-approved` without a prior claim. An arbitrary file plus target ID/email identity hash passes without evidence naming the source/target pair or approval decision. Require a typed evidence record bound to source namespace/ref, target instance/ID/expected identity, and explicit operator approval record; reject mismatches. Regression: unrelated evidence with a valid hash must fail before any business write.
2. **P1 — Target alias detection is limited to the current binding file.** `creator-bindings.ts:135` rejects duplicate target IDs only within supplied entries; `ledger.ts:272` checks only the current source-key owner. Sequential batches can bind actor A and actor B from the same source instance to the same existing target User. Under the target User row lock, reject an active users claim for the same source instance/target and a different source ID; verify this in preflight and final verification too. Regression: sequential and concurrent distinct-source binding attempts cannot both persist.

## Trust boundary and observations

An explicitly supplied local operator binding is the authorization boundary; this review does not require a signing service. Evidence must express the actual decision and exact identities, and documentation must describe operator assertions accurately. The importer must not manufacture a real actor mapping from matching email/name or invent approval evidence.

Reviewed business writer rechecks Store ownership inside its write transaction. The external exception is restricted to Users.createdBy; other relationships remain scoped. Existing actor access is SELECT/row-lock plus ledger evidence only; no actor credential, role, membership, or audit-field mutation was found. The User audit hook uses the private migration capability. Final actor verification checks durable SKIP evidence and dependency ownership. These are source observations, not completed integration evidence.

## Re-review

Both findings corrected and re-reviewed in source. `loadCreatorBindings` now parses strict, duplicate-aware decision evidence and matches source instance/database/token/snapshot/actor artifact/target identity plus sourceRef/target ID/target identity checksum. `assertTarget` checks reverse active claims after acquiring the target User row lock on mutation paths; the same check runs during read-only resolution and final verification.

Fresh verification: `npm test -- src/__tests__/unit/migration/pw1-json-v2-contract.test.ts` — **18/18 PASS**, 2.49s. Opaque evidence and wrong-target evidence are rejected. No additional scoped defect found. Concurrent distinct-source alias arbitration still needs real-DB regression evidence; this source review does not mark that scenario PASS. Fresh-clone schema and broader rehearsal results are reported separately by root/tester.

Final path-only re-review: private binding/evidence paths reject both current repository and ancestor `.git` in other worktrees, including a literal `..private` directory inside the repository. Tester reports focused19/19 and final typecheck PASS. Latest strict-decision synthetic evidence is `/tmp/pw1-cli-rehearsal-1789633701412`; it includes sequential target-alias rejection. Concurrent alias racing remains distinct/unverified.

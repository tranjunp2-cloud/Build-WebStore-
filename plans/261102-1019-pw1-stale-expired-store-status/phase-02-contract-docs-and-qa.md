# Phase 02 — Addendum doc + QA TC + decision log

## Hard constraint
Do NOT edit `docs/migration/pw1-pw2-master-field-mapping.md` (sha256 pinned as master contract hash — see plan.md).

## Files
- Create `docs/migration/pw1-stale-expired-status-and-bound-slug-20261102.md` (addendum, covers Rule A + B)
- `docs/qa/F42-pw1-master-json-export.md` (TC table ~L35)
- `docs/decisions/decisions-log.md`

## Steps
1. Addendum: states it overrides the master matrix row "Store/owner khác trạng thái (kể cả Store=2, owner=1)" only for the stale-expired branch; exact conditions (plan.md rule); evidence (PW1 `UserController.php:496-500`, 96/96, CSV 281026); issue code + disposition; graceful-only. Rule B section: overrides 1.10.5 sentence "binding không thay đổi fallback slug của Store có nhiều domain mặc định"; slug = bound domain subdomain (domain without the `-2` number, #2179 decision); stores 1329/1327 evidence (rows 1182/1347, 1282/1345); reason `SOURCE_DOMAIN_BINDING_APPLIED`. Both: why master doc not edited (hash pin) and that a future contract bump must fold this in.
2. QA doc: add `TC-F42-EXP-115` + `TC-F42-EXP-116` rows (AUTO) linking addendum, note `TC-F42-EXP-108` expectation change; add MANUAL `TC-F42-DELTA-xx` placeholder for Phase 03 dev evidence.
3. Decision log: 2026-11-02 entry (#2179) — decisions A + B, evidence, approved 2026-11-02 (Rule A + B), scope (graceful profiles), link addendum.
4. Run reconciliation-artifact test again to confirm master doc hash unchanged.

## Todo
- [ ] addendum
- [ ] QA TC rows
- [ ] decision log
- [ ] hash test green

## Success
Rule traceable: code ↔ TC-F42-EXP-115 ↔ addendum ↔ decision; master hash unchanged.

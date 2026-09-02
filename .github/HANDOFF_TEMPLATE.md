# Handoff Comment Template

> Copy-paste template khi ban giao issue/PR giua AI agent (Claude Code, Codex) va human dev/QC.
> Muc dich: nguoi tiep theo (AI hoac human) co du context de tiep tuc **KHONG can hoi lai**.

---

## Format handoff comment (paste vao issue/PR)

```markdown
### Handoff — YYYY-MM-DD HH:mm TZ

**State:** ready | in-progress | blocked | review | done
**From:** @claude | @codex | @dev-name
**To:** @claude | @codex | @dev-name | qa-team
**Route:** feature | bugfix | investigation | docs

## Da lam
- [x] Task 1 — evidence (link PR / test file / commit hash)
- [x] Task 2 — evidence
- [ ] Task 3 — chua xong

## Evidence (commands + results)
- Command run: `bun test src/collections/products.test.ts`
- Result: 12/12 pass, coverage 87%
- CI run: [link Actions run](https://github.com/owner/repo/actions/runs/XXX)
- PR: #YYY (draft | ready for review)

## Files touched
- `src/collections/products.ts` — added SKU validation
- `src/collections/products.test.ts` — added 5 test cases
- `docs/prd/F08-products.md` — updated AC-3

## Next safe command
```bash
# Command tiep theo an toan chay ngay - khong can hoi
cd /path/to/project
bun test src/collections/products
```

## Blocker (neu co)
- **What:** Vercel deploy dang fail vi missing env var
- **Owner needed:** DevOps / anh Phuong
- **Unblock:** Add `OPENAI_API_KEY` vao Vercel Dashboard staging
- **Est unblock time:** 15 min

## Decisions can review
- [ ] Chosen approach A (retry with backoff) over B (queue) - reason: latency
- [ ] Added `agent:ai-ok` label - task an toan cho Codex tiep

## Unresolved questions
- Question 1?
- Question 2?
```

---

## Rules

### Khi nao BAT BUOC ghi handoff

1. Session end + task chua xong (chuyen ca ngay)
2. Chuyen owner (Claude → Codex, Codex → human, ...)
3. Blocker external xuat hien (khong tu resolve duoc)
4. Merge PR xong (ghi final state cho next iteration)

### Khi nao KHONG can

- Task tiny (1 typo, 1 config change)
- Chuyen giua session cua **cung 1 person** trong ngay
- Comment thao luan (khong phai state change)

### Security

- **KHONG bao gio** paste secret, token, API key, connection string vao handoff
- Redact command output truoc khi paste (VD: che DB password trong DATABASE_URL)
- Neu can share sensitive info → dung 1Password share link, khong paste vao GitHub

### Label lifecycle sau khi ghi handoff

Team ech-prime-web-v2 dung **ECH Sprint Board (Project #8) Status field** cho trang thai
implementation (Ready / In Progress / Review / Done). Handoff writer chi cham cac label
duoi day (khong dung `status:in-progress` / `status:blocked` — 2 label do khong ton tai
trong repo).

| Truong hop handoff | Action | Ai lam |
|---|---|---|
| Chuyen task cho AI (Claude/Codex) implement | Add `agent:ai-ok` | Handoff writer |
| Blocker: can dev/PM quyet dinh | Add `agent:human-needed` + tag @person | Handoff writer |
| Blocker: thieu context, can dev bo sung | Add `agent:needs-context` + ghi list cau hoi | Handoff writer |
| Task cham auth/PII/security | Add `risk:security` | Handoff writer |
| Task migration/batch delete/data | Add `risk:data-loss` | Handoff writer |
| Task doi API/schema | Add `risk:breaking-change` | Handoff writer |
| PR ready → QC test tren staging | Add `qa:pending` | Dev sau khi merge |
| QC test pass tren staging | Doi `qa:pending` → `qa:passed` | QC sau khi test |
| QC phat hien bug | Doi `qa:pending` → `qa:failed` (issue-lifecycle bot se auto-post bug template) | QC |

**Update Project board Status field** (khong phai label) cho trang thai implementation:
Ready → In Progress → Review → Done.

Xem full label taxonomy: `.github/GIT_AND_CI_RULES.md`
Xem workflow tu dong: `.github/workflows/issue-lifecycle.yml`

---

## Vi du that (US-F40-13)

```markdown
### Handoff — 2026-08-28 14:30 GMT+7

**State:** review
**From:** @claude
**To:** qa-team
**Route:** feature

## Da lam
- [x] Implement 1-click ticket export button (AC-1) - PR #1791
- [x] QC Pass sign-off stamp with timestamp (AC-2) - commit abc123
- [x] Batch export 218 sites report (AC-3) - PR #1791
- [x] E2E test 3 flows - `src/__tests__/e2e/qc-migration.spec.ts`

## Evidence
- Command run: `bun test:e2e src/__tests__/e2e/qc-migration.spec.ts`
- Result: 3/3 pass
- CI run: https://github.com/primeproduction/ech-prime-web-v2/actions/runs/8888
- PR: #1791 (ready for review)

## Files touched
- `src/app/studio/qa/migration-diff/MigrationDiffClient.tsx` (+180, -20)
- `src/__tests__/e2e/qc-migration.spec.ts` (new, +250)
- `docs/qa/F40-migration.md` (+TC-F40-13-01, TC-F40-13-02, TC-F40-13-03)

## Next safe command (cho QA test tren staging)
```bash
# 1. Wait PR #1791 merged vao staging (auto-deploy ~5 min)
# 2. Login staging.ech-prime.com admin
# 3. Vao QC Center > Migration Diff
# 4. Chay 3 test scenarios trong docs/qa/F40-migration.md#TC-F40-13-01
```

## Unresolved questions
- Feedback UX: co can them progress bar cho batch export 218 sites (co the mat 30s+)?
```

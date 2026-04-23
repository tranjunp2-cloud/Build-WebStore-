# QA Test Cases — BUG-F05-12: Gallery Replace Wipes All Images

> **Scope:** BUG-F05-12 (branch `fix/F05-12-image-upload-ai-gen`, plan `plans/260417-F05-12-gallery-replace-wipe/`).
> **Not to be confused with US-12** in [F05-ai-editor-testcases.md](./F05-ai-editor-testcases.md) (Global Settings Panel) — the `TC-F05-12-XX` IDs here are bug-scoped and apply only to the gallery replace regression.

---

## 1. Context

Before the fix, replacing one image in a 6-slot gallery caused every AI-generated sibling (`{url, alt}` placeholder without a Media id) to be nulled by `normalizeUploadField`. The save pre-pass (`hydrateUrlUploadsToMedia`) now converts URL-only upload fields to Payload Media ids before normalization runs.

- Fix code: `src/lib/ai/media-injector.ts` (`ingestUrlToMediaIfNeeded`, `hydrateUrlUploadsToMedia`)
- Call site: `src/app/api/sites/[siteId]/save/route.ts` (pre-normalize hydrate)
- Related PR (hero-only fix): #681

---

## 2. Test Cases

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F05-12-01** | `BUG-F05-12/slot-1` | `Func` | Replace slot 1, 5 siblings survive | 1. Mở AI-gen site có gallery 6 ảnh (mix URL-only + Media id).<br>2. Click replace slot đầu tiên, chọn ảnh mới.<br>3. Chờ autosave + reload iframe. | - Tất cả 6 slot vẫn có ảnh.<br>- Slot 1 là ảnh mới; 5 slot còn lại giữ nguyên. | Blocker | [x] |
| **TC-F05-12-02** | `BUG-F05-12/slot-mid` | `Func` | Replace slot giữa, 5 siblings survive | 1. Như TC-01 nhưng replace slot index 3. | - 6/6 slot còn đủ; slot 3 là ảnh mới. | Blocker | [x] |
| **TC-F05-12-03** | `BUG-F05-12/slot-last` | `Func` | Replace slot cuối, 5 siblings survive | 1. Như TC-01 nhưng replace slot index 5. | - 6/6 slot còn đủ; slot 5 là ảnh mới. | Blocker | [x] |
| **TC-F05-12-04** | `BUG-F05-12/mixed` | `Func` | Gallery trộn numeric id + {url,alt} | 1. Site gallery: 3 slot đã có numeric Media id, 3 slot còn `{url, alt}` từ AI-gen.<br>2. Trigger save.<br>3. Check DB — tất cả slot phải có integer id. | - Sau save, mọi slot đều là numeric Media id.<br>- Không slot nào bị null. | High | [x] |
| **TC-F05-12-05** | `BUG-F05-12/hero-regression` | `Regression` | Hero replace vẫn hoạt động (PR #681) | 1. Replace hero image trên site cũ có `hero.image` dạng object/URL. | - Hero image cập nhật đúng.<br>- Save không 500, không rollback. | Blocker | [x] |

---

## 3. Automation Coverage

| TC-ID | Test file |
|:---|:---|
| TC-F05-12-01, 04 | `src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts` (`hydrateUrlUploadsToMedia` walker) |
| TC-F05-12-02..03 | Covered by walker test (position-agnostic). |
| TC-F05-12-05 | `src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts` → TC-F05-12-10 |
| TC-F05-12-06 | `src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts` → TC-F05-12-06: allowlisted host fetch+upload |
| TC-F05-12-07 | `src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts` → TC-F05-12-07: HTTP 500 returns null |
| TC-F05-12-08 | `src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts` → TC-F05-12-08: bare URL string ingest |
| TC-F05-12-09 | `src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts` → TC-F05-12-09: null/undefined/non-image |
| TC-F05-12-10 | `src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts` → TC-F05-12-10: hero regression guardrail |
| TC-F05-12-11 | `src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts` → TC-F05-12-11: disallowed host partial |
| TC-F05-12-12 | `src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts` → TC-F05-12-12: empty blocks |
| TC-F05-12-13 | `src/__tests__/unit/lib/ai/media-injector-hydrate.test.ts` → TC-F05-12-13: 50-slot cap |

---

## 4. Manual Verification Checklist

- [ ] Staging: AI-gen a new site; without any replace, open DB and confirm gallery images have integer ids.
- [ ] Staging: open existing site with `{url, alt}` gallery slots, replace one, reload iframe — all 6 present.
- [ ] Staging: `[Save]` log shows `hydrated N URL upload slots` on first save after deploy.
- [ ] Staging: no increase in save-route error rate (Vercel logs, 24h window).

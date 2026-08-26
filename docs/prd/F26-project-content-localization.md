# PRD: Project Content & Template Localization (F26)
> **Version:** 1.0 | **Created:** 2026-05-26 | **Agent:** `claude`
> **Priority:** P0 | **Sprint:** Wave 2 | **Size:** L
> **Depends on:** F01 AI Builder, F04 Block Renderer, F21 Localization | **Blocks:** None

---

> [!IMPORTANT]
> **Stories-First Rule:** This PRD is built from the approved user stories in `F26-project-content-localization-stories.md`. Issues are auto-synced from that stories file via the **Story Sync** GitHub Action.

> [!NOTE]
> **F26 vs F21 — clear boundary:**
> - **F21 (built)** localizes the **CMS/admin chrome** — buttons, menus, table headers, labels. It *explicitly excludes* user/AI-generated content.
> - **F26 (this)** localizes the **project's own content & the block/template library**, keyed off the existing `Sites.locale` field.
> - F26 **reuses** F21 infrastructure (`useI18n`, `prefer_lang` cookie, EN/BM dictionaries) and does **not** add a new `project_language` column.

---

## 0. Story Traceability

| Story ID | Title | Priority | Size | File |
|----------|-------|:--------:|:----:|------|
| US-F26-01 | Confirm project language after AI generate | P1 | S | [stories](../stories/F26-project-content-localization-stories.md) |
| US-F26-02 | Newly-added blocks render localized default content | P0 | L | [stories](../stories/F26-project-content-localization-stories.md) |
| US-F26-03 | Smart Component Adder — localized previews | P1 | M | [stories](../stories/F26-project-content-localization-stories.md) |
| US-F26-04 | AI on-the-fly translation fallback | P1 | M | [stories](../stories/F26-project-content-localization-stories.md) |
| US-F26-05 | Quick Language Switcher in editor toolbar | P1 | M | [stories](../stories/F26-project-content-localization-stories.md) |
| US-F26-06 | Complete block content-injection locale coverage | P1 | M | [stories](../stories/F26-project-content-localization-stories.md) |
| US-F26-07 | Language Switcher — header-locked block (prep F27) | P2 | S | [stories](../stories/F26-project-content-localization-stories.md) |

---

## 1. Problem Statement

Khi một user Malaysia nhập prompt bằng BM hoặc EN, AI tạo ra website bằng ngôn ngữ tương ứng (đã lưu vào `Sites.locale`). Nhưng khi họ vào CMS/editor để tùy biến, **các component/template mẫu thêm mới lại hiển thị nội dung mặc định bằng tiếng Anh**. Điều này khiến sản phẩm bị cảm giác "nửa mùa" (half-baked), tăng cognitive load và làm tăng tỷ lệ drop-off — đặc biệt nghiêm trọng với tệp người dùng Malaysia vốn tư duy song ngữ EN ⇄ BM.

---

## 2. Target User

- Store Owner (Merchant) & Staff người Malaysia, kinh doanh nội địa.
- Quen chuyển đổi qua lại EN/BM; cần trải nghiệm CMS nhất quán theo đúng ngôn ngữ của website họ vừa tạo.

---

## 3. Solution Overview

Làm cho **nội dung dự án và thư viện block/template** nhận biết ngôn ngữ (`Sites.locale`):

1. **Confirm ngôn ngữ sau khi generate** — không phụ thuộc 100% vào auto-detect; cho user xác nhận/sửa (US-F26-01).
2. **Block thêm mới render default content theo `Sites.locale`** — lõi của feature; cần bộ default content EN+BM cho từng block (US-F26-02).
3. **Smart Component Adder** — preview block trong sidebar bằng ngôn ngữ site + icon auto-translate (US-F26-03).
4. **AI dịch on-the-fly fallback** — khi block chưa có bản dịch tay (US-F26-04).
5. **Quick Language Switcher trên toolbar editor** — 1-click đổi cả trang, giữ nguyên nội dung user đã sửa (dùng dropdown — scale tự nhiên cho 3+ locales) (US-F26-05).
6. **Audit + hoàn tất locale coverage** cho content-injection pipeline (US-F26-06).

---

## 4. Scope

### In Scope
- Confirm-language step sau AI generate, persist vào `Sites.locale`.
- Bộ default content EN + BM (hand-authored) cho block library; add-block resolve theo `Sites.locale`.
- Localized preview trong Block Library panel + auto-translate affordance.
- AI translate fallback (server-side) + cache cho block thiếu bản dịch.
- Quick language switcher trên editor toolbar (giữ nội dung user đã chỉnh).
- Audit + đóng gap coverage cho content-injection (phối hợp `fix/ai-gen-locale-ms`).

### Out of Scope
- Dịch dữ liệu thương mại do user nhập tay (tên/ mô tả sản phẩm, blog content) — đó là dữ liệu, không phải default template.
- Ngôn ngữ thứ 3 (zh/Tamil) — defer sau Phase 1 (chỉ EN + BM).
- CMS/admin chrome i18n — đã thuộc F21.

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| English-leftover trên BM site | 0 block hiển thị default EN khi site locale = ms | QA / Visual test |
| Default content coverage | 100% block trong registry có default EN + BM (hoặc fallback có cờ) | Coverage matrix (US-F26-06) |
| Auto-translate failure safety | 100% fail → fallback EN, không vỡ trang | Backend logs |
| Language confirm adoption | User xác nhận/sửa ngôn ngữ ngay sau generate | Client metrics |

---

## 6. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority |
|-------|-------------|-----------|----------|
| FR-01 | Hiển thị confirm ngôn ngữ ngay sau AI generate, pre-select ngôn ngữ đã detect | US-F26-01 | P1 |
| FR-02 | Lưu lựa chọn ngôn ngữ vào `Sites.locale` (không thêm column mới) | US-F26-01 | P0 |
| FR-03 | Block thêm mới insert default content theo `Sites.locale` (BM cho site ms) | US-F26-02 | P0 |
| FR-04 | Fallback EN + cờ "needs translation" khi thiếu bundle BM | US-F26-02 | P0 |
| FR-05 | Block Library preview theo ngôn ngữ site + icon auto-translate | US-F26-03 | P1 |
| FR-06 | AI translate server-side cho block thiếu bản dịch, có cache | US-F26-04 | P1 |
| FR-07 | Language dropdown trên toolbar editor, 1-click re-language (dropdown scale tự nhiên khi mở rộng ZH/TH/ID) | US-F26-05 | P1 |
| FR-08 | Re-language giữ nguyên nội dung user đã sửa, chỉ swap default chưa động tới | US-F26-05 | P0 |
| FR-09 | Audit coverage block × {EN, BM}, đóng gap trong content-injection | US-F26-06 | P1 |
| FR-10 | Language Switcher block trong Block Library → lock vào header nav, không vào page.blocks[] | US-F26-07 | P2 |
| FR-11 | Dropdown placeholder `EN ▾` trong nav — static F26, F27 wires live switching | US-F26-07 | P2 |

---

## 7. Business Rules

- **BR-01:** Ngôn ngữ dự án = `Sites.locale` (default `ms`). Không tạo biến `project_language` mới.
- **BR-02:** Chỉ localize **default/template content** do hệ thống cung cấp. Nội dung user gõ tay giữ nguyên.
- **BR-03:** Hand-authored translation ưu tiên hơn machine-translate. AI translate chỉ là fallback.
- **BR-04:** Khi đổi ngôn ngữ (US-F26-05), nội dung user đã chỉnh **không bị ghi đè** — chỉ default chưa động tới mới swap.
- **BR-05:** Auto-translate fail → fallback EN default + thông báo non-blocking. Không bao giờ để trang vỡ.
- **BR-06:** Phase 1 chỉ EN + BM. Kiến trúc bundle phải mở rộng được cho ngôn ngữ khác sau này.
- **BR-07:** LanguageSwitcher dùng dropdown (không phải toggle/flag) — scalable khi thêm locale mới (ZH, TH, ID...) mà không cần đổi UI. F26: options = [EN, BM]; F27/F28+: đọc từ `site.supportedLocales[]`.

---

## 7b. Content Classification

Phân biệt 2 loại nội dung để tránh sửa nhầm — **template content** (per-locale) vs **business data** (giữ nguyên):

| Template content (per-locale, swapped on switch) | Business data (GIỮ NGUYÊN) |
|---|---|
| Headline mặc định | Tên shop |
| CTA buttons ("Get Started") | Địa chỉ, SĐT, email |
| FAQ default questions | Tên sản phẩm, giá, mô tả |
| Features description mặc định | Logo, hình ảnh upload |
| Testimonial placeholders | Tên nhân viên/team |
| Section titles mặc định | Menu items (tên món, giá), Blog content |

**Rule:** merchant tự nhập = business data (giữ nguyên) | hệ thống inject hoặc user edit trong editor = template content (per-locale).

---

## 8. Architecture Notes (grounded in codebase)

> Tham chiếu scout 2026-05-26. Hạ tầng phần lớn đã có — F26 lấp các khoảng trống.

| Area | File(s) | Trạng thái |
|------|---------|-----------|
| Project language field | `src/collections/Sites.ts` (`locale: 'ms'\|'en'`, default `ms`) | ✅ Có sẵn — tái dùng |
| Language detection | `src/lib/ai/openai-generator.ts` (`guessLanguageFromInput()`) | ✅ Có — US-F26-01 chỉ thêm confirm UX |
| AI generate route | `src/app/api/ai/generate-site/route.ts` (nhận `language`, lưu `site.locale`) | ✅ Có |
| Block registry | `src/blocks/registry.ts` (50+ blocks) | ⚠️ Default content hardcode EN trong `*/config.ts` — cần bundle EN+BM |
| Component adder UI | `src/components/editor/BlockLibraryPanel.tsx` | ⚠️ Đã dùng `useI18n` cho label chrome; cần preview theo `Sites.locale` |
| Content-injection | `src/lib/ai/content/*.ts`, `content-injection.ts` | ⚠️ Một phần đã localize trong branch `fix/ai-gen-locale-ms` |
| i18n infra (F21) | `src/i18n/index.tsx`, `src/i18n/server.ts` | ✅ Tái dùng |
| Per-locale storage | `pages.locale_content jsonb DEFAULT '{}'` | ✅ Migration added (F26-05) |
| LanguageSwitcher component | `src/components/editor/LanguageSwitcher.tsx` | ⚠️ Tạo mới (F26-05) — dropdown pattern |

> ⚠️ **Coordination:** Branch `fix/ai-gen-locale-ms` (20+ commits) đang localize testimonials/features/contact/nav. **Merge/rebase trước** khi làm US-F26-02 / US-F26-06 để tránh xung đột.

> **Schema rule:** F26 thêm 1 column: `pages.locale_content jsonb` (migration trong scripts/db-setup.js). Cache translation (US-F26-04) nếu dùng bảng riêng thì cần migration thêm.

---

## 9. Decisions Log (was: Open Questions)

| Question | Decision |
|----------|----------|
| US-F26-05: Track "user-edited" vs "default" content | Per-locale JSONB storage (`pages.locale_content`). Không dirty flag per field. Locales lưu riêng slot; switch chỉ swap slot chưa có override. |
| US-F26-04: AI provider | OpenAI — consistent với các AI feature hiện có. |
| Priority: hand-translate toàn bộ vs AI fallback | Hand-author ~15 blocks traffic cao (hero/faq/features/…). AI translate fallback cho ~42 blocks còn lại. |
| US-F26-05: Switcher UI pattern | Dropdown (không toggle/flag) — scalable cho 3+ locales. F26: EN + BM; F27/F28+: thêm option, không đổi UI. |

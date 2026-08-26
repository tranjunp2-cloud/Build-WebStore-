# Scout Report — GH-1502: Redesign AI Chat bulk-create UX (F08)

Issue: https://github.com/primeproduction/ech-prime-web-v2/issues/1502

## Issue Summary

Section "AI Chat: Quickly create multiple products" trên `/products` khó dùng: (1) input single-line trông như search box, (2) nút `+Create` gây sợ auto-publish (thực ra backend đã hard-code `status:'draft'`). Yêu cầu:
1. Input → textarea auto-grow (multi-line, submit qua nút/Cmd+Enter, không phải Enter)
2. Suggestion pills (≥3, có RM giá mẫu, EN+MS)
3. Đổi nút `+Create` → `✨Generate Drafts`/`Preview with AI`, icon `Plus`→`Sparkles`
4. Sau generate: tự chuyển tab Draft không reload, sp mới lên đầu; green pulse dot + tooltip "AI tạo — cần kiểm tra" trên sp AI-bulk, dot biến mất khi Save/Active; cần field DB mới (`aiReviewPending` hoặc `source`) + migration

## Relevant Files

### Frontend — Products page & Modal
- `src/app/(dashboard)/products/page.tsx`
  - State: `filterStatus` (L109), `aiPrompt` (L112), `statusCounts` (L226-231), `handleCreateAi` (L233-235, chỉ `setShowBulkCreate(true)`)
  - AI banner (L330-361): `<Input>` single-line (L339-347, onKeyDown Enter→submit), `<Button variant="dashPrimary" size="dash">` với icon `Plus` + `t.dashboard.products.list.aiChatBtn` (L349-359)
  - Status tabs `<Tabs value={filterStatus}>` (L391-421), fully controlled — dễ set `filterStatus='draft'`
  - Modal mount (L941-949): `onSuccess={() => { setAiPrompt(''); loadProducts() }}` — **chưa** set `filterStatus='draft'`, đây là chỗ cần sửa
- `src/components/dashboard/BulkCreateModal.tsx`
  - `buildSavePayload` (L77-152): hard-code `status:'draft'` (L129) — giữ nguyên, hợp lý cho scope này; đây cũng là chỗ set `aiReviewPending:true` khi tạo
  - `handleParse` (L178-229): fetch `/api/ai/products-bulk-parse`
  - `handleSave` (L231-321): loop save từng product → `onSuccess()` → `router.refresh()` (L309) → `onClose()`. **`router.refresh()` có thể xung đột với yêu cầu "không reload"** — cần xác nhận có bỏ hay giữ
  - Note banner "Products will be saved as Draft" (L466-473)

### Backend — API & Actions
- `src/app/api/ai/products-bulk-parse/route.ts` (160 dòng)
  - Rate-limit 5/h (L17-23), request `{promptText, locale}`, response `{products:[...]}` — route này KHÔNG persist DB, chỉ parse. `aiReviewPending` phải set ở tầng gọi `saveProductAction` (BulkCreateModal), không phải ở route này.
- `src/app/(dashboard)/products/actions.ts`
  - `saveProductAction` (L111-217): zod `.passthrough()` — field mới tự động pass qua được. Create path L174-216, update path L165-173.
  - `updateProductFieldAction` (L224-293): zod union CHỈ nhận `{status}` hoặc `{deletedAt}` — **đây là chỗ set status active/draft**, cần mở rộng union để cho phép clear `aiReviewPending` khi activate, hoặc set `aiReviewPending:false` unconditionally khi `status==='active'` (L282-291)

### DB Schema & Migration
- `src/collections/Products.ts` (503 dòng) — CHƯA có field nào đánh dấu AI-generated. Field boolean mẫu để theo (giống `hasVariants`, `halalCertified`):
  ```js
  { name: 'aiReviewPending', type: 'checkbox', defaultValue: false, admin: { description: '...' } }
  ```
- `scripts/db-setup.js` MIGRATIONS array (~L65, dùng ở L4857) — mẫu boolean column (L258-262):
  ```js
  { name: 'products.ai_review_pending', sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_pending boolean DEFAULT false;` }
  ```
- `scripts/check-migrations.js` — CI gate, diff `src/collections/*.ts` vs `origin/staging`, field mới không có migration tương ứng → fail CI. Chạy `node scripts/check-migrations.js origin/staging` để tự kiểm trước PR.
- `.claude/rules/database-schema.md` — convention: never DROP TABLE, luôn `CREATE/ADD COLUMN IF NOT EXISTS`.

### i18n
`src/i18n/locales/en.json` / `ms.json`:
- `dashboard.products.list.aiChat*` (~L1458-1460): `aiChatTitle`, `aiChatPlaceholder`, `aiChatBtn` — cả 2 locale đủ key, không thiếu.
- `dashboard.products.bulkCreate.*` (~L1689-1743): đầy đủ keys cho modal (title, promptLabel, parseButton, previewTitle, colX, saveButton, note.description="Products will be saved as Draft", toast.*, table.*) — cả EN/MS parity đầy đủ.
- Tham khảo thêm: `editor.aiChat` object (L3666-3679, chat panel của AI website editor) có naming style richer (welcomeMessage, inputPlaceholder, stopAI...) — có thể theo style này khi thêm key mới cho suggestion pills.

### Tests
- `src/__tests__/unit/dashboard/bulk-create-save.test.tsx` — test `handleSave` (TC-F08-04-27), toast success/fail, router.refresh, body-scroll lock (TC-F08-04-33/GH-1491)
- `src/__tests__/unit/dashboard/bulk-create-utils.test.ts` — test `slugify` + `buildSavePayload` (TC-F08-04-01): status draft, variantConfigs auto-gen, XSS sanitize, unique slug

### Reusable UI patterns
| Cần | Có sẵn? | Vị trí |
|---|---|---|
| Textarea auto-grow | **Có pattern**, chưa thành hook riêng | `src/components/editor/AIChatPanel.tsx:176-185` (useEffect resize theo scrollHeight) — copy/extract sang dùng cho BulkCreate |
| Suggestion pills / Command palette | **Không có** | `src/components/ui/` không có `command.tsx`/cmdk; phải build mới hoặc `npx shadcn add command` |
| Pulse/glow dot | **Có pattern nhỏ** | `EditorToolbar.tsx:318,582`, `PageManagerPanel.tsx:431` — `<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-{color}-400"/>`. Có sẵn CSS var `--ai-glow` (`globals.css:161`) nhưng CHƯA được dùng ở đâu — có thể dùng cho dot này |
| Tooltip | **Có sẵn, dùng ngay được** | `src/components/ui/tooltip.tsx` (Radix wrapper, đầy đủ Trigger/Content/Provider) |

## Unresolved Questions
1. `router.refresh()` ở `BulkCreateModal.tsx:309` — bỏ hay giữ để thỏa "không reload trang"? (khả năng cao nên bỏ, chỉ dựa vào `onSuccess()`→`loadProducts()`)
2. `aiReviewPending` (checkbox) vs `source: 'ai-bulk'|'manual'` (select) — chọn design nào? Cả 2 đều support được về mặt kỹ thuật.
3. Semantics rõ ràng: clear `aiReviewPending` chỉ khi `status→active`, hay cả khi save/edit thủ công qua `saveProductAction` cũng clear? (issue ghi cả 2 điều kiện — "Save lại" HOẶC "chuyển Active")
4. `--ai-glow` CSS var chưa dùng ở đâu — có phải dự định dùng cho feature này không?
5. Nên extract textarea auto-resize thành shared hook (`useAutoResizeTextarea`) hay inline riêng trong BulkCreateModal?
6. Suggestion pills — dùng shadcn Command component (cần thêm dependency `cmdk`) hay chỉ làm chip/button đơn giản?

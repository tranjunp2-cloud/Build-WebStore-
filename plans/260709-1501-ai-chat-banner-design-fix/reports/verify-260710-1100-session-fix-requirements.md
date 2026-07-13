# Session Fix Requirements — Verification Checklist

> Tổng hợp toàn bộ yêu cầu fix/thay đổi trong session này (branch `fix/ai-chat-banner-design-polish`),
> dùng để verify code đã implement đúng yêu cầu. Sắp xếp theo thứ tự thời gian yêu cầu, nhóm theo khu vực code.
> Chi tiết kỹ thuật đầy đủ (root cause, before/after, cách verify) nằm ở
> `plans/260709-1501-ai-chat-banner-design-fix/phase-01-ai-chat-banner-css-polish.md` (Addendum 1–11).
> File này là bản tóm tắt để đối chiếu nhanh, không thay thế plan gốc.

**Trạng thái tổng quan:** tất cả các mục dưới đây đã implement + verify (typecheck sạch, test pass, phần lớn confirm bằng browser thật). Tất cả thay đổi hiện **chưa commit**.

---

## A. AI Chat Banner — `src/app/(dashboard)/products/page.tsx` (L384–460ish)

| # | Yêu cầu | Đã làm | Verify |
|---|---------|--------|--------|
| A1 | So khớp design `ai-bulk-create.html` phần `.ai-box`: nền, border radius, focus ring, font textarea, footer border | Nền: gradient xanh dương→teal → flat card + radial glow góc trên-phải; radius 16→18px; border → token `--border`; focus ring 1px→3px teal; textarea font 13→14px; footer border-top full opacity | `getComputedStyle()` browser thật |
| A2 | "design đường border đậm mà" — border quá mờ/nhạt so với design | **Root cause thật**: `tailwind.config.js` có `preflight:false` → class `border` (bare) không có `border-style`, browser tính `border-width:0` → border **vô hình hoàn toàn** (không phải sai màu). Fix: dùng cú pháp `[border:1px_solid_hsl(...)]` thay vì tách `border` + `border-[color]`. Tăng độ dày 1px→2px (outer wrapper + command-shell) cho khớp độ đậm trong ảnh design | `getComputedStyle()`: `border-width`, `border-style` trước/sau |
| A3 | Có 1 đường line trong ô input (footer divider) không thấy | Cùng root cause A2 — `border-t` cũng bị vô hình. Fix: `[border-top:1px_solid_...]`. 3 badge `<kbd>` (Enter/⌘Ctrl/Enter) cũng bị lỗi tương tự, đã fix | `getComputedStyle()` |
| A4 | Design: suggestion pill chỉ đổi màu khi hover; hiện tại luôn có màu | Base border → token trung tính `--border`; thêm `hover:[border-color:hsl(var(--primary))]`, chỉ đổi màu khi hover | `getComputedStyle()` rest vs `.hover()` |
| A5 | Đổi logic: Enter = generate, ⌘/Ctrl+Enter = xuống dòng (đảo ngược lại logic cũ) | Đổi điều kiện `onKeyDown`; đảo thứ tự text hint footer "Enter to generate · ⌘/Ctrl+Enter new line". **Có sửa thêm 1 lỗi phụ** (phát hiện ở code-review): Shift+Enter vô tình cũng trigger generate — đã loại trừ `!e.shiftKey` | Browser thật: `modalOpenAfterPlainEnter:true`, `modalOpenAfterCtrlEnter:false` |
| A6 | Giảm padding top/bottom + giảm kích thước nút "Generate Drafts" (2 lần, có "giảm thêm chút nữa") | Footer `py-2→py-1`; nút `h-9→h-6` (36px→24px) qua `!important` override; icon Sparkles thu nhỏ | `getComputedStyle()`: `btnHeight:"24px"` |
| A7 | Ẩn dòng hint bàn phím trên mobile, giữ tablet+desktop | Hint row: `hidden md:flex`; footer `justify-end md:justify-between` (để nút không bị đẩy trái khi hint ẩn) | Browser thật 2 viewport (390px vs 1440px) |
| A8 | Stock tooltip (desktop, cột Stock) bị lệch align tràn sang cột WEIGHT | Thêm `align="start"` vào `TooltipContent`, khớp `PopoverContent` bản mobile đã đúng sẵn | Chưa live-verify được (thiếu data test có breakdown nhiều variant lúc đó) — logic đã đúng theo pattern đã proven |

## B. BulkCreateModal.tsx (review-drafts panel)

| # | Yêu cầu | Đã làm | Verify |
|---|---------|--------|--------|
| B1 | Đổi model AI gen detail từ bottom-sheet drawer về lại modal căn giữa; giữ nguyên toàn bộ design chi tiết bên trong | Overlay: `items-end→items-center` + `p-4`; container: `rounded-t-[18px]→rounded-[18px]`, bỏ `border-b-0`. Không đụng nội dung card/header/footer bên trong | Browser thật: `align-items:center`, `border-radius:18px` đủ 4 góc, screenshot xác nhận nội dung không đổi |

## C. Trang Edit Product — legacy price warning

| # | Yêu cầu | Đã làm | Verify |
|---|---------|--------|--------|
| C1 | (Câu hỏi) Dòng warning màu vàng đầu trang edit product là gì? | Giải thích: cảnh báo GH-1032 (`hasVariants && price===0`, sản phẩm lưu trước khi fix bug tính giá variant) | N/A — investigation |
| C2 | Trang khác có warning tương tự không? | Scout kỹ toàn `src/app/(dashboard)/`: chỉ `products/[id]` có đúng loại này; `blog/[id]` có style giống nhưng mục đích khác (draft recovery, không đụng) | N/A — investigation |
| C3 | Warning đẩy layout trang xuống, đổi cách hiện sang dạng "popup như status" | **Thử đầu tiên: `toast.warning()` — BỊ TỪ CHỐI.** Lý do: toast tự ẩn sau vài giây, nhưng warning này cần tồn tại tới khi user thực sự sửa giá & save | User feedback → làm lại |
| C4 | "giữ lại logic như cũ. chỉ sửa lại layout vị trí hiển thị message đó thôi" — dời sang bên phải dòng "Edit Product", không đẩy layout | Revert lại state/logic `showLegacyWarning` y hệt bản gốc. Chỉ dời JSX: `page.tsx` truyền `showLegacyPriceWarning` prop xuống `ProductForm.tsx`; `ProductForm` render banner (style/text/icon y hệt cũ) vào slot phải của header row (`justify-between`) | User tự confirm bằng browser thật trên sản phẩm "Wool Coat" (`/products/598`) |
| C5 | *(Code-review)* Header không responsive — warning dài chèn ép tiêu đề "Edit Product" co lại còn ~131px trên mobile | Thêm `flex-wrap` vào header row; warning `w-full md:w-auto md:max-w-md` → xuống hàng riêng full-width trên mobile thay vì chèn ép tiêu đề | Browser thật: title 233px (từ 131px), warning xuống hàng riêng dưới title |

## D. Chấm xanh AI-review-pending (indicator "vừa generate bằng AI")

| # | Yêu cầu | Đã làm | Verify |
|---|---------|--------|--------|
| D1 | Chấm xanh AI hiện đúng khi vừa generate bằng AI; logic hiện tại chỉ mất khi user sửa+save. Yêu cầu: **mất ngay khi user bấm vào trang edit**, không cần đợi save | `getProductAction` (actions.ts): khi fetch sản phẩm để mở trang edit, nếu `aiReviewPending===true` → clear ngay lập tức (viết DB), coi mở trang edit = đã review | Unit test TC-F08-04-60/61 + user tự confirm |
| D2 | *(Code-review)* Write phụ trong `getProductAction` không có try/catch — lỗi DB tạm thời sẽ làm cả READ báo "Failed to load" dù data đã fetch thành công | Bọc try/catch quanh write phụ; nếu fail, đọc vẫn trả về thành công (chỉ không clear được flag) | Unit test TC-F08-04-62 (mock update reject → vẫn resolve) |
| D3 | *(Code-review)* Tooltip tap-to-open (câu hỏi trước: "có click được trên tablet/mobile không?") không đóng khi tap ra ngoài — dễ bị kẹt mở | Trích xuất hook dùng chung `useTapToggleTooltip` (`src/hooks/use-tap-toggle-tooltip.ts`) — thêm listener `pointerdown` đóng tooltip khi tap ngoài trigger | Browser thật: mở bằng click → click chỗ khác → tooltip đóng đúng |

## E. Chấm tròn trạng thái (Stock badge / AI-review dot) bị méo trên iPad Pro

| # | Yêu cầu | Đã làm | Verify |
|---|---------|--------|--------|
| E1 | Chấm tròn nhỏ (Stock badge, AI-review dot) bị kéo dài thành hình viên thuốc trên iPad Pro | **Root cause**: rule CSS `globals.css` dành cho padding *text* trong bảng ở breakpoint <1280px vô tình áp vào cả span trang trí (`aria-hidden`) 6px, padding ăn vào width → méo hình. Fix: thêm `:not([aria-hidden])` vào selector | `getComputedStyle()` bisect 900/1024/1279/1280/1440px: 6px đồng nhất mọi nơi |

## F. Stock display trong danh sách Products — đổi từ range sang master inventory total

| # | Yêu cầu | Đã làm | Verify |
|---|---------|--------|--------|
| F1 | Stock không hiện theo range (`min - max`) nữa mà hiện theo **master inventory total**. VD: 3 variant, tổng 30 → `"30 / 3 variants"`. **Giữ nguyên logic hiện màu** | `src/lib/products/stock-display.ts`: label = tổng (`String(total)`) thay vì `"{min} - {max}"`, thêm field `showVariantCount`/`variantCount`/`total`. Severity **không đổi** — vẫn dùng `rangeSeverity(min,max)` theo từng variant, không theo tổng | 26 unit test (17+9) + browser thật: tạo sản phẩm 3 variant×10 → hiện đúng `"30 / 3 variants"` |
| F2 | (Làm rõ) Trường hợp 1 variant thì sao? "variant" không có "s" đúng không? | Áp dụng định dạng cho **mọi số variant ≥1** (kể cả 1): `"{total} / 1 variant"` (số ít, không "s") vs `"{total} / {N} variants"` (N≥2). Thêm i18n key riêng `stockVariantCountOne`/`stockVariantCountMany` (theo đúng convention `draftCountOne`/`draftCountMany` đã có sẵn trong codebase) | Test TC-F08-1525-02 (1 variant → `showVariantCount:true`) |

## G. Code review (`/code-review` ultrathink) — 6 finding, đã fix cả 6

Review toàn bộ diff pending session (13 file). Findings không nằm trong yêu cầu gốc của bạn mà do adversarial review tự phát hiện:

| # | Finding | Mức độ | Fix |
|---|---------|--------|-----|
| G1 | `getProductAction` write phụ không try/catch (= D2 ở trên) | Confirmed | Đã fix, xem D2 |
| G2 | Header `ProductForm` không responsive mobile (= C5 ở trên) | Confirmed | Đã fix, xem C5 |
| G3 | Icon nút Generate Drafts `h-3 w-3` không có tác dụng thật — bị đè bởi rule `[&_svg]:size-4` global của `Button` component (CSS specificity) | Confirmed (verify bằng isolated DOM test) | Đổi thành `!h-3 !w-3` (important) |
| G4 | Shift+Enter vô tình cũng trigger generate (= 1 phần của A5) | Confirmed | Đã fix, xem A5 |
| G5 | Tooltip tap-to-open không đóng khi tap ngoài (= D3 ở trên) | Plausible → Confirmed sau khi fix | Đã fix, xem D3 |
| G6 | `getProductAction` không còn là "read" thuần — footgun đặt tên cho code tương lai | Plausible | Thêm comment cảnh báo ở function |

**Lưu ý phát sinh khi fix G3:** dev server local bị stale (HMR không nhận code mới) — đã restart (`npm run dev`, không phải docker), server hiện chạy ở **port 3000** thay vì 3001. Data test tạm (vd "Wool Coat") bị mất theo — chỉ ảnh hưởng data test cục bộ, không phải production.

## H. Khác (không phải fix, nhưng ảnh hưởng code)

| # | Việc | Kết quả |
|---|------|---------|
| H1 | "pull origin về nhánh này, có thay đổi liên quan products trên staging" | Fetch + merge `origin/staging` (fast-forward) → stash pop lại toàn bộ thay đổi session → **0 conflict thật**, dù `ProductForm.tsx` bị tái cấu trúc lớn ở staging (`VariantsInventorySection`→`VariantOptionsSection`+`MasterFieldsSection`). Verify: 9874 test pass sau merge |

---

## Danh sách file đã thay đổi (chưa commit)

```
docs/qa/F08-product-crud.md
docs/standards/CODE_STANDARDS.md
src/__tests__/unit/actions/save-product-action.test.ts
src/__tests__/unit/dashboard/products-stock-cell.test.tsx
src/__tests__/unit/products/stock-display.test.ts
src/app/(dashboard)/products/[id]/page.tsx
src/app/(dashboard)/products/actions.ts
src/app/(dashboard)/products/page.tsx
src/app/globals.css
src/components/dashboard/AiReviewIndicator.tsx
src/components/dashboard/BulkCreateModal.tsx
src/components/dashboard/MissingInfoIndicator.tsx
src/components/dashboard/product-form/ProductForm.tsx
src/hooks/use-tap-toggle-tooltip.ts        (mới)
src/i18n/locales/en.json
src/i18n/locales/ms.json
src/lib/products/stock-display.ts
plans/260709-1501-ai-chat-banner-design-fix/   (plan + report, không tính vào code)
```

`scripts/db-migrate-dev.js` cũng có thay đổi nhưng **không liên quan session này** (có từ trước khi bắt đầu).

## Cách verify nhanh toàn bộ

```bash
npm run typecheck   # phải sạch
npx vitest run      # 560 file / ~9878+ test phải pass
```

Sau đó mở `http://localhost:3000/products` (dev server đang chạy port 3000) để kiểm tra bằng mắt các mục A/B/E/F; mở 1 sản phẩm variant + price=0 để kiểm tra mục C.

## Câu hỏi còn mở

- A8 (stock tooltip `align="start"`): chưa live-verify trực tiếp trên browser (lúc đó thiếu data test phù hợp) — nên tự kiểm tra lại bằng mắt khi rảnh.

# Test plan — Unit tests & coverage

> Cách biết unit test **đủ và đúng**: test **code thật** (lib, store, helpers), không copy logic vào file test. Mọi logic nghiệp vụ (validation, tính toán, format) nên nằm trong `src/lib` hoặc `src/store`, rồi test import từ đó.

---

## 1. Nguyên tắc

| Nguyên tắc | Mô tả |
|------------|--------|
| **Test code thật** | Test file import từ `@/lib/*`, `@/store/*`, `@/blocks/registry` — không định nghĩa lại `validateCheckout`, `formatPrice`, … trong test. |
| **Một nguồn sự thật** | Logic dùng chung (format giá, validate form, tính SST) đặt trong `src/lib`, dùng ở nhiều nơi (page, component, API) và test một lần. |
| **Đủ theo tính năng** | Mỗi nhóm tính năng có ít nhất một file test tương ứng; happy path + vài edge case (rỗng, sai format, boundary). |

---

## 2. Cấu trúc test hiện tại

```
src/__tests__/
├── helpers/
│   └── setup.ts          # jest-dom, globals
└── unit/
    ├── utils.test.ts     # cn, formatRelativeTime, formatStorage, formatPrice (lib/utils)
    ├── preview.test.ts   # detectCategory (lib/preview)
    ├── storefront/
    │   └── checkout.test.ts  # validateCheckoutForm, calculateOrderTotals, formatPrice, MY_STATES (lib/storefront + lib/utils)
    ├── stores/
    │   ├── editorStore.test.ts
    │   ├── cartStore.test.ts
    │   └── builderStore.test.ts
    └── blocks/
        └── registry.test.ts  # blockRegistry (getComponent, getSchema, validate, has, …)
```

---

## 3. Phạm vi từng nhóm (đủ và đúng)

### 3.1 `lib/utils` (utils.test.ts)

| Hàm | Test |
|-----|------|
| `cn` | Merge class, conditional, Tailwind conflict (last wins). |
| `formatRelativeTime` | Just now, X min ago, X hours ago, X days ago, ≥7 days → date string; string input. |
| `formatStorage` | B, KB, MB, GB; zero. |
| `formatPrice` | MYR (RM XX.XX), SGD (S$XX.XX), USD/other ($XX.XX). |

**Đủ:** Có. **Đúng:** Test import từ `@/lib/utils`, không định nghĩa lại.

### 3.2 `lib/storefront` (checkout.test.ts)

| Hàm / hằng | Test |
|------------|------|
| `validateCheckoutForm` | Valid form; thiếu name; thiếu email; email sai format; cả hai trống. |
| `calculateOrderTotals` | SST 6%; nhiều item; cart rỗng; làm tròn 2 chữ số. |
| `generateOrderNumber` | Bắt đầu ORD-; uppercase; unique (ít nhất 1 trong 10). |
| `formatPrice` | Dùng từ `lib/utils` (không trùng logic). |
| `MY_STATES` | 16 states; có KL, Selangor, Johor, Sabah, Sarawak. |

**Đủ:** Có. **Đúng:** Test import từ `@/lib/storefront` và `@/lib/utils`.

### 3.3 `lib/preview` (preview.test.ts)

| Hàm | Test |
|-----|------|
| `detectCategory` | restaurant (menu, cafe, F&B, thực đơn); ecommerce (shop, fashion); beauty; tech; health; education; realestate; fitness; creative; mặc định business; kết hợp blocks + siteName. |

**Đủ:** Có. **Đúng:** Logic nằm trong `lib/preview.ts`, route preview import từ đây.

### 3.4 Stores (editorStore, cartStore, builderStore)

| Store | Test |
|-------|------|
| **editorStore** | init (siteId, blocks, theme, snapshot); updateBlock, addBlock, deleteBlock, duplicateBlock, reorderBlocks; undo/redo; markSaved. |
| **cartStore** | addItem (mới, tăng quantity, mở drawer, persist); removeItem; updateQuantity (cập nhật, xóa khi ≤0); clearCart; itemCount, subtotal; toggleCart, openCart, closeCart; setSiteSlug. |
| **builderStore** | initial state; setBusinessInfo (step chat, welcome message); addMessage; setStatus; addBlock; setError; reset. |

**Đủ:** Có. **Đúng:** Test dùng store thật, mock localStorage cho cart.

### 3.5 `blocks/registry` (registry.test.ts)

| API | Test |
|-----|------|
| `getBlockTypes` | Có hero, navigation, footer, logo-cloud; length ≥ 15. |
| `count` | Bằng số phần tử getBlockTypes. |
| `has` | true với hero/navigation/contact; false với unknown. |
| `getComponent` | function với hero; null với unknown. |
| `getSchema` | có safeParse với hero; null với unknown. |
| `getBlockMeta` | type, name, description; null với unknown. |
| `getAllMeta` | mảng đủ length, mỗi phần tử có type. |
| `validate` | hero valid (blockType + headline); hero invalid (thiếu headline); unknown type; about valid. |

**Đủ:** Có. **Đúng:** Test import từ `@/blocks/registry`.

---

## 4. Chạy test

```bash
npm run test
```

Coverage (nếu bật):

```bash
npm run test -- --coverage
```

---

## 5. Checklist “test đủ và đúng”

- [ ] Mọi test import từ source thật (`@/lib/*`, `@/store/*`, `@/blocks/registry`), không copy logic vào file test.
- [ ] Lib mới (format, validation, calculation) có file tương ứng trong `src/lib` và có unit test.
- [ ] Store mới hoặc thay đổi behavior có test (init, actions, computed).
- [ ] Block type mới: đã có trong registry; test `validate` với config hợp lệ (nếu cần) trong registry.test.
- [ ] Trước khi merge: `npm run lint` + `npm run typecheck` + `npm run test` pass.

---

## 6. Mở rộng sau

- **API routes:** Test logic thuần (ví dụ body validation) qua helper trong `lib`; route handler có thể test integration/E2E.
- **buildFullHTML (preview):** Phụ thuộc renderer (Nav, Hero, …); có thể thêm test tích hợp hoặc E2E nếu cần.
- **Component (React):** Dùng React Testing Library trong `*.test.tsx` khi cần test tương tác UI.

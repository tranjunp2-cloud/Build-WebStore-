# F36 EasyParcel Delivery — Claude Design export

Bundle hi-fi xuất từ **Claude Design** (claude.ai/design), handoff cho coding agent implement.

- **Source link:** https://api.anthropic.com/v1/design/h/KPTRrOVDMqE8ximH6kpoyg?open_file=F36+EasyParcel+Delivery.html
- **Primary file:** `F36 EasyParcel Delivery.html` — design-canvas render 5 section A–E, mỗi section nhiều artboard (đủ states + mobile 375).

## Cách xem

Mở `F36 EasyParcel Delivery.html` trên browser (cần internet — load React + Babel + lucide từ unpkg CDN, biên dịch JSX in-browser). Các file phụ phải nằm cạnh đúng cấu trúc:

```
F36 EasyParcel Delivery.html   ← entry
colors_and_type.css            ← shared tokens
design-canvas.jsx              ← DesignCanvas / DCSection / DCArtboard
f36/
  ├── f36.css
  ├── atoms.jsx                ← shared atoms
  ├── screen-a-settings.jsx
  ├── screen-b-checkout.jsx
  ├── screen-c-label.jsx
  ├── screen-d-tracking.jsx
  └── screen-e-returns.jsx
```

## Screens & states

| Section | Screen | States |
|---------|--------|--------|
| A | EasyParcel Settings (dashboard dark) | disconnected · testing · invalid · connected · saving · mobile |
| B | Checkout multi-courier (storefront light) | empty · loading · rates · free · fallback · mobile |
| C | Create Label / ShipOrderModal (dark Dialog) | form · submitting · paying · success · error |
| D | Buyer Tracking (storefront light) | preparing · in-transit · delivered · mobile |
| E | Returns / Refund (dark Dialog) | form · submitting · success · error |

## Lưu ý implement

- Prototype = HTML/CSS/JS, **không phải production code**. Recreate pixel-perfect bằng stack repo (Next.js + shadcn/ui), không copy cấu trúc nội bộ prototype.
- Đối chiếu PRD `docs/prd/F36-easyparcel-delivery.md` + wireframe `docs/design/F36-easyparcel-delivery-design.md` (PR #1232).
- Demo tương tác gọn (1 file, không cần CDN): `docs/design/F36-easyparcel-delivery-ui-demo.html`.

# PW1 production vs snapshot 16/09 — delta thực tế

- Ngày đo: 26/10/2026 ~18:30 (+07). Nguồn: PW1 prod (RDS `primeweb`) qua container `prime-web-api-app-1`, session `READ ONLY`, chỉ SELECT.
- Mốc: CSV `/home/liam/Documents/DB_PROD` (93/93 khớp SHA-256 manifest import). `updated_at` lớn nhất trong CSV: `2026-09-16 03:16:05`.
- Phương pháp: so theo `id` từng dòng; 20 bảng diff đầy đủ từng cột, 50 bảng so số lượng/max id/`*_at` sau mốc.

## 1. Nhiễu định dạng CSV (bắt buộc chuẩn hóa trước khi so)

| Nhiễu | Ví dụ | Nếu không chuẩn hóa |
|---|---|---|
| Số thập phân | CSV `1199.0` vs DB `1199` | 44.202 giá SKU, 891/891 order, 10k category "đổi" giả |
| Tiền tố chống CSV-injection | CSV `'+6011…`, `'-1`, `'@DEMO` | phone, slug, model_settings "đổi" giả |
| Xuống dòng/khoảng trắng | mô tả product | ~11.500 product "đổi" giả |
| Cột kỹ thuật | `updated_at`, `token`, `token_id`, `*signature` | 636 user "đổi" giả |

Sau chuẩn hóa: products 12.066 → 50 thay đổi thật; product_skus 45.547 → 24; orders 891 → 0.

## 2. Delta thật (sau chuẩn hóa)

| Bảng | Mới | Xóa cứng | Sửa | Nội dung sửa chính |
|---|---:|---:|---:|---|
| stores | 3 | 0 | 78 | 74 đổi `status` |
| users | 40 | 0 | 470 | 233 `expired_at`; 134 đổi `status`/`banned_at`; 85 `username` |
| plan_subscriptions | 3 | 0 | 175 | 162 gia hạn `starts_at/ends_at` |
| store_deliveries | 3 | 0 | 1 | |
| products | 100 | 0 | 50 | 16 xóa mềm, 8 stock, 26 mô tả |
| product_skus | 105 | 0 | 24 | 16 xóa mềm, 8 stock |
| categories | 156 | 0 | 47 | 46 xóa mềm |
| orders / order_details / customers | 3 / 9 / 3 | 0 | 0 | |
| blog_posts | 15 | 0 | 13 | 4 xóa mềm, nội dung |
| pages | 39 | 0 | 7 | 7 xóa mềm |
| page_components | 141 | **117** | 0 | sửa trang = xóa cứng + tạo mới |
| banners | 182 | **12** | 3 | |
| model_settings | 502 | **245** | 10 | |
| menus / menu_lines / menu_items | 8 / 24 / 23 | 0 / **19** / **12** | 1 / 0 / 5 | |
| roles | 0 | **1** | 0 | `super_admin` bị xóa cứng (1 user giữ role này ở snapshot) |
| permissions | 4 | 0 | 0 | |

Chỉ so số lượng (chưa diff cột): product_images +160, product_sku_images +11, product_sku_promotion_prices +54, attribute_values +43, attributes +8, category_attributes +267, product_attributes +10, medias +375, ranks +12, promotions/promotion_codes +1, blog_categories +7, plan_subscription_usages +3, store_domains/payments +3, model_has_roles +39. Bảng tra cứu địa lý, plans, plan_features, order_statuses, payment_methods, delivery_providers: **không đổi**.

## 3. Phân bổ theo store

- **3 store mới**: 2920 OLEORAH ENTERPRISE (25/09), 2921 RNTJ DASH EMPIRE (05/10), 2922 ASRA KARIM APPAREL (14/10), đều status 1.
- Store **2919** đã có trong PW2 (VERIFIED) nhưng nhận thêm 30 product, 47 category, 10 page sau snapshot (store mới tạo sát giờ dump).
- Product mới: 70 thuộc store mới, 30 thuộc 2919. Category mới: 109 store mới + 47 store 2919.
- Order mới: store 575 (2), 1335 (1). User mới: 27 thuộc store 2680, 6 thuộc store mới.
- Store đổi trạng thái: 1→3: 53; 2→3: 10; 1→2: 7; 3→2: 3; 3→1: 1. User: 1→3: 126; 3→1: 8.

## 4. Hệ quả cho thiết kế delta

1. Delta nhỏ → script gọn; trọng tâm: **3 store mới trọn gói**, **cập nhật lifecycle** (store/user/subscription), **catalog bổ sung** của store 2919 + store mới, **3 order**, **blog/page**.
2. **Xóa cứng có thật** ở dữ liệu website (page_components, model_settings, banners, menu_lines/items) → phải diff theo id, không dùng được `updated_at`.
3. **Chuẩn hóa định dạng là bắt buộc** (mục 1); dump mới phải cùng công cụ/định dạng hoặc lấy trực tiếp từ DB.
4. Lookup đổi: `roles` mất `super_admin`, `permissions` +4 → quy tắc "lookup đổi thì dừng" phải có ngoại lệ có duyệt cho 2 bảng này.
5. Order/customer cũ không đổi → không cần logic cập nhật order cho đợt này.

## Câu hỏi còn mở

1. Store status 3 và user status 3 nghĩa là gì trong PW1 (expired/banned)? Quyết định map sang `suspended` cho 63 store chuyển sang 3.
2. 1 user đang giữ role `super_admin` (đã bị xóa) — xử lý thế nào ở PW2?
3. Dump mới lấy bằng công cụ nào (giữ định dạng CSV giống 16/09) hay delta đọc trực tiếp DB PW1?

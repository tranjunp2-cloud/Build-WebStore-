# Phase 06 — Test + diễn tập

**Ưu tiên:** P0 · **Trạng thái:** ⬜ · **Phụ thuộc:** 01–05

## Test (Vitest, TC-ID mới trong `docs/qa/F42-pw1-master-json-export.md` mục "Delta")
- TC-F42-DELTA-01 chuẩn hóa `'` + số + guard đầu vào (thiếu bảng, header đổi, số dòng tụt, id trùng).
- TC-F42-DELTA-02 diff map old/new: đổi 1 dòng con (product_images) → đúng 1 product CHANGED; xóa dòng → GONE; thêm → NEW.
- TC-F42-DELTA-03 phân loại NEW/CHANGED/UNCHANGED/GONE/RECOVERED với ledger giả lập (fixture DB test, không mock logic).
- TC-F42-DELTA-04 writer idempotent: apply 2 lần → lần 2 không ghi (integration với DB test).
- TC-F42-DELTA-05 `website-input.json` qua `parseBatchInput`, có `destination`.

## Diễn tập (không đụng DB dev gốc)
1. Tạo bản copy: `createdb -T primeweb primeweb_delta_rehearsal` trong container `primeweb-db`.
2. Gate tái lập: `--old DB_PROD --new DB_PROD` → chỉ lệch đúng các bản ghi dính `'`; ghi lại thời gian/RAM.
3. Xin file xuất PW1 mới nhất (93 bảng) → `--new <dir>` trên bản copy; đối chiếu số liệu scout 26/10 (3 store, 40 user, 100 product, 3 order, 74 store đổi status…).
4. Chạy lại lần 2 → 0 ghi.
5. Đăng nhập thử owner store 2920; mở dashboard product store 2919.
6. `npm run migrate:pw1:website -- <out>/website-input.json --dry-run` (chỉ validate).

## Lệnh kiểm tra
```bash
npx tsc --noEmit
npx vitest run src/__tests__/unit/migration/pw1-delta src/__tests__/integration/pw1-delta
```

## Ngày release
Chuẩn bị trên máy chạy: bộ CSV 16/09, bộ CSV mới (chứa dữ liệu nhạy cảm, chuyển an toàn), `PW1_APP_KEY`, `DATABASE_URI` trỏ prod.

Freeze PW1 → xuất 93 bảng → dump DB dev → prod → `migrate:pw1:delta` trên prod (`--old` = bộ 16/09, `--new` = bộ vừa xuất) → duyệt tóm tắt → `y` → lưu `--out`.

## Thành công
- Toàn bộ test pass, gate đạt, diễn tập khớp số liệu, lần 2 không ghi.

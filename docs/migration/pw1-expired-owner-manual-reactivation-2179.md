# Mở lại 5 store PW1 bị khoá nhầm lúc migration (#2179)

## Trước khi bắt đầu

- Làm trên **trang admin prod**, bằng tài khoản **super-admin**.
- **Chỉ làm khi PR #6 đã lên prod.** PR này chặn web và đặt hàng của store hết hạn. Làm trước thì 5 store sẽ mở web và nhận đơn dù chưa gia hạn.

## Vì sao phải sửa

5 store này hết hạn trên PW1 nhưng không bị ban. Lúc migration, chúng bị khoá như store bị ban (`Suspended`).

Merchant gia hạn xong, store vẫn bị khoá, vì gia hạn chỉ cập nhật ngày hết hạn của gói chứ không mở khoá store.

Sau khi sửa:
- Store vẫn đóng cho tới khi merchant gia hạn: web báo "tạm ngưng", owner không đăng nhập được, khách không đặt được đơn.
- Merchant gia hạn xong, store **tự mở lại**, không cần ai làm gì thêm.

## Danh sách store cần sửa

| # | Store PW1 | Slug (dùng để tìm) | Tên | Hết hạn |
|---|---|---|---|---|
| 1 | 796 | `radz-resources-sdn-bhd` | RADZ RESOURCES SDN. BHD. | 26/11/2025 |
| 2 | 1240 | `zul-foodie-group-sdn-bhd-2` | SITY MARINE PRODUCTS SDN. BHD. | 16/12/2025 |
| 3 | 1322 | `stesen-minyak-dzullia-kahar` | STESEN MINYAK DZULLIA KAHAR | 02/06/2025 |
| 4 | 1337 | `teckplus-marketing-m-sdnbhd` | TECKPLUS MARKETING (M) SDN.BHD. | 21/05/2026 |
| 5 | 1683 | `lenchong-metal-works-sdn-bhd` | LENCHONG METAL WORKS SDN BHD | 21/07/2026 |

Cả 5 store hiện đều giống nhau:
- Tenant: `Suspended`, COD tắt.
- Site: COD tắt.
- Owner: membership `Suspended`.

Trên PW1 cả 5 store đều bật COD.

**Không sửa** 4 tài khoản test của Prime: `prime-test`, `prime-test-2`, `prod-tm-stan`, `prime-test-freemium-4`.

## Cách sửa

Làm lần lượt từng store, đủ 3 bước.

**Trước khi sửa, kiểm tra 2 điều.** Sai điều nào thì **bỏ qua store đó** và ghi lại:
- Store vẫn giống mô tả ở trên (ví dụ tenant chưa bị đổi sang `Active`).
- Store có gói main đã hết hạn: vào **Plan Subscriptions**, lọc **Tenant** bằng tên tenant. Phải thấy 1 dòng có **Name** là `main` và **Ends At** là ngày đã qua.
  - Không có gói main thì **không sửa**: đổi sang `Active` sẽ mở web ngay, và merchant cũng không gia hạn được qua SSO.

### Bước 1: Tenant

1. Vào **Tenants**, tìm theo slug, mở tenant.
2. **Status**: chọn **Active**.
3. Trong mục **Payments**: tick **Cash on Delivery (COD)**.
4. Bấm **Save**.

### Bước 2: Owner

1. Vào **Users**, lọc **Tenant Memberships › Tenant** bằng tên tenant ở bước 1.
2. Mở user có role **owner**.
3. Trong mục **Tenant Memberships**, tìm dòng của tenant này. **Status**: chọn **Active**.
   - Chỉ sửa dòng của tenant này, không đụng các dòng khác.
4. Bấm **Save**.

### Bước 3: Site

1. Vào **Sites**, lọc **Tenant** bằng tên tenant ở bước 1, mở site.
2. Trong mục **Payment Configuration**: tick **Enable Cash on Delivery**.
   - Không đổi QR hay thông tin ngân hàng.
3. Bấm **Save**.

Bấm Save không gửi email cho merchant. Web cập nhật ngay, không phải chờ.

## Kiểm tra sau khi sửa

| Thử | Kết quả đúng |
|---|---|
| Mở web của store | Trang báo "This store is temporarily unavailable." |
| Owner đăng nhập | Không vào được (gói hết hạn) |
| Merchant gia hạn | Web mở lại, checkout có COD, owner đăng nhập được |

Xong thì comment vào issue #2179: ngày làm, người làm, store đã sửa, store bỏ qua (nếu có).

## Gặp lỗi

| Lỗi | Cách xử lý |
|---|---|
| **Status** hoặc **Tenant Memberships** không cho sửa | Tài khoản không phải super-admin |
| Bấm Save báo lỗi ở một field khác | Không sửa field đó cho qua. Chụp màn hình gửi dev |
| Sửa xong web vẫn mở bình thường | Đặt tenant về **Suspended** ngay rồi báo dev. Thường do PR #6 chưa lên prod, hoặc store không có gói main |

## Muốn trả lại như cũ

Đổi ngược 3 bước:
- Tenant: **Suspended**, bỏ tick COD.
- Owner: membership **Suspended**.
- Site: bỏ tick COD.

# Đối soát địa chỉ PW1 → PW2 — 23/09/2026

Nguồn kiểm tra: artifact 1.10.2 trong run `pw1-2026-09-23T10-09-52-638Z-d1cdae61`, CSV `addresses_202609161351.csv` có SHA-256 khớp manifest. Đây là kiểm tra file; không ghi DB.

## Kết quả 891 địa chỉ

| Nhóm | Số địa chỉ nguồn | Thực tế trong master |
|---|---:|---|
| Customer: emitted hoặc deduplicated | 789 | Đã kiểm tra đủ index địa chỉ, line1 và country |
| Customer: overflow | 99 | Giữ CSV theo giới hạn 10 địa chỉ/Customer, không thêm quá cap |
| Customer: địa lý không hợp lệ | 3 | Store 43 / Address 154, 155, 156: tỉnh không thuộc quốc gia; chưa đưa vào Customer |
| Order.shippingAddress | 869 | Có đủ target, line1/country/city/postcode; chỉ 3 địa chỉ lệch địa lý trên không có state |
| Order bị bỏ theo policy | 22 | Không còn Order để ghi shippingAddress; 19 địa chỉ vẫn có trong Customer, 3 overflow |

Hai nhóm Customer và Order chồng nhau; không cộng các số trong bảng. Không có địa chỉ nguồn nào không có usage trong receipt.

## Các field được mapping

| PW1 | PW2 |
|---|---|
| address | line1; Customer trim khoảng trắng, Order giữ nguyên chuỗi |
| city, hoặc district.name khi city rỗng | city |
| ward.name/district.name khác city | line2; có thể không cần xuất |
| province.name | state; bỏ khi quan hệ địa lý nguồn không khớp |
| post_code | postcode |
| country.name | country |
| Usage Shipping/Billing | Customer.addresses.label |

Customer.addresses có tối đa 10 dòng và line1 bắt buộc. Các địa chỉ được chọn từ Order liên quan mới nhất, khử trùng theo bộ field địa chỉ; một dòng được đánh dấu mặc định. Order giữ shippingAddress riêng, không chịu cap10 của Customer.

## Metadata không có cột tương ứng ở PW2

- `full_address`: không giữ nguyên định dạng chuỗi tổng hợp ở PW2. Trong snapshot này, token của cả 891 chuỗi đều nằm trong address/city/postcode và tên địa lý nguồn; không phát hiện token ngoài các field cấu trúc. Đây không phải cam kết cho snapshot khác.
- `phone`: cả 891 số điện thoại địa chỉ trùng Customer liên quan sau chuẩn hóa ký tự số; PW2 address không có phone riêng.
- `comment`: 891 dòng đều rỗng.
- `created_at`, `updated_at`: PW2 không có timestamp riêng cho từng địa chỉ con.
- Các giá trị gốc vẫn nằm trong CSV đã ràng buộc hash.

## 22 dòng bị report là chưa mapping phần cấu trúc

Nguyên nhân: mapper chỉ ghi contribution từ Order.shippingAddress; 22 Order bị bỏ nên thiếu contribution này, dù helper Customer đã mapping 19 địa chỉ. Cần bổ sung bằng chứng mapping Customer trong exporter, không thêm địa chỉ mới hoặc vượt cap.

| Store | Address | Customer | Index | Kết quả trong master |
|---|---|---|---:|---|
| 43 | 112 | 49 | 3 | Đã có |
| 43 | 132 | 102 | 4 | Đã có |
| 70 | 176 | 126 | 2 | Đã có |
| 43 | 186 | 133 | 0 | Đã có |
| 82 | 215 | 142 | — | Overflow; Customer đã đủ 10 |
| 124 | 257 | 154 | 0 | Đã có |
| 82 | 269 | 157 | 0 | Đã có |
| 70 | 279 | 166 | 1 | Đã có |
| 60 | 308 | 186 | 1 | Đã có |
| 70 | 365 | 225 | 2 | Đã có |
| 60 | 372 | 229 | 0 | Đã có |
| 190 | 407 | 238 | 2 | Đã có |
| 407 | 480 | 285 | 0 | Đã có |
| 88 | 488 | 293 | 0 | Đã có |
| 324 | 499 | 304 | 0 | Đã có |
| 324 | 548 | 303 | 7 | Đã có |
| 88 | 733 | 291 | 5 | Đã có |
| 575 | 765 | 379 | — | Overflow; Customer đã đủ 10 |
| 575 | 769 | 380 | — | Overflow; Customer đã đủ 10 |
| 1335 | 957 | 463 | 0 | Đã có |
| 1499 | 1013 | 508 | 2 | Đã có |
| 1499 | 1022 | 508 | 0 | Đã có |

Index trong bảng tính từ 0. Ba overflow cụ thể: Store82/Address215 → Customer142; Store575/Address765 → Customer379; Store575/Address769 → Customer380.

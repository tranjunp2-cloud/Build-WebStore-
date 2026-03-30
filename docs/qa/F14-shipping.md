# Bo Test Case: F14 — Shipping (Malaysia)
> **Cap nhat:** 2026-03-26 | **Thuc hien:** QA Team
> **Nguon Tham chieu:** PRD (`F14-shipping.md`), User Stories, Wave 6 Scope.

---

## 1. Muc Tieu (Objective)
Cung cap bo Test Suite kiem thu tinh nang Shipping cho thi truong Malaysia (F14). Bo kich ban bao phu cac quy tac tinh phi van chuyen (West MY vs East MY), nguong mien phi ship, giao dien cai dat Shipping cua Seller, hien thi phi ship tai Checkout, va cac edge case lien quan. Tong cong **20 kich ban chi tiet** (Positive + Negative + Edge cases).

---

## 2. Thong Tin Chung (Test Environment)
| Thong so | Dien giai |
|---|---|
| Moi truong | Staging / Localhost voi du lieu Seller da cau hinh shipping. |
| Tham gia | Seller (Merchant), Khach mua (Customer / Guest), Admin. |
| Thiet bi | Mobile (375px), Tablet (768px), Desktop (1440px). |
| Vung dia ly | West Malaysia (Selangor, KL, Penang...), East Malaysia (Sabah, Sarawak). |
| Dong tien | MYR (RM). |

---

## 3. Ma Tran Kich Ban Kiem Thu (Traceability Matrix)

| ID | LOAI | KICH BAN (Scenario) | CAC BUOC THUC HIEN | KET QUA MONG DOI (EXPECTED) | MUC DO |
|:---|:---|:---|:---|:---|:---:|
| **[Shipping Cost Calculation — West vs East MY]** ||||||
| **TC-F14.01** | `Func` | Tinh phi ship West Malaysia | **1.** Khach nhap dia chi giao hang tai Selangor.<br>**2.** Them san pham vao gio, vao Checkout. | **GIVEN** khach co dia chi thuoc West MY **WHEN** xem trang Checkout **THEN** phi ship hien thi RM 8 (flat rate). Tong don = gia SP + RM 8. | Critical |
| **TC-F14.02** | `Func` | Tinh phi ship East Malaysia | **1.** Khach nhap dia chi giao hang tai Sabah.<br>**2.** Them san pham vao gio, vao Checkout. | **GIVEN** khach co dia chi thuoc East MY (Sabah/Sarawak) **WHEN** xem trang Checkout **THEN** phi ship hien thi RM 15 (flat rate). Tong don = gia SP + RM 15. | Critical |
| **TC-F14.03** | `Func` | Phan loai bang State (ranh gioi) | **1.** Tao don voi dia chi o Labuan (Federal Territory thuoc East MY).<br>**2.** Kiem tra phi ship. | **GIVEN** dia chi thuoc Labuan (East MY boundary) **WHEN** he thong tinh phi **THEN** ap dung gia East MY = RM 15. Khong nham sang West MY. | High |
| **TC-F14.04** | `Edge` | Dia chi khong xac dinh State | **1.** Khach nhap dia chi thieu truong State hoac State khong hop le.<br>**2.** Bam Checkout. | **GIVEN** truong State trong hoac khong hop le **WHEN** he thong tinh phi ship **THEN** hien thong bao loi "Please select a valid state" va khong cho phep dat hang. | High |
| **TC-F14.05** | `Func` | Nhieu san pham — cung phi ship | **1.** Them 5 san pham tu cung 1 Seller vao gio.<br>**2.** Dia chi West MY, vao Checkout. | **GIVEN** nhieu SP cung Seller, dia chi West MY **WHEN** xem Checkout **THEN** phi ship van la RM 8 (flat rate, khong nhan theo so luong SP). | Critical |
| **[Free Shipping Threshold]** ||||||
| **TC-F14.06** | `Func` | Mien phi ship khi vuot nguong | **1.** Seller cai dat free shipping above RM 100.<br>**2.** Khach dat don RM 150, dia chi West MY. | **GIVEN** Seller cau hinh free ship >= RM 100 **WHEN** tong don hang = RM 150 **THEN** phi ship = RM 0. Hien nhan "Free Shipping" mau xanh. | Critical |
| **TC-F14.07** | `Func` | Chua dat nguong mien phi ship | **1.** Seller cai dat free shipping above RM 100.<br>**2.** Khach dat don RM 80, dia chi West MY. | **GIVEN** tong don = RM 80 < nguong RM 100 **WHEN** xem Checkout **THEN** phi ship = RM 8 (West MY). Hien thong bao "Spend RM 20 more for free shipping". | High |
| **TC-F14.08** | `Edge` | Don hang dung bang nguong | **1.** Seller cai dat free ship >= RM 100.<br>**2.** Khach dat don dung RM 100. | **GIVEN** tong don = RM 100 = nguong **WHEN** tinh phi ship **THEN** phi ship = RM 0 (dieu kien >= duoc ap dung). Hien "Free Shipping". | High |
| **TC-F14.09** | `Func` | Seller khong bat free shipping | **1.** Seller de nguong free shipping = 0 hoac khong cau hinh.<br>**2.** Khach dat don RM 500 tai East MY. | **GIVEN** Seller khong cau hinh free shipping **WHEN** khach dat don bat ky gia nao **THEN** luon tinh phi ship theo vung (RM 15 East MY). Khong co nhan Free Shipping. | High |
| **TC-F14.10** | `Edge` | Free ship chi ap dung cho Seller cu the | **1.** Gio hang co SP tu Seller A (free ship >= RM 50) va Seller B (khong free ship).<br>**2.** Tong don Seller A = RM 80, Seller B = RM 30. | **GIVEN** multi-seller cart **WHEN** xem Checkout **THEN** Seller A hien Free Shipping (RM 0), Seller B van tinh phi ship binh thuong. Tach ro theo tung Seller. | High |
| **[Seller Shipping Settings UI]** ||||||
| **TC-F14.11** | `UI` | Hien thi trang Shipping Settings | **1.** Seller dang nhap Dashboard.<br>**2.** Vao Settings > Shipping. | **GIVEN** Seller da dang nhap **WHEN** truy cap Shipping Settings **THEN** hien dung form: West MY rate, East MY rate, Free shipping threshold toggle + input. Mac dinh West = RM 8, East = RM 15. | High |
| **TC-F14.12** | `Func` | Cap nhat gia ship thanh cong | **1.** Seller doi West MY rate = RM 10, East MY rate = RM 20.<br>**2.** Bam Save. | **GIVEN** Seller nhap gia hop le **WHEN** bam Save **THEN** luu thanh cong, hien toast "Shipping settings updated". DB cap nhat dung gia moi. | Critical |
| **TC-F14.13** | `Sec` | Validate input gia ship am | **1.** Seller nhap West MY rate = -5.<br>**2.** Bam Save. | **GIVEN** gia ship la so am **WHEN** bam Save **THEN** hien loi validation "Shipping rate must be a positive number". Khong luu vao DB. | High |
| **TC-F14.14** | `Edge` | Nhap gia ship = 0 | **1.** Seller nhap West MY rate = 0, East MY rate = 0.<br>**2.** Bam Save. | **GIVEN** gia ship = 0 **WHEN** luu **THEN** cho phep luu (seller muon mien phi ship toan bo). Checkout hien RM 0 cho tat ca vung. | Medium |
| **TC-F14.15** | `Sec` | Nhap gia ship qua lon | **1.** Seller nhap West MY rate = 999999.<br>**2.** Bam Save. | **GIVEN** gia ship vuot gioi han hop ly **WHEN** bam Save **THEN** hien loi "Shipping rate cannot exceed RM 1,000" (hoac gioi han da dinh). Khong luu. | Medium |
| **TC-F14.16** | `UI` | Responsive Shipping Settings mobile | **1.** Seller truy cap Shipping Settings tren dien thoai 375px. | **GIVEN** viewport 375px **WHEN** xem Shipping Settings **THEN** form hien thi dang stack doc (column). Input va button khong bi tran ra ngoai man hinh. Co the cuon va thao tac binh thuong. | High |
| **[Checkout Shipping Display]** ||||||
| **TC-F14.17** | `UI` | Hien thi breakdown phi ship tai Checkout | **1.** Khach them SP gia RM 50 vao gio.<br>**2.** Nhap dia chi West MY, xem Checkout. | **GIVEN** don hang hoan chinh **WHEN** xem trang Checkout **THEN** hien breakdown: Subtotal = RM 50, Shipping = RM 8, Total = RM 58. Cac dong tach biet ro rang. | Critical |
| **TC-F14.18** | `UI` | Order confirmation hien phi ship | **1.** Hoan tat dat hang.<br>**2.** Xem trang Order Confirmation. | **GIVEN** don hang da dat thanh cong **WHEN** xem trang xac nhan **THEN** hien day du: san pham, gia SP, phi shipping rieng dong, tong cong. Khop voi so lieu luc Checkout. | High |
| **TC-F14.19** | `Func` | Thay doi dia chi — cap nhat phi ship | **1.** Khach dang o Checkout, dia chi West MY (RM 8).<br>**2.** Doi dia chi sang Sarawak (East MY). | **GIVEN** khach da co phi ship West MY **WHEN** doi dia chi sang East MY **THEN** phi ship tu dong cap nhat tu RM 8 -> RM 15. Tong don tinh lai chinh xac. Khong can reload trang. | Critical |
| **TC-F14.20** | `Edge` | Don hang 0 dong — phi ship van tinh | **1.** Seller co promo giam gia 100%.<br>**2.** Khach dat don gia SP = RM 0, dia chi East MY. | **GIVEN** tong gia SP = RM 0 **WHEN** tinh phi ship **THEN** phi ship van ap dung RM 15 (East MY) tru khi dat nguong free ship. Tong don = RM 15. Khong bi loi tinh toan. | Medium |

---

## 4. Hanh Trinh End-to-End (E2E UAT Flow)

**E2E #1: Seller cau hinh Shipping -> Khach mua hang**
1. Seller dang nhap Dashboard > Settings > Shipping.
2. Cau hinh: West MY = RM 8, East MY = RM 15, Free shipping above = RM 100.
3. Bam Save thanh cong.
4. Khach truy cap storefront, them SP gia RM 120 vao gio hang.
5. Nhap dia chi West MY -> Checkout hien Free Shipping (vuot nguong RM 100).
6. Hoan tat dat hang -> Order Confirmation hien phi ship = RM 0, tong = RM 120.
7. Khach dat don thu 2 gia RM 50, dia chi East MY -> phi ship = RM 15.
8. Order Confirmation hien Subtotal RM 50 + Shipping RM 15 = Total RM 65.

**E2E #2: Khach doi dia chi giua Checkout**
1. Khach them SP gia RM 80 vao gio, nhap dia chi KL (West MY).
2. Checkout hien phi ship RM 8, tong RM 88.
3. Khach doi dia chi sang Sabah (East MY).
4. He thong tu dong cap nhat: phi ship RM 15, tong RM 95.
5. Khach xac nhan dat hang -> Order Confirmation khop voi RM 95.

---

## 5. Tieu chi Danh gia Chat luong (Quality Gates)

| Nhom Kiem thu | Trang Thai | Ghi chu |
|---|---|---|
| **1. Shipping Calculation Logic** | [ ] Da chay 0/7 TC | Kiem tra West/East phan loai dung, flat rate khong nhan theo so luong. |
| **2. Free Shipping Threshold** | [ ] Da chay 0/5 TC | Boundary test (=, <, >), multi-seller isolation. |
| **3. Seller Settings CRUD** | [ ] Da chay 0/6 TC | Validation input, responsive mobile, luu DB dung. |
| **4. Checkout & Confirmation UI** | [ ] Da chay 0/4 TC | Breakdown hien thi, dong bo khi doi dia chi. |
| **5. Security & Edge Cases** | [ ] Da chay 0/4 TC | Input am, qua lon, dia chi thieu State, don 0 dong. |

> **Luu y Wave 6:** Khong co tich hop Carrier API. Tracking number nhap tay. Khong can test API carrier.

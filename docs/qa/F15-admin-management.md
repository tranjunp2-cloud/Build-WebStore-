# Bo Test Case: F15 — Admin Management & SaaS Ops
> **Cap nhat:** 2026-03-26 | **Thuc hien:** QA Team
> **Nguon Tham chieu:** PRD (`F15-admin-management.md`), User Stories (US-F15-01 to US-F15-10).

---

## 1. Muc Tieu (Objective)
Cung cap bo Test Suite kiem thu tinh nang Quan tri He thong SaaS (F15). Bao phu 10 User Stories: MRR/Churn analytics, quan ly User/Workspace, Impersonation, Subscription tiers, Promo codes, Audit logs, Broadcast notifications, va RBAC (Super Admin / Admin / Support). Tong cong **25 kich ban chi tiet** bao gom Positive, Negative, Security va Edge cases.

---

## 2. Thong Tin Chung (Test Environment)
| Thong so | Dien giai |
|---|---|
| Moi truong | Staging voi du lieu >= 50 workspaces, 200+ users, 12 thang MRR data. |
| Tham gia | Super Admin, Admin, Support, Tenant Owner (de test impersonation). |
| Thiet bi | Desktop (1440px), Mobile (375px). |
| Auth | 2FA bat buoc cho moi hanh dong admin. |
| Roles | Super Admin (full), Admin (no audit delete, no impersonate), Support (read-only + impersonate). |

---

## 3. Ma Tran Kich Ban Kiem Thu (Traceability Matrix)

| ID | LOAI | KICH BAN (Scenario) | CAC BUOC THUC HIEN | KET QUA MONG DOI (EXPECTED) | MUC DO |
|:---|:---|:---|:---|:---|:---:|
| **[US-F15-01/02] MRR & Churn Analytics Dashboard** ||||||
| **TC-F15.01** | `Func` | Hien thi MRR dashboard chinh xac | **1.** Super Admin dang nhap Admin Panel.<br>**2.** Truy cap Analytics > MRR Dashboard. | **GIVEN** co du lieu subscription 12 thang **WHEN** xem MRR Dashboard **THEN** hien bieu do MRR theo thang, tong MRR hien tai, % thay doi so voi thang truoc. So lieu khop voi query DB `SUM(active_subscriptions.price)`. | Critical |
| **TC-F15.02** | `Func` | Churn rate tinh dung | **1.** Xem muc Churn Analytics.<br>**2.** So sanh voi du lieu DB. | **GIVEN** 100 subscribers dau thang, 5 huy **WHEN** xem Churn Rate **THEN** hien thi 5% churn. Cong thuc: (so huy / tong dau ky) x 100. Bieu do trend churn 6 thang hien dung. | Critical |
| **TC-F15.03** | `UI` | Dashboard responsive mobile | **1.** Truy cap MRR Dashboard tren 375px. | **GIVEN** viewport mobile **WHEN** xem Dashboard **THEN** bieu do thu nho vua man hinh, cac card KPI xep stack doc, co the cuon xem toan bo. Khong bi tran ngang. | High |
| **TC-F15.04** | `Edge` | Dashboard khi chua co du lieu | **1.** Tao workspace moi, chua co subscription nao.<br>**2.** Xem Analytics. | **GIVEN** khong co du lieu subscription **WHEN** xem Dashboard **THEN** hien Empty State "No subscription data yet" voi icon phu hop. Khong bi loi chia cho 0, khong crash. | High |
| **[US-F15-03/04] User & Workspace Management** ||||||
| **TC-F15.05** | `Func` | Tim kiem User theo email | **1.** Super Admin vao Users Management.<br>**2.** Nhap email "test@example.com" vao thanh Search. | **GIVEN** user ton tai trong DB **WHEN** tim kiem theo email **THEN** tra ve dung user khop, hien ten, email, workspace, trang thai (active/suspended), ngay tao. Ket qua tra ve < 2 giay. | Critical |
| **TC-F15.06** | `Func` | Loc User theo trang thai & workspace | **1.** Chon filter: Status = "Suspended", Workspace = "Shop ABC".<br>**2.** Xem ket qua. | **GIVEN** co users suspended trong workspace "Shop ABC" **WHEN** ap dung filter **THEN** chi hien thi users thoa dieu kien AND. So luong khop voi DB query. | High |
| **TC-F15.07** | `Func` | Suspend / Unsuspend User | **1.** Tim user "user@test.com".<br>**2.** Bam Suspend.<br>**3.** Xac nhan 2FA. | **GIVEN** user dang active **WHEN** Admin bam Suspend + xac nhan 2FA **THEN** user chuyen trang thai Suspended. User khong the dang nhap. Hien toast "User suspended successfully". Audit log ghi nhan hanh dong. | Blocker |
| **TC-F15.08** | `Func` | Xem Workspace hierarchy | **1.** Truy cap Workspaces Management.<br>**2.** Bam vao workspace "Shop ABC". | **GIVEN** workspace co owner + 3 members **WHEN** xem chi tiet **THEN** hien cay phan cap: Owner > Members. Hien subscription tier, ngay tao, so luong products, storage used. | High |
| **[US-F15-05] Impersonation (View as Tenant)** ||||||
| **TC-F15.09** | `Func` | Vao che do Impersonate | **1.** Super Admin tim workspace "Shop XYZ".<br>**2.** Bam "View as Tenant".<br>**3.** Xac nhan 2FA. | **GIVEN** Super Admin da xac thuc 2FA **WHEN** bam Impersonate **THEN** chuyen sang giao dien Dashboard cua "Shop XYZ". Hien banner canh bao mau vang "You are viewing as Shop XYZ — [Exit]" o top. Moi thao tac la read-only. | Blocker |
| **TC-F15.10** | `Func` | Thoat che do Impersonate | **1.** Dang o che do Impersonate.<br>**2.** Bam nut "Exit" tren banner. | **GIVEN** dang impersonate **WHEN** bam Exit **THEN** tro ve Admin Panel. Session impersonate bi huy. Banner bien mat. Admin quay lai quyen Admin binh thuong. | Blocker |
| **TC-F15.11** | `Sec` | Impersonate khong cho phep ghi du lieu | **1.** Dang impersonate workspace.<br>**2.** Thu tao product moi hoac xoa don hang. | **GIVEN** dang o che do impersonate (read-only) **WHEN** thu thuc hien write action **THEN** he thong chan voi thong bao "Impersonation mode is read-only". API tra 403 Forbidden. Khong co thay doi nao trong DB. | Blocker |
| **TC-F15.12** | `Sec` | Audit log ghi nhan impersonation | **1.** Super Admin impersonate workspace "Shop XYZ".<br>**2.** Xem Audit Logs. | **GIVEN** da impersonate **WHEN** xem Audit Logs **THEN** co entry: actor = Super Admin, action = "impersonate_start", target = "Shop XYZ", timestamp chinh xac. Khi exit co entry "impersonate_end". | Critical |
| **[US-F15-06/07] Subscription Tiers & Promo Codes** ||||||
| **TC-F15.13** | `Func` | Tao Subscription tier moi | **1.** Super Admin vao Subscription Management.<br>**2.** Bam "Add Tier": Name = "Pro", Price = RM 99/mo, Features = [10 products, custom domain].<br>**3.** Bam Save. | **GIVEN** nhap day du thong tin tier **WHEN** bam Save **THEN** tier moi hien trong danh sach. DB luu dung name, price, features. Toast "Tier created successfully". | High |
| **TC-F15.14** | `Func` | Tao Promo code | **1.** Vao Promo Codes > Add New.<br>**2.** Code = "LAUNCH50", Discount = 50%, Expiry = 2026-06-30, Max uses = 100.<br>**3.** Bam Create. | **GIVEN** nhap promo code hop le **WHEN** bam Create **THEN** promo hien trong danh sach, trang thai Active. DB luu dung tat ca truong. So lan su dung = 0/100. | High |
| **TC-F15.15** | `Func` | Validate promo code khi Checkout | **1.** Tenant dang ky subscription, nhap code "LAUNCH50".<br>**2.** Bam Apply. | **GIVEN** promo code Active va chua het han **WHEN** tenant nhap code **THEN** giam gia 50% hien thi. Tong thanh toan cap nhat chinh xac. Usage count tang 1 trong DB. | Critical |
| **TC-F15.16** | `Edge` | Promo code da het han | **1.** Thiet lap promo code voi expiry = hom qua.<br>**2.** Tenant nhap code khi Checkout. | **GIVEN** promo code da expired **WHEN** nhap code **THEN** hien loi "This promo code has expired". Khong ap dung giam gia. Usage count khong tang. | High |
| **TC-F15.17** | `Edge` | Promo code da het luot dung | **1.** Promo code max uses = 1, da duoc dung 1 lan.<br>**2.** Tenant khac nhap code. | **GIVEN** promo code da dat max uses **WHEN** nhap code **THEN** hien loi "This promo code is no longer available". Khong ap dung. | High |
| **[US-F15-08] Audit Logs** ||||||
| **TC-F15.18** | `Func` | Audit log ghi day du moi hanh dong Admin | **1.** Super Admin thuc hien: suspend user, tao tier, tao promo.<br>**2.** Xem Audit Logs. | **GIVEN** da thuc hien 3 hanh dong **WHEN** xem Audit Logs **THEN** co dung 3 entry voi: actor, action type, target, timestamp, IP address. Thu tu moi nhat truoc. | Critical |
| **TC-F15.19** | `Func` | Loc Audit log theo action type & date range | **1.** Chon filter: Action = "suspend_user", Date = "Last 7 days".<br>**2.** Xem ket qua. | **GIVEN** co audit entries trong 7 ngay qua **WHEN** ap dung filter **THEN** chi hien cac entry suspend_user trong khoang ngay. Pagination hoat dong khi > 50 entries. | High |
| **TC-F15.20** | `Sec` | Audit log khong the xoa/sua | **1.** Admin (khong phai Super Admin) truy cap Audit Logs.<br>**2.** Thu xoa hoac sua entry. | **GIVEN** role Admin **WHEN** xem Audit Logs **THEN** khong co nut Delete/Edit. API `DELETE /audit-logs/:id` tra 403. Audit logs la immutable. | Blocker |
| **[US-F15-09] Broadcast Notifications** ||||||
| **TC-F15.21** | `Func` | Gui broadcast notification | **1.** Super Admin vao Notifications > Broadcast.<br>**2.** Nhap: Title = "Maintenance", Body = "System maintenance at 2AM", Target = All tenants.<br>**3.** Bam Send. | **GIVEN** nhap noi dung broadcast **WHEN** bam Send + xac nhan **THEN** tat ca tenants nhan duoc in-app notification. Hien trong Notification Center cua moi tenant. Audit log ghi nhan. | High |
| **TC-F15.22** | `Edge` | Broadcast den nhom cu the | **1.** Chon Target = "Pro tier only".<br>**2.** Gui broadcast. | **GIVEN** chi chon Pro tier **WHEN** gui broadcast **THEN** chi tenants thuoc tier Pro nhan duoc. Tenant Free/Basic khong nhan. Kiem tra DB notification records khop. | Medium |
| **[US-F15-10] RBAC — Role Permission Matrix** ||||||
| **TC-F15.23** | `Sec` | Super Admin co full quyen | **1.** Dang nhap bang Super Admin.<br>**2.** Truy cap tat ca chuc nang: Users, Workspaces, Tiers, Promos, Audit, Impersonate, Broadcast. | **GIVEN** role Super Admin **WHEN** truy cap toan bo module **THEN** tat ca chuc nang truy cap duoc. Khong bi 403 o bat ky endpoint nao. Hien day du menu sidebar. | Blocker |
| **TC-F15.24** | `Sec` | Support role chi doc + impersonate | **1.** Dang nhap bang role Support.<br>**2.** Thu tao user moi, suspend user, tao tier. | **GIVEN** role Support **WHEN** thu write actions **THEN** API tra 403 Forbidden. UI an/disable cac nut Create, Edit, Delete. Chi hien nut "View" va "Impersonate". | Blocker |
| **TC-F15.25** | `Sec` | 2FA bat buoc cho moi hanh dong admin | **1.** Super Admin thu suspend user ma khong xac nhan 2FA.<br>**2.** Kiem tra phan hoi. | **GIVEN** admin thuc hien sensitive action **WHEN** chua xac nhan 2FA **THEN** he thong hien modal yeu cau nhap 2FA code. Action khong thuc thi cho den khi 2FA hop le. API tra 401 neu thieu 2FA token. | Blocker |

---

## 4. Hanh Trinh End-to-End (E2E UAT Flow)

**E2E #1: Toan bo luong Admin quan ly — tu Analytics den Action**
1. Super Admin dang nhap, xac nhan 2FA.
2. Xem MRR Dashboard — kiem tra so lieu khop DB.
3. Vao Users Management, tim user bi report.
4. Suspend user — xac nhan 2FA — toast thanh cong.
5. Xem Audit Logs — verify entry suspend vua tao.
6. Impersonate workspace cua user bi suspend — verify read-only mode.
7. Exit impersonate — verify quay lai Admin Panel.

**E2E #2: Subscription & Promo flow**
1. Super Admin tao tier "Business" = RM 199/mo.
2. Tao promo code "BIZ30" = 30% off, max 50 uses, het han 2026-12-31.
3. Tenant dang ky tier Business, nhap "BIZ30" -> gia giam con RM 139.3.
4. Xac nhan thanh toan -> promo usage = 1/50 trong Admin Panel.
5. Promo het luot -> tenant khac nhap "BIZ30" -> bao loi.

**E2E #3: RBAC validation**
1. Support dang nhap -> verify chi thay menu Read + Impersonate.
2. Support thu truy cap `/admin/tiers/create` truc tiep URL -> 403 Forbidden.
3. Admin dang nhap -> co the CRUD users nhung khong the xoa Audit logs.
4. Super Admin -> full quyen toan bo.

---

## 5. Tieu chi Danh gia Chat luong (Quality Gates)

| Nhom Kiem thu | Trang Thai | Ghi chu |
|---|---|---|
| **1. Analytics Dashboard** | [ ] Da chay 0/4 TC | MRR accuracy, churn formula, responsive, empty state. |
| **2. User & Workspace CRUD** | [ ] Da chay 0/4 TC | Search, filter, suspend, hierarchy view. |
| **3. Impersonation** | [ ] Da chay 0/4 TC | Enter/exit safely, read-only enforced, audit logged. |
| **4. Subscription & Promo** | [ ] Da chay 0/5 TC | Tier CRUD, promo create/validate/expire/max-use. |
| **5. Audit Logs** | [ ] Da chay 0/3 TC | Completeness, filtering, immutability. |
| **6. Broadcast** | [ ] Da chay 0/2 TC | All tenants, targeted tier. |
| **7. RBAC & Security** | [ ] Da chay 0/3 TC | Permission matrix, 2FA enforcement, 403 on unauthorized. |

> **Luu y Release:** RBAC va 2FA la Blocker — khong duoc release neu chua PASS het. Impersonation phai dam bao 100% read-only, khong co exception.

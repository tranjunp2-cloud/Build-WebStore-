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
| **[Payload admin REST] Method-override queries** ||||||
| **TC-F15.26** | `Func` | Admin list/relationship query qua POST + method override | **1.** Super Admin mo `/admin/collections/pages/<id>` (co field relationship/upload).<br>**2.** Mo dropdown relationship, cuon de tai them. | **GIVEN** admin gui `POST /api/<collection>` voi `X-Payload-HTTP-Method-Override: GET` + body urlencoded **WHEN** request qua route `(payload)/api/[...slug]` **THEN** Payload nhan body nguyen ven, tra 200 voi docs; khong co 500 "Body has already been read". Multipart `_payload` khong co file van duoc doi sang JSON. | P1 |
| **[Studio] Read-only team seat (`studio-viewer`)** ||||||
| **TC-F15.27** | `Sec` | Role helpers: viewer = Studio read-only | **1.** Gan role `studio-viewer` cho user.<br>**2.** Kiem tra quyen. | **GIVEN** user chi co `studio-viewer` **WHEN** mo Studio **THEN** duoc vao, co nhan "Read-only"; `tenant-owner` / `viewer` khong vao duoc. | P0 |
| **TC-F15.28** | `Sec` | Viewer doc API, khong ghi | **1.** Dang nhap viewer.<br>**2.** Mo trang Templates, bam Save / Publish / Delete. | **GIVEN** viewer **WHEN** goi GET `/api/admin/*` **THEN** 200; **WHEN** POST/PUT/PATCH/DELETE **THEN** 403, du lieu khong doi. | P0 |
| **TC-F15.29** | `Sec` | Cai dat AI chi super-admin | **1.** Viewer go `/studio/settings/ai`.<br>**2.** Goi GET `/api/admin/ai-settings`, `/api/admin/ai-providers/*`. | **GIVEN** viewer **WHEN** mo trang **THEN** bi chuyen ve `/studio`, menu khong co Settings; API tra 403. | P0 |
| **TC-F15.30** | `Func` | Viewer dang nhap va vao Studio | **1.** Viewer dang nhap `/login` (email + mat khau + OTP). | **GIVEN** viewer **WHEN** dang nhap xong **THEN** vao thang `/studio`; khach chua dang nhap bi chuyen ve trang dang nhap. | P1 |
| **[Support] Mo CMS merchant khong can OTP (`support`)** ||||||
| **TC-F15.31** | `Sec` | Role helpers: support / super-admin moi duoc dung | **1.** Gan role `support` cho user.<br>**2.** Kiem tra quyen. | **GIVEN** user co `support` hoac `super-admin` **WHEN** kiem tra **THEN** duoc dung; `studio-viewer` / `tenant-owner` khong duoc. | P0 |
| **TC-F15.32** | `Sec` | Link token khong dung lam session | **1.** Tao link.<br>**2.** Dung token cua link lam cookie `payload-token`. | **GIVEN** token link **WHEN** dung lam session **THEN** bi tu choi; token ky bang secret khac / audience khac bi tu choi. | P0 |
| **TC-F15.33** | `Sec` | Tao link: chi support, khong mo tai khoan staff | **1.** Support tim merchant theo email / ten cong ty.<br>**2.** Bam "Create login link". | **GIVEN** support **WHEN** tao link **THEN** 201, ghi `merchant_access_events` (ai tao, cho ai); merchant / viewer goi API **THEN** 401/403; tai khoan staff khong hien trong ket qua va tao link **THEN** 403. | P0 |
| **TC-F15.34** | `Sec` | Link dung 1 lan, het han 10 phut | **1.** Mo link o cua so an danh.<br>**2.** Mo lai link lan 2 / sau 10 phut. | **GIVEN** link moi **WHEN** mo **THEN** vao `/dashboard` cua merchant, session 4h co `impersonated_by`; **WHEN** mo lan 2 hoac het han **THEN** "This link can no longer be used". | P0 |
| **TC-F15.35** | `Func` | Trang /support chi cho support | **1.** Support dang nhap `/login`.<br>**2.** Merchant go `/support/merchant-access`. | **GIVEN** support **WHEN** dang nhap xong **THEN** vao thang `/support/merchant-access`; merchant / viewer / chua dang nhap **THEN** ve `/login`. | P1 |
| **TC-F15.36** | `Sec` | Phien support khong tu gia han | **1.** Mo CMS merchant bang link.<br>**2.** Cho trang dashboard goi `/api/auth/refresh-token`. | **GIVEN** phien mo bang link (co `impersonated_by`) **WHEN** goi refresh-token **THEN** 401, phien het han dung 4 gio. | P0 |
| **TC-F15.37** | `Sec` | Token link khong lo ra log | **1.** Tao link.<br>**2.** Xem URL. | **GIVEN** link vua tao **THEN** token nam sau `#` (khong gui len server), trang doc xong xoa khoi thanh dia chi; tai khoan co moi store bi suspend **THEN** link bao het hieu luc; 1 seat tao qua 10 link/phut **THEN** 429. | P1 |
| **[Support v1.1] Gioi han phien mo bang link + banner + menu** ||||||
| **TC-F15.38** | `Sec` [x] AUTO (invite/guards); resend MANUAL | Phien mo bang link: quan ly staff duoc, tru thao tac tao quyen lau dai | **1.** Mo CMS merchant bang link.<br>**2.** Moi staff role `editor`/`viewer`/`custom` bang email chua co tai khoan.<br>**3.** Moi role `owner` hoac `admin`; moi email da co tai khoan.<br>**4.** Doi role thanh `owner`/`admin`; doi role/khoa/xoa/xoa nhieu mot thanh vien dang la owner.<br>**5.** Gui lai loi moi. | **GIVEN** phien co `impersonated_by` **THEN** buoc 2 va 5 thanh cong; buoc 3 va 4 tra 403 `impersonation_forbidden_action`, khong doi `users.tenants`, khong doi mat khau, khong gui email. **GIVEN** owner dang nhap thuong **THEN** moi owner/admin van duoc (khong doi hanh vi cu). | P0 |
| **TC-F15.39** | `Sec` [x] AUTO (payout guards/toggles); product edit MANUAL | Phien mo bang link khong doi noi nhan tien | **1.** Mo CMS merchant bang link.<br>**2.** Mo Settings > Payments; thu doi bank / QR, upload QR, luu / ngat Xendit, ngat Stripe, goi `POST /api/xendit/connect`, Stripe connect onboard / account-link.<br>**3.** Goi lai server action luu bank kem header `Authorization: Bearer x`.<br>**4.** Mo Stripe callback voi `state` hop le cua tenant trong phien mo bang link.<br>**5.** Bat / tat 1 phuong thuc; sua 1 san pham. | **GIVEN** phien co `impersonated_by` **THEN** so tai khoan bi che, truong bank an; buoc 2 va 3 bi tu choi, du lieu thanh toan khong doi (ke ca PATCH `/api/tenants/:id`); cookie JWT `%2E` van bi chan; buoc 4 chuyen `/settings/payments?stripe=refresh`, `stripeAccountId` khong doi; buoc 5 luu thanh cong. **GIVEN** owner dang nhap thuong **WHEN** connect Stripe **THEN** callback luu `stripeAccountId`, ve `?stripe=complete`. | P0 |
| **TC-F15.40** | `Sec` [x] AUTO | Phien mo bang link khong doi mat khau, khong dang ky push | **1.** Mo CMS bang link cua owner va cua staff merchant (khong phai owner).<br>**2.** POST `/api/users/me/password`.<br>**3.** Xem dashboard; POST `/api/notifications/push-subscribe`. | **GIVEN** phien co `impersonated_by` **THEN** buoc 2: 403 `impersonation_forbidden_action`, khong thu dang nhap bang mat khau cu (khong tang so lan sai); PATCH `/api/users/:id` (email/roles) trong phien ho bi tu choi, du lieu khong doi; buoc 3: khong hien loi moi bat thong bao, API tra 403, khong luu subscription. | P0 |
| **TC-F15.41** | `Sec` [x] AUTO | Super-admin chi dang nhap `/admin` van tao link duoc (khong bat OTP, quyet dinh 2026-11-10) | **1.** Super-admin dang nhap `/admin` (chi mat khau).<br>**2.** Mo `/studio` → `/support/merchant-access`; tim merchant; tao link.<br>**3.** Goi GET/POST khi chua dang nhap. | **GIVEN** phien mat khau super-admin **THEN** GET tim merchant 200, POST tao link 201, ghi `merchant_access_events` voi actor la super-admin. **GIVEN** chua dang nhap **THEN** 401; viewer **THEN** 403. | P1 |
| **TC-F15.42** | `Func` [x] AUTO (banner/session); geometry MANUAL | Banner trong phien mo bang link | **1.** Mo CMS merchant bang link.<br>**2.** Mo `/dashboard`, `/editor`, `/builder`.<br>**3.** Merchant dang nhap binh thuong, mo cac trang tren. | **GIVEN** phien co `impersonated_by` **THEN** banner co dinh o day man hinh: email merchant, nguoi dang thao tac, thoi gian con lai, nut Exit; khong che TopHeader, sidebar, thanh cong cu editor hay toast. **GIVEN** dang nhap thuong **THEN** khong co banner. | P1 |
| **TC-F15.43** | `Func` [x] AUTO | Exit tren banner ket thuc phien | **1.** Dang o phien mo bang link.<br>**2.** Bam Exit.<br>**3.** Mo lai `/dashboard`. | **GIVEN** phien mo bang link **WHEN** bam Exit **THEN** cookie `payload-token` bi xoa, chuyen `/login`; du lieu AI trong localStorage bi xoa; mo lai `/dashboard` **THEN** ve trang dang nhap. | P1 |
| **TC-F15.44** | `Func` [x] AUTO | Menu Studio co Merchant CMS access | **1.** Super-admin mo `/studio`.<br>**2.** Viewer mo `/studio`. | **GIVEN** super-admin **THEN** section Admin co muc "Merchant CMS access", bam vao mo `/studio/merchant-access`. **GIVEN** viewer **THEN** khong thay muc nay. | P1 |
| **TC-F15.45** | `Func` [x] AUTO | Trang Merchant CMS access trong Studio | **1.** Super-admin mo `/studio/merchant-access`.<br>**2.** Super-admin mo `/support/merchant-access`.<br>**3.** Viewer mo `/studio/merchant-access`.<br>**4.** Role `support` mo `/support/merchant-access`. | **GIVEN** super-admin **THEN** trang nam trong khung Studio (sidebar, topbar), tim + tao link duoc, link tu copy, bang Recent access hien 20 lan tao link moi nhat (nguoi tao, merchant, trang thai). Buoc 2 **THEN** chuyen sang `/studio/merchant-access`. **GIVEN** viewer **THEN** chuyen ve `/studio`. **GIVEN** `support` **THEN** trang support doc lap van chay, khong vao duoc `/studio`. | P1 |
| **[Studio] Team seats (`studio-content`, `studio-reviewer`, `studio-qa`, `studio-ops`); TC-F15.46–53 thay ID 38–45 trùng của #2470** ||||||
| **TC-F15.46** | `Sec` | Role helpers: team seat vao Studio, la nhan su noi bo | **1.** Gan tung role cho user.<br>**2.** Kiem tra quyen. | **GIVEN** user co team seat **WHEN** mo Studio **THEN** vao duoc, khong phai read-only; link support khong mo duoc tai khoan nay. | Blocker | [x] |
| **TC-F15.47** | `Sec` | Bang quyen dung ma tran | **1.** Kiem tra quyen cua tung seat theo ma tran. | **GIVEN** tung seat **THEN** chi co dung cac quyen da chot, super-admin co tat ca. | Blocker | [x] |
| **TC-F15.48** | `Sec` | Content khong publish, khong sua template live | **1.** Content sua draft, gui duyet.<br>**2.** Thu publish, thu sua template live. | **GIVEN** content **WHEN** draft->review **THEN** duoc; **WHEN** ->live/scheduled hoac sua template live **THEN** 403. Reviewer publish va go ve draft duoc. | Blocker | [x] |
| **TC-F15.49** | `Sec` | Dev khong tu dong loi | **1.** Ops chuyen issue sang dev_fixed.<br>**2.** Thu chuyen done/reopen. | **GIVEN** ops **WHEN** dev_fixed **THEN** duoc; **WHEN** done/reopen **THEN** 403. QA va Reviewer dong duoc. | Blocker | [x] |
| **TC-F15.50** | `Sec` | API chan theo quyen | **1.** Goi route ghi bang seat khong co quyen. | **GIVEN** seat thieu quyen **WHEN** goi **THEN** 403 truoc handler; seat dung quyen thi qua. | Blocker | [x] |
| **TC-F15.51** | `Sec` | Route nhieu hanh dong kiem tung hanh dong | **1.** Content tao template kem status live.<br>**2.** Bulk publish.<br>**3.** migration-diff tung action. | **THEN** tao moi luon la draft; bulk publish 403; moi action migration theo dung quyen, action la chi super-admin. | Blocker | [x] |
| **TC-F15.52** | `Sec` | Moi route ghi deu co guard; AI settings chi super-admin | **1.** Quet route ghi.<br>**2.** Team seat mo `/studio/settings`. | **THEN** khong route ghi nao thieu guard; team seat bi dua ve `/studio`. | Blocker | [x] |
| **TC-F15.53** | `Sec` | Tao issue va tu choi template | **1.** Ops tao issue kem status done/reopen.<br>**2.** Reviewer tu choi template kem issue. | **THEN** Ops bi 403, nguoi bao la chinh seat; issue vao backlog, template ve draft; issue loi thi template van o review. | Blocker | [x] |

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
| **8. Studio read-only seat** | [ ] Da chay 0/4 TC | TC-F15.27–30: viewer doc duoc, ghi 403, AI settings bi chan. |
| **9. Studio team seats** | [ ] Da chay 0/8 TC | TC-F15.46–53: moi team chi thao tac dung phan cua minh, khong tu duyet, khong tu dong loi. |

> **Luu y Release:** RBAC va 2FA la Blocker — khong duoc release neu chua PASS het. Impersonation phai dam bao 100% read-only, khong co exception.

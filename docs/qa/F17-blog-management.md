# Tai Lieu Kiem Thu: F17 - Quan Ly Bai Viet (Blog Management)
> **Phien ban:** 10.0 (Comprehensive) | **Cap nhat:** 2026-04-06 | **Thuc hien:** QA Team
> **Nguon:** PRD F17 v1.0, User Stories US-F17-01 -> US-F17-08 (11 FRs, 3 BRs, 11 ACs)
> **Ky thuat:** BVA, State Transition, Error Guessing (XSS/Slug/AI), Concurrency, UI/UX States (10-Point)

---

## 1. Muc Tieu Kiem Thu

Vet can toan bo AC cua F17 theo 5 ky thuat Comprehensive QA: Bao mat (RBAC, XSS Storefront, AI Rate Limit), State Machine (Draft/Published/Deleted), Slug Unique + Sanitize, Category Orphan Fallback, Auto-save / Network Drop, Race Condition (multi-tab), va SEO Metadata Server Render. Moi AC Happy Path co it nhat 2-3 case Negative/Edge.

---

## 2. Moi Truong Kiem Thu

| Thong so | Yeu cau |
|---|---|
| Moi truong | Staging / Pre-Production |
| Trinh duyet | Chrome v110+, Firefox v105+, Safari Mobile |
| Thiet bi | Desktop > 1024px, Mobile 375px (iPhone), 320px |
| Test Data | Hinh thumbnail 10MB, File sai dinh dang (.gif, .exe), Chuoi XSS, Bai viet > 50,000 ky tu |
| RBAC | Store Owner (blog:manage), Staff (bac bi quyen), Guest chua dang nhap |

---

## 3. Ma Tran Test Case Theo User Story

### US-F17-01: Blog Management Dashboard — Danh Sach & Quan Ly

#### Nhom 1A — Hien Thi & UI States

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-01-01** | `[Positive]` | Empty State khi chua co bai viet nao | 1. Dang nhap CMS voi DB rong (0 bai viet).<br>2. Vao trang Blog Management. | - Hien thi component Empty State ("Chua co bai viet nao").<br>- Co nut "Tao Bai Viet Dau Tien" ro rang de dieu huong. | High | [ ] |
| **TC-F17-01-02** | `[Positive]` | Layout 2 cot CMS khong bi pha vo | 1. Truy cap trang Blog Management. | - Noi dung render dung ben trong Main Content Area.<br>- Sidebar va Header (F18) van kien dinh, khong re-render toan trang. | Blocker | [ ] |
| **TC-F17-01-03** | `[UI State]` | Loading Skeleton khi blog list dang fetch | 1. Lam cham mang (Slow 3G).<br>2. Reload trang Blog Management. | - Skeleton rows hien thi thay vi trang trang.<br>- Khong flash hoac NULL error. | Medium | [ ] |
| **TC-F17-01-04** | `[Positive]` | Danh sach hien du 4 cot: Title, Status, Author, Date | 1. Co san vai bai viet.<br>2. Xem trang Blog List. | - 4 cot hien day du: Title, Status (Draft/Published), Author, Last Modified Date.<br>- Sap xep chinh xac theo ngay. | High | [ ] |
| **TC-F17-01-05** | `[Mobile]` | Table chuyen sang Card Stack tren 375px | 1. Mo trang Blog Management tren man 375px. | - Table an, thay bang Card doc (Title, Status, Date).<br>- Khong co thanh cuon ngang. | Blocker | [ ] |
| **TC-F17-01-19** | `[State]` | Empty State "Create First Post" button dieu huong dung | 1. DB rong, vao Blog Management.<br>2. Nhan nut "Tao Bai Viet Dau Tien". | - Dieu huong den trang tao bai viet moi.<br>- Khong bi dead link hoac 404. | High | [ ] |
| **TC-F17-01-20** | `[UI State]` | Empty State dung chung component voi F08/F10 | 1. So sanh Empty State cua Blog voi Products (F08) va Orders (F10). | - Cung layout, cung illustration pattern, cung CTA style.<br>- Dung shared component `EmptyState` / `NoData`. | High | [ ] |
| **TC-F17-01-21** | `[Scale]` | CMS Blog List pagination khi co 100+ bai viet | 1. Co 100+ bai viet trong DB.<br>2. Vao trang Blog Management. | - Chi load trang dau (20 bai).<br>- Co pagination hoac infinite scroll.<br>- Khong load tat ca 1 luc. | High | [ ] |

#### Nhom 1B — Tim Kiem, Loc, Sap Xep

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-01-06** | `[Positive]` | Tim kiem bai viet theo Title (mot phan) | 1. Nhap "Tin Raya" vao o Search. | - Danh sach loc ra cac bai chua "Tin Raya" trong tieu de.<br>- Ket qua nhanh, khong lag. | High | [ ] |
| **TC-F17-01-07** | `[Positive]` | Multi-filter: Status + Category (AND logic) | 1. Chon filter "Draft" + Category "Promotions". | - Chi hien bai o trang thai Draft VA thuoc Category Promotions.<br>- AND logic chinh xac. | High | [ ] |
| **TC-F17-01-08** | `[Positive]` | Sort theo ngay moi nhat truoc | 1. Nhan sort "Newest First". | - Bai co Last Modified Date moi nhat len dau.<br>- Sort dung theo timestamp, khong so sanh chuoi. | Medium | [ ] |
| **TC-F17-01-09** | `[UI State]` | Filter khong co ket qua — Empty State | 1. Dang co bai, nhung loc theo ngay hom qua khong co bai nao. | - Hien thong bao "Khong tim thay bai viet nao".<br>- Co nut Reset Filter ro rang. | Medium | [ ] |
| **TC-F17-01-10** | `[Security]` | Chan XSS trong o tim kiem blog | 1. Nhap `<script>alert(1)</script>` vao o Search. | - Text duoc sanitize, JS khong thuc thi.<br>- Hien ket qua hop le hoac empty state. | Blocker | [ ] |
| **TC-F17-01-11** | `[BVA]` | Tim kiem voi o trong / chi khoang trang | 1. Nhap toan bo khoang trang vao o Search. | - Hien thi toan bo danh sach (khong filter).<br>- Khong goi API voi query rong. | Medium | [ ] |
| **TC-F17-01-16** | `[Positive]` | Sort theo Title A-Z / Z-A | 1. Nhan sort "Title A-Z". | - Bai sap xep theo ten A→Z, Unicode-aware.<br>- Doi sang Z-A thi dao nguoc. | High | [ ] |
| **TC-F17-01-22** | `[Positive]` | Filter + Sort ket hop (Draft + Newest) | 1. Chon filter "Draft".<br>2. Chon sort "Newest First". | - Chi hien bai Draft, sap xep theo ngay moi nhat.<br>- Ca 2 dieu kien ap dung dong thoi. | Medium | [ ] |

#### Nhom 1C — Bulk Actions

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-01-12** | `[Positive]` | Bulk Delete 3 bai viet — Hien canh bao truoc | 1. Chon checkbox 3 bai.<br>2. Nhan "Xoa hang loat". | - Modal xac nhan hien: "Ban co chac muon xoa 3 bai viet?".<br>- Sau xac nhan, 3 bai bi xoa, toast thanh cong. | Blocker | [ ] |
| **TC-F17-01-13** | `[Negative]` | Huy Modal Bulk Delete | 1. Chon 3 bai, nhan Xoa hang loat.<br>2. Nhan "Huy" trong Modal. | - Modal dong lai.<br>- 3 bai viet **khong bi xoa**. | Medium | [ ] |
| **TC-F17-01-14** | `[Perf]` | Bulk Delete 5,000 bai viet — Khong gay OOM | 1. Chon 5,000 bai ao.<br>2. Thuc thi Bulk Delete. | - Backend dung Job Queue / UpdateMany.<br>- Khong OOM Node.js, khong N+1 Query. | High | [ ] |
| **TC-F17-01-15** | `[Negative]` | Bulk Action khi khong chon bai nao | 1. Khong check bai nao.<br>2. Tim nut Bulk Action. | - Nut Bulk Action bi disable.<br>- Khong cho phep submit rong. | Medium | [ ] |
| **TC-F17-01-17** | `[Positive]` | Bulk Publish nhieu bai Draft cung luc | 1. Chon checkbox 3 bai Draft.<br>2. Nhan "Publish hang loat". | - Modal xac nhan: "Publish 3 bai viet?".<br>- Sau xac nhan, 3 bai chuyen Published, toast thanh cong.<br>- Storefront hien 3 bai moi. | Critical | [ ] |
| **TC-F17-01-18** | `[Edge]` | Bulk Publish khi mot so bai da Published san | 1. Chon 3 bai: 2 Draft + 1 Published.<br>2. Nhan "Publish hang loat". | - Chi 2 bai Draft chuyen sang Published.<br>- Bai da Published giu nguyen, toast bao dung so luong. | Medium | [ ] |

---

### US-F17-02: Tao & Chinh Sua Bai Viet

#### Nhom 2A — Form Editor Co Ban

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-02-01** | `[Positive]` | Tao moi bai viet thanh cong (E2E) | 1. Nhan "Tao Bai Viet".<br>2. Dien Title, noi dung, chon Category, upload thumbnail hop le.<br>3. Nhan Save. | - Toast thanh cong mau xanh.<br>- Bai moi xuat hien trong danh sach. | Blocker | [ ] |
| **TC-F17-02-02** | `[Negative]` | Validation: Title de trong / chi khoang trang | 1. Bo trong o Title hoac chi go dau cach.<br>2. Nhan Save. | - Vien do "Title is required" hien tren o Title.<br>- Bai khong duoc luu, API khong bi goi. | Blocker | [ ] |
| **TC-F17-02-03** | `[BVA]` | Title vuot 255 ky tu | 1. Nhap chuoi Title dai 300 ky tu.<br>2. Nhan Save. | - Validation bao loi hoac cat tai 255 ky tu.<br>- Khong luu chuoi vuot gioi han vao DB. | High | [ ] |
| **TC-F17-02-04** | `[Edge]` | Title co ky tu dac biet Unicode (Raya, Emoji) | 1. Nhap Title: "Promosi Raya Merdeka 2026".<br>2. Nhan Save. | - Bai duoc luu thanh cong.<br>- Slug duoc tao bang cach slugify dung (VD: `promosi-raya-merdeka-2026`). | High | [ ] |
| **TC-F17-02-05** | `[Positive]` | Word Counter them ky tu theo thoi gian thuc | 1. Nhan phim lien tuc vao o Meta Title. | - Dem ky tu cap nhat tuc thi (VD: `15/60 characters`).<br>- Khong bi do tre UI, khong lag. | High | [ ] |

#### Nhom 2B — URL Slug

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-02-06** | `[Positive]` | Slug tu dong tao tu Title | 1. Nhap Title: "Tin Khas Hari Raya".<br>2. Quan sat o Slug. | - Slug tu dong dien: `tin-khas-hari-raya` (lowercase, dau cach doi thanh `-`).<br>- User co the sua tay. | High | [ ] |
| **TC-F17-02-07** | `[Negative]` | Slug tu dong xu ly ky tu dac biet | 1. Nhap Title: "Promo! @100% Off #Special".<br>2. Quan sat Slug. | - Slug bo het ky tu dac biet: `promo-100-off-special`.<br>- Chi giu chu va dau `-`. | High | [ ] |
| **TC-F17-02-08** | `[Negative]` | Slug trung nhau (BR-02): Them hau to ID | 1. Da co bai "tin-khas".<br>2. Tao bai moi cung Title "Tin Khas". | - He thong tu dong tao slug: `tin-khas-1` de tranh trung.<br>- Khong cho phep 2 bai cung slug trong 1 store. | Blocker | [ ] |
| **TC-F17-02-09** | `[Negative]` | Nhap thu cong slug co ky tu cam | 1. Nhap slug: `tin-khas-!@#`.<br>2. Nhan Save. | - Validation bao loi: "Slug chi duoc chua chu, so va dau -".<br>- API tu choi luu. | High | [ ] |

#### Nhom 2C — Thumbnail Upload

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-02-10** | `[Positive]` | Upload thumbnail hop le (JPG < 10MB) | 1. Upload file JPG 2MB. | - Anh preview hien thi.<br>- Luu thanh cong. | High | [ ] |
| **TC-F17-02-11** | `[Negative]` | Chan upload file vuot 10MB | 1. Upload file JPG 15MB. | - Bao loi: "File vuot gioi han 10MB".<br>- Server tra HTTP 413, khong luu file. | Blocker | [ ] |
| **TC-F17-02-12** | `[Negative]` | Chan upload file sai dinh dang (.gif, .exe) | 1. Upload file .gif hoac .exe. | - Bao loi: "Chi chap nhan JPEG hoac PNG".<br>- Khong luu file len server. | Blocker | [ ] |
| **TC-F17-02-13** | `[Negative]` | Gia mao file (Magic Byte) — exe doi ten thanh jpg | 1. Doi ten `.exe` thanh `.jpg`.<br>2. Upload. | - Server phat hien Magic Bytes khong phai JPEG.<br>- HTTP 400, khong luu file doc hai. | Blocker | [ ] |

#### Nhom 2D — SEO Metadata AI

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-02-14** | `[Positive]` | AI tu dong tao Meta Title & Description | 1. Co noi dung Body phong phu.<br>2. Nhan "Toi uu SEO bang AI". | - Meta Title duoc dien tu dong (tom tat tu content).<br>- Meta Description duoc dien tu dong. | High | [ ] |
| **TC-F17-02-15** | `[BVA]` | AI cat Meta Title <= 60 ky tu | 1. Nhan AI SEO voi content 50,000 ky tu. | - Meta Title tra ve duoc cat dung <= 60 ky tu.<br>- Khong co chuoi dai hon tran vao field. | Blocker | [ ] |
| **TC-F17-02-16** | `[BVA]` | AI cat Meta Description <= 160 ky tu | 1. Nhan AI SEO voi content bat ky. | - Meta Description tra ve <= 160 ky tu.<br>- Chuan SERP Google Snippet. | Blocker | [ ] |
| **TC-F17-02-17** | `[Network Drop]` | Mat mang khi dang Save bai viet | 1. Dien noi dung dam.<br>2. Nhan Save, roi ngat mang ngay. | - Toast do: "Luu that bai, vui long thu lai".<br>- Noi dung **khong mat** (Local Storage cache giu lai). | High | [ ] |
| **TC-F17-02-18** | `[Concurrency]` | Double-click nut Save — Khong tao 2 ban ghi trung | 1. Double-click "Save" trong < 0.2 giay. | - Nut Disabled sau lan click dau.<br>- Chi 1 POST/PUT request duoc gui. | Blocker | [ ] |

---

### US-F17-03: Tro Ly AI Viet Blog (Text Only)

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-03-01** | `[Positive]` | AI sinh noi dung tu Prompt (Generate) | 1. Nhan "Generate with AI".<br>2. Nhap chu de: "Cach chon quan ao cho mua Raya".<br>3. Nhan Submit. | - AI tra ve doan van co cau truc (paragraphs, lists).<br>- Noi dung duoc bom vao vi tri cursor hien tai trong editor. | High | [ ] |
| **TC-F17-03-02** | `[Negative]` | AI tu choi tao hinh anh (BR-03) | 1. Nhan "Generate with AI".<br>2. Nhap: "Tao hinh chup man hinh cho web cua toi". | - AI hien thong bao: "Chi ho tro viet van ban, vui long upload hinh thu cong".<br>- Khong co hinh nao duoc tao. | Blocker | [ ] |
| **TC-F17-03-03** | `[Positive]` | AI cai thien van ban duoc chon (Rewrite/Make Professional) | 1. Boi den 1 doan van lung tung.<br>2. Chon "Make Professional" tu menu ngu canh AI. | - Doan duoc thay the bang van chuyen nghiep hon.<br>- Khong pha vo cau truc HTML cua Editor (khong tron tag). | High | [ ] |
| **TC-F17-03-04** | `[Negative]` | Rate Limit: Spam nut AI 15 lan nhanh (HTTP 429) | 1. Nhan nut Generate lien tuc 15 lan trong vai giay. | - He thong khoa nut AI sau canh bao.<br>- Toast do: "Vuot gioi han, vui long cho vai giay".<br>- HTTP 429 tu API gateway. | Blocker | [ ] |
| **TC-F17-03-05** | `[Security]` | Chan XSS trong AI Prompt | 1. Nhap Prompt: `<script>alert("XSS")</script>`.<br>2. Nhan Generate. | - Chuoi duoc sanitize truoc khi gui len API AI.<br>- Khong thuc thi JS.<br>- AI phan hoi binh thuong voi chuoi literal. | Blocker | [ ] |
| **TC-F17-03-06** | `[Positive]` | Nut AI bi khoa (Loading) khi dang cho phan hoi | 1. Nhan nut Generate.<br>2. Quan sat nut trong luc cho. | - Nut chuyen sang "Loading..." va bi Disabled hoan toan.<br>- Khong double-submit duoc. | High | [ ] |
| **TC-F17-03-07** | `[Mobile]` | AI Modal mo dang Full-Screen Drawer tren Mobile | 1. Mo trang editor tren Mobile 375px.<br>2. Nhan "Generate with AI". | - Modal mo dang Bottom Drawer toan man hinh.<br>- Nut Generate, Insert, Regenerate Full-width, de tap. | Blocker | [ ] |

---

### US-F17-04: Publish, Draft & Xoa Bai Viet

#### Nhom 4A — State Machine Publish/Draft

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-04-01** | `[Positive]` | Doi Draft -> Published: Hien tren Storefront | 1. Mo bai o Draft.<br>2. Doi Status -> "Published".<br>3. Luu. | - Toast "Bai da duoc dang".<br>- Bai hien tren Storefront `/blogs` trong < 30 giay (Cache invalidate). | Blocker | [ ] |
| **TC-F17-04-02** | `[Positive]` | Unpublish: Doi Published -> Draft, an khoi Storefront | 1. Mo bai dang Published.<br>2. Doi Status -> "Draft".<br>3. Luu. | - Bai khong con tren Storefront.<br>- Truy cap URL cu tra ve 404 ngay lap tuc.<br>- Bai van co the chinh sua trong CMS. | Blocker | [ ] |
| **TC-F17-04-03** | `[Security]` | Draft khong lo ra Storefront | 1. Bai o trang thai "Draft".<br>2. Truy cap truc tiep URL `/blogs/{slug}` tren Storefront. | - Storefront tra ve HTTP 404.<br>- Khong hien noi dung nao cua bai Draft. | Blocker | [ ] |
| **TC-F17-04-04** | `[State]` | Unpublish -> Rei-Publish: URL hoat dong lai | 1. Unpublish bai viet.<br>2. Published lai cung bai do. | - URL `/blogs/{slug}` hoat dong lai binh thuong.<br>- Noi dung hien dung. | High | [ ] |

#### Nhom 4B — Xoa Bai Viet (Hard Delete)

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-04-05** | `[Positive]` | Xoa bai viet — Hien Modal xac nhan truoc | 1. Nhan icon Xoa bai bat ky. | - Modal xac nhan hien: "Ban co chac muon xoa bai viet nay? Hanh dong nay khong the hoan tac."<br>- Co 2 nut: Xac nhan + Huy. | High | [ ] |
| **TC-F17-04-06** | `[Positive]` | Xac nhan Xoa: Bai bi xoa vinh vien | 1. Nhan Xoa, nhan Xac nhan trong Modal. | - Bai bi xoa khoi DB.<br>- Toast thanh cong.<br>- Bai khong con trong danh sach. | Blocker | [ ] |
| **TC-F17-04-07** | `[Negative]` | Huy Modal Xoa — Bai khong bi xoa | 1. Nhan Xoa.<br>2. Modal hien ra, nhan "Huy". | - Modal dong lai.<br>- Bai viet **khong bi xoa**. | Medium | [ ] |
| **TC-F17-04-08** | `[Concurrency]` | Race Condition: User A Save, User B Xoa cung bai | 1. User A dang chinh sua bai.<br>2. User B (tab khac / device khac) xoa bai do cung luc. | - User A nhan Save nhan duoc loi "Bai viet khong con ton tai".<br>- Khong crash trang trang. | Blocker | [ ] |

---

### US-F17-05: Quan Ly Danh Muc (Category)

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-05-01** | `[Positive]` | Tao moi Category thanh cong | 1. Mo trang Category Management.<br>2. Nhap ten "Promosi".<br>3. Luu. | - Category "Promosi" luu thanh cong.<br>- Hien tren dropdown chon category khi tao bai. | High | [ ] |
| **TC-F17-05-02** | `[Negative]` | Chong Category ten trung nhau | 1. Da co Category "Berita".<br>2. Tao them Category ten "Berita" lan 2. | - Bao loi HTTP 400 "Ten danh muc da ton tai".<br>- Khong tao duplicate. | Blocker | [ ] |
| **TC-F17-05-03** | `[Negative]` | Category ten rong bj chon | 1. Nhap khoang trang vao ten Category.<br>2. Nhan Luu. | - Validation bao "Ten danh muc khong duoc de trong".<br>- Khong luu. | High | [ ] |
| **TC-F17-05-04** | `[BVA]` | Ten Category vuot Max Length | 1. Nhap ten Category dai 200 ky tu. | - Validation cat hoac bao loi do dai.<br>- Khong luu chuoi vuot gioi han. | Medium | [ ] |
| **TC-F17-05-05** | `[Positive]` | Sua ten Category — Hien thi cap nhat tren Dropdown | 1. Sua "Promosi" thanh "Promosi Terkini".<br>2. Luu. | - Dropdown chon Category trong Editor hien "Promosi Terkini".<br>- Cac bai da gan Category cu tu dong cap nhat. | High | [ ] |
| **TC-F17-05-06** | `[Edge]` | Xoa Category: Bai viet chuyen ve "Uncategorized" | 1. Delete Category "Berita" dang co 5 bai gan vao.<br>2. Xem 5 bai do. | - 5 bai chuyen ve "Uncategorized" (khong bi mat).<br>- Storefront hien "Uncategorized" hoac "Khong co danh muc". | Blocker | [ ] |
| **TC-F17-05-07** | `[Negative]` | Huy Modal Xoa Category | 1. Nhan Xoa Category, Modal hien.<br>2. Nhan "Huy". | - Category khong bi xoa.<br>- Cac bai gan vao giu nguyen. | Medium | [ ] |
| **TC-F17-05-08** | `[Positive]` | Gan Category cho bai viet | 1. Mo bai viet.<br>2. Chon Category "Tips" tu dropdown.<br>3. Luu. | - Bai luu thanh cong voi Category "Tips".<br>- Storefront hien nhan "Tips" danh muc tren the bai. | High | [ ] |

---

### US-F17-06: Mobile Web UX — Blog Editor Tren Dien Thoai

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-06-01** | `[Positive]` | Rich Text Toolbar Sticky phia tren ban phim ao | 1. Mo Blog Editor tren Mobile 375px.<br>2. Nhan vao vung editor (ban phim ao hien). | - Thanh cong cu (B, I, U, Link) "Sticky" nam sat phia tren ban phim ao.<br>- Khong bi che khuat khi ban phim mo. | Blocker | [ ] |
| **TC-F17-06-02** | `[Positive]` | Nut tap tay vu >= 44px (Touch Target) | 1. Xem trang Editor tren Mobile.<br>2. Kiem tra kich thuoc cac nut AI, Save, Format. | - Tat ca nut co chieu cao va rong >= 44px (WCAG Touch Target).<br>- De tap bang ngon cai. | Blocker | [ ] |
| **TC-F17-06-03** | `[Mobile]` | Editor khong cuon ngang tren 320px | 1. Mo Editor tren man 320px. | - Khong co thanh cuon ngang.<br>- Noi dung stack doc. | High | [ ] |

---

### US-F17-07: Storefront Blog List (Khach Xem)

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-07-01** | `[Positive]` | Chi hien bai Published tren Storefront | 1. Co 3 bai Published + 2 bai Draft.<br>2. Khach vao `/blogs`. | - Chi hien 3 bai Published (Zero Draft Leak).<br>- Moi the: Thumbnail, Category, Title, Excerpt, Publish Date. | Blocker | [ ] |
| **TC-F17-07-02** | `[UI State]` | Empty State khi chua co bai Published | 1. Tat ca bai o trang thai Draft.<br>2. Khach vao `/blogs`. | - Hien thong bao than thien "Chua co bai viet nao".<br>- Khong hien danh sach rong / table trang. | Medium | [ ] |
| **TC-F17-07-03** | `[Positive]` | Pagination: > 12 bai -> hien Load More / phan trang | 1. Co 20 bai Published.<br>2. Khach vao `/blogs`. | - Chi hien 12 bai dau.<br>- Co nut "Load More" hoac phan trang.<br>- Nhan Load More -> hien them 12 bai tiep. | High | [ ] |
| **TC-F17-07-04** | `[Positive]` | Loc bai theo Category tren Storefront | 1. Nhan vao nhan Category "Promotions" tren Storefront. | - Danh sach chi hien bai thuoc "Promotions".<br>- SPA route, khong reload toan trang. | High | [ ] |
| **TC-F17-07-05** | `[Mobile]` | Storefront Blog List 1 cot tren < 768px | 1. Xem `/blogs` tren man 375px. | - Grid chuyen sang 1 cot dung.<br>- Khong cuon ngang. | High | [ ] |
| **TC-F17-07-06** | `[Perf]` | Tim kiem Storefront co Debounce (khong spam API) | 1. Go nhanh vao o search Storefront. | - API chi goi sau khi ngung go ~300ms.<br>- Khong spam request. | Medium | [ ] |

---

### US-F17-08: Storefront Blog Detail (Doc Bai)

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-08-01** | `[Positive]` | Hien thi day du noi dung bai viet chi tiet | 1. Nhan vao bai tren Storefront. | - Hien: Thumbnail, Title, Publish Date, Category, Rich Text Content.<br>- Dinh dang HTML dung: headings, links, bold/italic. | Blocker | [ ] |
| **TC-F17-08-02** | `[Positive]` | SEO Metadata render dung tren Server (SSR) | 1. Mo DevTools > Elements.<br>2. Kiem tra `<head>` cua trang bai viet. | - `<title>` dung Meta Title cua nguoi ban.<br>- `<meta name="description">` dung Meta Description.<br>- JSON-LD Article Schema co trong `<head>`. | Blocker | [ ] |
| **TC-F17-08-03** | `[Positive]` | OpenGraph Tag cho chia se mang xa hoi | 1. Kiem tra `<head>` trang chi tiet bai. | - `og:title`, `og:description`, `og:image` deu hien dung.<br>- Chia se len Facebook/Zalo hien dung card preview. | High | [ ] |
| **TC-F17-08-04** | `[Positive]` | Nut Back to Blogs / Breadcrumb | 1. Dang xem bai chi tiet.<br>2. Quan sat dau trang hoac cuoi trang. | - Co nut "Quay lai Blogs" hoac Breadcrumb ro rang.<br>- Nhan -> quay ve danh sach blogs. | High | [ ] |
| **TC-F17-08-05** | `[UX]` | Giu vi tri scroll khi nhan Back (SPA) | 1. Cuon xuong giua danh sach `/blogs`.<br>2. Mo mot bai, roi nhan "Back to Blogs". | - Danh sach quay ve vi tri scroll cu (giu nguyen vi tri).<br>- Khong reload toan trang. | High | [ ] |
| **TC-F17-08-06** | `[Security]` | Chan XSS trong noi dung bai viet tren Storefront | 1. Bai viet chua XSS trong content: `<img src=x onerror="alert(1)"/>`.<br>2. Khach xem bai. | - HTML duoc sanitize truoc khi render.<br>- Khong thuc thi JS, khong capture cookie. | Blocker | [ ] |
| **TC-F17-08-07** | `[Mobile]` | Bai viet doc duoc tren Mobile 375px | 1. Doc bai chi tiet tren man 375px. | - Font size >= 16px, line-height hop ly.<br>- Khong co thanh cuon ngang do anh nhu lai. | High | [ ] |
| **TC-F17-08-08** | `[Edge]` | Anh trong bai viet bi Broken (Src 404) | 1. URL anh trong noi dung tro ve 404.<br>2. Khach xem bai. | - Hien Alt Text hoac Fallback placeholder.<br>- Van doc duoc phan noi dung xung quanh. | High | [ ] |

---

### RBAC & Bao Mat He Thong (BR-01)

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F17-09-01** | `[Security]` | Khong dang nhap: Redirect /login khi vao Blog CMS | 1. Mo trinh duyet an danh.<br>2. Truy cap truc tiep `/cms/blog`. | - He thong redirect ve `/login`.<br>- Khong hien bat ky noi dung CMS nao. | Blocker | [ ] |
| **TC-F17-09-02** | `[Security]` | Staff khong co quyen `blog:manage` bi tu choi | 1. Dang nhap bang Staff account khong co quyen Blog.<br>2. Truy cap `/cms/blog`. | - Hien loi 403 Forbidden hoac redirect ve Dashboard.<br>- Khong hien danh sach bai viet. | Blocker | [ ] |
| **TC-F17-09-03** | `[Security]` | IDOR: Khong the xem/sua bai cua Store khac | 1. Dung token cua Store A.<br>2. Goi `GET /api/blogs/{id_cua_Store_B}`. | - HTTP 403 Forbidden.<br>- Khong hien noi dung bai cua Store B. | Blocker | [ ] |
| **TC-F17-09-04** | `[Security]` | Chan XSS tren Title khi hien o Storefront | 1. Tao bai voi Title: `<script>document.cookie</script>`.<br>2. Hien thi tren Storefront. | - Title duoc escape, JS khong chay.<br>- DOM hien text literal an toan. | Blocker | [ ] |

---

## 4. Bien Ban Kiem Dinh — 10-Point Checklist (Sign-Off)

| # | Tieu Chi | Trang Thai |
|:---:|:---|:---:|
| 1 | **RBAC / Auth Guard:** CMS `/blog` yeu cau `blog:manage`, Guest redirect `/login`, Staff bi tu choi 403. | [ ] |
| 2 | **IDOR 403:** Token Store A khong the GET/PUT/DELETE bai cua Store B. | [ ] |
| 3 | **XSS SSR Santize:** Noi dung bai viet va Title duoc escape truoc khi render HTML tren Storefront. | [ ] |
| 4 | **XSS AI Prompt:** Chuoi `<script>` trong Prompt duoc sanitize truoc khi gui OpenAI API. | [ ] |
| 5 | **Draft Leak Prevention:** Bai o Draft tra 404 tren Storefront, khong lo noi dung. | [ ] |
| 6 | **Slug Unique + Sanitize:** Slug trung -> tu them hau to (`-1`), ky tu cam bi loc truoc khi luu. | [ ] |
| 7 | **Category Orphan Fallback:** Xoa Category -> bai chuyen ve Uncategorized (khong mat bai). | [ ] |
| 8 | **AI Rate Limit (HTTP 429):** Spam AI > 15 lan bi chan, nut bi khoa, toast thong bao. | [ ] |
| 9 | **Magic Byte File Validation:** Upload `.exe` doi ten `.jpg` bi phat hien va tu choi. | [ ] |
| 10 | **SEO SSR:** `<title>`, `<meta description>`, `og:*`, `JSON-LD Article Schema` render dung tu server. | [ ] |

---

## 5. Quality Gates

| Nhom | Trang Thai | Ghi Chu |
|---|---|---|
| **1. Bao Mat & RBAC** | [ ] Not Run | Auth Guard, IDOR 403, XSS Content/Title/AI Prompt, Draft Leak, Magic Byte |
| **2. State Machine** | [ ] Not Run | Draft/Published/Unpublish->404, Delete Permanent, Re-Publish |
| **3. Form & Validation** | [ ] Not Run | Title required, Slug unique+sanitize, Thumbnail 10MB, BVA max length |
| **4. AI & Concurrency** | [ ] Not Run | Rate Limit 429, Double-click Save, Race Condition multi-tab, Auto-save |
| **5. SEO & Storefront** | [ ] Not Run | SSR Meta tags, JSON-LD, Draft Leak 404, Scroll Position Back, Pagination |

> **Khuyen Nghi Release:** Tat ca 10 diem Checklist va 5 Quality Gates phai dat 100% Passed truoc Production. Dac biet P0 Blockers: RBAC/Auth, IDOR, XSS Storefront, Draft Leak, Category Orphan Fallback, Magic Byte.

---
**PHE DUYET BOI:** .................................... **NGAY:** ..../..../2026

# Tai Lieu Kiem Thu: F21 - Localization & Multi-language (BM/EN)
> **Phien ban:** 2.0 (Comprehensive) | **Cap nhat:** 2026-04-06 | **Thuc hien:** QA Team
> **Nguon:** PRD F21, User Stories US-F21-01 -> US-F21-04 (4 US, 8 ACs, 5 BR)
> **Ky thuat:** BVA, State Transition (Priority DB > LocalStorage), Error Guessing, Concurrency, UI/UX States (10-Point)

---

## 1. Muc Tieu Kiem Thu

Vet can toan bo AC cua F21, dac biet: Vi tri chinh xac Switcher (Auth vs CMS vs Mobile), State Machine uu tien DB > LocalStorage khi da dang nhap, Fallback an toan khi thieu key dich, Chu so nhieu (Pluralization), Dinh dang tien te RM, Dinh dang ngay DD/MM/YYYY, va Text Overflow voi chuoi BM dai. Moi AC Happy Path co it nhat 2-3 case Negative/Edge.

---

## 2. Moi Truong Kiem Thu

| Thong so | Yeu cau |
|---|---|
| Moi truong | Staging / Pre-Production |
| Trinh duyet | Chrome v115+, Safari iOS, Firefox |
| Du lieu ngon ngu | File `en.json` va `bm.json` |
| Bo nho Client | `localStorage` key `prefer_lang` |
| Phan quyen | Guest (Unauthenticated), Store Owner (Authenticated) |

---

## 3. Ma Tran Test Case Theo User Story

### US-F21-01: Language Switcher Tren Man Hinh Auth (Login/Register/Forgot)

#### Nhom 1A — Vi Tri & Hien Thi Switcher

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F21-01-01** | `[Positive]` | Switcher hien thi dung vi tri tren man Login | 1. Truy cap `/login` tren Desktop. | - Thanh Switcher (MY / EN) xuat hien ro rang trong Form Card Login, ben duoi nut "Sign In".<br>- Khong nam o goc phai Header. | Blocker | [x] |
| **TC-F21-01-02** | `[Positive]` | Switcher hien thi o man Register | 1. Truy cap `/register`. | - Thanh Switcher xuat hien dung vi tri, co the su dung ngay. | Blocker | [x] |
| **TC-F21-01-03** | `[Positive]` | Switcher hien thi o man Forgot Password | 1. Truy cap `/forgot-password`. | - Thanh Switcher hien thi, cho phep doi ngon ngu. | High | [ ] |
| **TC-F21-01-04** | `[Positive]` | CSS Pixel-Perfect: Switcher khop Figma 1:1 | 1. Dung DevTools so sanh Component `LanguageSwitcher` voi Figma.<br>2. Hover va Click tung tuy chon. | - Border-radius, Padding, Spacing khop Figma.<br>- Active State mau Cyan/Mint.<br>- Hover co Transition chuyen mau muat ma. | High | [x] |
| **TC-F21-01-05** | `[Negative]` | Switcher khong het man hinh Login tren 320px | 1. Chinh viewport xuong 320px.<br>2. Quan sat Switcher. | - Switcher van hien day du, khong bi cat boi man hinh.<br>- Khong cuon ngang. | High | [ ] |

#### Nhom 1B — Hanh Vi Chuyen Doi EN <-> BM tren Auth

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F21-01-06** | `[Positive]` | Chuyen sang BM: Tat ca label doi ngay lap tuc (No-reload) | 1. Tren `/login`, nhan chuyen tu EN sang MY. | - Tat ca Label, Placeholder, nut "Sign In" ngay lap tuc doi sang BM.<br>- Trang KHONG tai lai (No full-page reload).<br>- SPA transition muat ma. | Blocker | [ ] |
| **TC-F21-01-07** | `[Positive]` | Du lieu dang nhap khong mat khi doi ngon ngu | 1. Nhap email `admin@email.com` vao o Email.<br>2. Chuyen tu EN sang MY. | - Email `admin@email.com` van con nguyen trong o nhap lieu.<br>- Khong bi xoa hoac reset form. | High | [ ] |
| **TC-F21-01-08** | `[State]` | Chuyen BM -> EN: Label tro lai tieng Anh | 1. Chuyen sang BM.<br>2. Chuyen lai sang EN. | - Toan bo UI tro ve tieng Anh.<br>- Trang khong bi reload. | Medium | [ ] |
| **TC-F21-01-09** | `[Edge]` | Fallback EN khi thieu key BM tren Auth Screen | 1. Xoa khoa BM cua nut "Sign In" khoi `bm.json`.<br>2. Chuyen sang BM. | - Nut hien text tieng Anh "Sign In" (fallback).<br>- Khong hien raw key kieu `auth.button.signin`. | Blocker | [ ] |
| **TC-F21-01-10** | `[Concurrency]` | Nhan Switcher lien tuc nhanh (Spam toggle) | 1. Nhan qua lai EN/BM 5-10 lan nhanh. | - He thong khong bi crash hoac hien text loan.<br>- Dung trang thai cuoi cung duoc chon. | Medium | [ ] |

---

### US-F21-02: Language Switcher Trong CMS (Sau Dang Nhap)

#### Nhom 2A — Vi Tri Switcher Trong CMS

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F21-02-01** | `[Positive]` | Switcher nam o day Sidebar CMS (tren nut Logout) | 1. Dang nhap CMS thanh cong.<br>2. Quan sat day thanh Sidebar. | - Toggle Switch (MY / EN) hien o cuoi Sidebar, ngay tren nut Logout.<br>- Ro rang, de tap/click. | Blocker | [x] |
| **TC-F21-02-02** | `[Positive]` | Chuyen sang BM: Toan bo UI tinh CMS doi ngay | 1. Trong CMS, nhan Switcher sang BM. | - Sidebar, Header, Table Headers, Nut bam doi sang BM tuc thi.<br>- Khong reload trang. | Blocker | [ ] |
| **TC-F21-02-03** | `[Positive]` | Du lieu dong khong bi dich (Bao toan ten san pham) | 1. Trong man Products co san pham ten "Ao Phong Z1".<br>2. Chuyen sang BM. | - Sidebar va Table Headers hien BM.<br>- Ten san pham "Ao Phong Z1" giu nguyen, khong bi dich sai. | Blocker | [ ] |
| **TC-F21-02-04** | `[Edge]` | Toast/Validation Error cung doi sang BM | 1. CMS dang o BM.<br>2. Nhap Password sai de kich hoat loi Zod. | - Thong bao loi Zod hien bang BM.<br>- Khong lo ngoai le bang tieng Anh chua dich. | Blocker | [ ] |
| **TC-F21-02-05** | `[Edge]` | API Error Toast cung hien bang BM | 1. CMS dang o BM.<br>2. Ngat mang de gay loi endpoint. | - Toast loi hien bang BM.<br>- Khong hien message kieu `Network Error` bang tieng Anh. | High | [ ] |

#### Nhom 2B — Xac Nhan Dong Bo API Khi Doi Ngon Ngu

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F21-02-06** | `[Positive]` | API duoc goi de luu preference vao DB | 1. Dang nhap vao CMS.<br>2. Chuyen sang BM.<br>3. Quan sat Network tab (F12). | - He thong goi `PATCH /api/users/me/preferences` voi body `{lang: 'BM'}`.<br>- Response HTTP 200 OK. | Blocker | [ ] |
| **TC-F21-02-07** | `[Negative]` | API that bai khi luu preference — Hien thong bao loi | 1. Gian lap API loi (500 hoac timeout).<br>2. Chuyen sang BM. | - Toast loi hien ra (da dich sang BM neu can).<br>- He thong khong bi crash, van duy tri trang thai hien tai. | High | [ ] |
| **TC-F21-02-08** | `[Security]` | Khong cho phep user sua preference cua user khac (IDOR) | 1. Dung Postman gui `PATCH /api/users/{khac_id}/preferences`. | - API tra ve HTTP 403 Forbidden.<br>- Khong cho phep thay doi tu xa. | Blocker | [ ] |

---

### US-F21-03: Luu Tru & Dong Bo Trang Thai Ngon Ngu

#### Nhom 3A — Guest Persistence (LocalStorage)

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F21-03-01** | `[Positive]` | Lan dau vao trang: Mac dinh EN | 1. Xoa sach bo nho trinh duyet (Incognito / Clear Site Data).<br>2. Truy cap `/login`. | - He thong hien tieng Anh mac dinh.<br>- Switcher chon `EN`.<br>- Khong load BM khi chua co tuy chon. | Blocker | [x] |
| **TC-F21-03-02** | `[Positive]` | Guest chon BM: Giu qua phien moi (LocalStorage) | 1. Xoa Site Data, vao `/login`.<br>2. Chuyen sang BM.<br>3. Tat tab/trinh duyet.<br>4. Mo lai `/login`. | - Trinh duyet doc `prefer_lang = MY` tu localStorage.<br>- Hien BM mac dinh ma khong can chon lai. | High | [ ] |
| **TC-F21-03-03** | `[Edge]` | LocalStorage bi xoa tay: Tro ve EN | 1. Dat BM qua localStorage.<br>2. Xoa `prefer_lang` khoi localStorage bang DevTools.<br>3. Reload trang. | - Trang tro ve EN mac dinh.<br>- Khong crash, khong hien loi kon. | Medium | [ ] |
| **TC-F21-03-04** | `[Edge]` | LocalStorage co gia tri khong hop le | 1. Set `prefer_lang = "zh"` (ngon ngu khong ho tro).<br>2. Reload trang. | - He thong fallback ve EN.<br>- Khong crash, khong hien loi lan. | High | [ ] |

#### Nhom 3B — Authenticated User Persistence (DB Override)

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F21-03-05** | `[Positive]` | Dang nhap vao: He thong dung ngon ngu tu DB | 1. User A da luu BM trong DB.<br>2. Dang nhap vao CMS tu thiet bi moi. | - Dashboard hien BM ngay sau login (lay tu DB).<br>- Khong dung LocalStorage EN cua thiet bi. | Blocker | [ ] |
| **TC-F21-03-06** | `[State]` | DB ghi de LocalStorage khi dang nhap | 1. Thiet bi co LocalStorage `prefer_lang = EN` (guest).<br>2. Dang nhap User B co DB la `MY`. | - Dashboard hien BM (DB thang).<br>- LocalStorage duoc cap nhat sang `MY`. | Blocker | [ ] |
| **TC-F21-03-07** | `[State]` | Dang xuat: Man Login giu localStorage hien tai | 1. User A (BM) dang xuat.<br>2. Quan sat man Login. | - Man Login van hien BM (localStorage cua thiet bi).<br>- Chua bi reset ve EN. | Blocker | [ ] |
| **TC-F21-03-08** | `[State]` | Dang nhap bang User khac: DB User moi ghi de | 1. Man Login dang o BM (LocalStorage).<br>2. Dang nhap User B co DB la EN. | - Dashboard hien EN (DB User B thang).<br>- Khong bi ket o BM cua phien truoc. | Blocker | [ ] |
| **TC-F21-03-09** | `[Positive]` | Dong bo da thiet bi: Doit tren thiet bi A, thiet bi B cap nhat | 1. User chuyen sang BM tren Desktop (goi API luu DB).<br>2. Dang nhap tren Mobile. | - Mobile hien BM ngay sau login (lay tu DB server). | High | [ ] |

---

### US-F21-04: Mobile Web UX — Dat Switcher Trong Drawer

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F21-04-01** | `[Positive]` | Switcher an khoi Top Header tren Mobile | 1. Dang nhap CMS tren man 375px.<br>2. Quan sat Top Header. | - Switcher khong xuat hien o Top Header (tiet kiem khong gian).<br>- Header gon gang, de tap. | High | [ ] |
| **TC-F21-04-02** | `[Positive]` | Switcher hien trong Hamburger Drawer | 1. Nhan bieu tuong Hamburger (☰) de mo Drawer.<br>2. Tim Switcher. | - Switcher (MY / EN) hien o phan tren cung cua Drawer ro rang.<br>- Khong nam trong Avatar dropdown. | Blocker | [ ] |
| **TC-F21-04-03** | `[Positive]` | Chuyen ngon ngu trong Drawer — UI cap nhat ngay | 1. Mo Drawer.<br>2. Nhan MY.<br>3. Dong Drawer. | - UI CMS cap nhat sang BM ngay lap tuc.<br>- Khong reload trang. | High | [ ] |
| **TC-F21-04-04** | `[Negative]` | Khong bi chua chong UI khi Switcher va Avatar cung hien tren Mobile | 1. Man 375px, mo Drawer va quan sat. | - Switcher va Avatar nam dung vi tri rieng biet.<br>- Khong chong de len nhau, khong tran ngang. | High | [ ] |

---

### Nhom Ky Thuat: Dinh Dang & Bien Gioi (Format Boundaries)

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F21-05-01** | `[Val]` | Tien te luon hien RM (khong doi theo ngon ngu) | 1. Xem tien te tren CMS o ca EN va BM. | - Luon hien `RM 99.00` (RM + so).<br>- Khong bi chuyen sang `$` hay dinh dang khac. | Blocker | [x] |
| **TC-F21-05-02** | `[Val]` | Phan each ngan: Phay, than phan: Cham | 1. Kiem tra truong hien tien `RM 1,200.50`. | - Ngan phan each bang dau phay (1,200).<br>- Thap phan each bang dau cham (.50). | High | [ ] |
| **TC-F21-05-03** | `[Val]` | Dinh dang ngay luon la DD/MM/YYYY | 1. Xem nguon thoi gian (ngay tao don, lich su) o ca EN va BM.<br>2. Thu doi Locale may tinh sang US. | - Luon hien `DD/MM/YYYY` (VD: 31/12/2026).<br>- Khong bi doi sang `MM/DD/YYYY` theo Locale may. | Blocker | [ ] |
| **TC-F21-05-04** | `[BVA]` | Text Overflow: Chuoi BM dai khong pha layout | 1. Them chuoi BM dai hon 50% so voi EN vao `bm.json`.<br>2. Kiem tra Nut bam va Cot Bang. | - Nut tu gian (Flex), khong tran ra ngoai.<br>- Cot bang dung max-width, text truncate dung. | High | [x] |
| **TC-F21-05-05** | `[Positive]` | Pluralization: So it hon vs so nhieu (Tieng Anh) | 1. Kiem tra man hien "1 item" va "5 items" o EN. | - "1 item" khong co "s".<br>- "5 items" co "s" o cuoi. | High | [ ] |
| **TC-F21-05-06** | `[Positive]` | Pluralization: So nhieu tieng Malay (keping) | 1. Chuyen sang BM.<br>2. Kiem tra man hien sl vat pham tuong tu. | - "1 keping" va "5 keping" hien dung cu phap BM.<br>- Khong dung cu phap tieng Anh khi o BM. | High | [ ] |
| **TC-F21-05-07** | `[Edge]` | Safe Fallback khi thieu khoa dich BM | 1. Xoa khoa BM cua muc "Dashboard" khoi `bm.json`.<br>2. Mo CMS o BM. | - Hien text tieng Anh "Dashboard" (fallback).<br>- Khong hien trang trang, khong crash. | Blocker | [ ] |
| **TC-F21-05-08** | `[Negative]` | Khong bao gio hien raw i18n key tren UI | 1. Kiem tra toan bo UI o ca EN va BM. | - Khong ton tai chuoi dang `sidebar.menu.products` hien tren man hinh.<br>- Moi key deu co gia tri hien thi. | High | [ ] |
| **TC-F21-05-09** | `[Security]` | Khong XSS qua gia tri trong file JSON dich | 1. Them gia tri `<script>alert(1)</script>` vao 1 key trong `bm.json`.<br>2. Xem UI o che do BM. | - He thong escape HTML truoc khi render.<br>- Khong thuc thi JS bat ky. | Blocker | [ ] |
| **TC-F21-05-10** | `[Positive]` | Customers: thoi gian tuong doi (Xd/Xmo/Xy ago) dich theo ngon ngu (GH-2280) | 1. Chuyen CMS sang BM.<br>2. Mo Semua Pelanggan, xem cot Pesanan terakhir voi don cu hon 30 ngay.<br>3. Mo chi tiet khach, xem dong "Updated". | - Hien "N hari/bulan/tahun lalu", "N minit/jam lalu".<br>- Khong con chuoi "ago" tieng Anh; EN giu "Nd/Nmo/Ny ago". | Low | [x] |

---

### GH-1701: Approved English and Malay Dev View Copy

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-GH1701-01** | `[Contract]` | EN/MS giu cung recursive path/type structure | 1. Load locale JSON that.<br>2. Flatten object, array va scalar path/type.<br>3. So sanh EN voi MS. | Hai locale co cung key, value type, array length va nested object shape. | Blocker | [x] |
| **TC-GH1701-02** | `[Contract]` | Tat ca 3,386 CSV rows duoc apply hoac co reconciliation decision | 1. Parse source CSV theo RFC-style quoting.<br>2. Resolve tung `key_or_element`.<br>3. Doi chieu output va manifest. | Khong co duplicate, orphan, silently skipped row; moi row duoc apply, hold, map array, hoac classify missing. | Blocker | [x] |
| **TC-GH1701-03** | `[Contract]` | Array giu dung type, item count va nested shape | 1. Lay 33 CSV array paths.<br>2. Doi chieu mapped/pending/preserved groups.<br>3. So sanh EN/MS shape. | 28 string arrays dung explicit mapping; 1 ambiguous array va 4 object arrays giu nguyen structure. | Blocker | [x] |
| **TC-GH1701-04** | `[Contract]` | Placeholder va HTML tags tuong thich giua EN/MS | 1. Lay scalar CSV targets con ton tai.<br>2. Extract placeholder multiset va HTML tag multiset.<br>3. So sanh hai locale. | Khong mat interpolation token, opening/closing HTML contract, hoac khac placeholder giua locale. | Blocker | [x] |
| **TC-GH1701-05** | `[Contract]` | Whitespace, multiline va `{time}` runtime contracts duoc bao toan | 1. Kiem tra payment upload prefix.<br>2. Kiem tra category delete multiline copy.<br>3. Kiem tra email last-edited interpolation. | Upload prefix giu trailing space; locale-specific newline dung; EN/MS deu giu `{time}`. | Blocker | [x] |

Manual visual/content coverage for GH-1701 is tracked in
`docs/qa/GH-1701-approved-copy-handoff.md`.

---

## 4. Bien Ban Kiem Dinh — 10-Point Checklist (Sign-Off)

| # | Tieu Chi | Trang Thai |
|:---:|:---|:---:|
| 1 | **Switcher Vi Tri Chinh Xac:** Auth -> trong Form Card; CMS Desktop -> day Sidebar; CMS Mobile -> Hamburger Drawer. | [ ] |
| 2 | **No-Reload SPA Transition:** Chuyen EN/BM khong reload trang, khong mat du lieu form dang nhap. | [ ] |
| 3 | **State Priority DB > LocalStorage:** Sau khi dang nhap, DB cua user luon ghi de LocalStorage thiet bi. | [ ] |
| 4 | **Fallback An Toan:** Thieu key BM -> hien EN, khong hien raw key, khong trang trang. | [ ] |
| 5 | **Data Tich Cuc Khong Bi Dich:** Ten san pham, ten khach hang giu nguyen khi doi ngon ngu. | [ ] |
| 6 | **RM Currency Format:** Luon hien `RM X,XXX.XX` o moi ngon ngu, moi viewport. | [ ] |
| 7 | **Date Format DD/MM/YYYY:** Khong bi anh huong boi Locale may tinh hay ngon ngu dang chon. | [ ] |
| 8 | **BM Text Overflow:** Chuoi BM dai khong pha layout nut, cot bang, sidebar. | [ ] |
| 9 | **Validation & Toast La i18n:** Error messages Zod va API Toast hien bang ngon ngu hien tai. | [ ] |
| 10 | **XSS Chong JSON Injection:** Gia tri trong file JSON dich duoc escape truoc khi render HTML. | [ ] |

---

## 5. Quality Gates

| Nhom | Trang Thai | Ghi Chu |
|---|---|---|
| **1. Switcher UI & Vi Tri** | [ ] Not Run | Auth Form, CMS Sidebar Bottom, Mobile Drawer, Pixel-Perfect CSS |
| **2. State Machine Priority** | [ ] Not Run | DB > LocalStorage, Cross-device Sync, Logout/Login flow |
| **3. i18n Correctness** | [ ] Not Run | Fallback, Raw Key, Pluralization, No data-translation leak |
| **4. Format Boundaries** | [ ] Not Run | RM currency, DD/MM/YYYY date, BM Text Overflow |
| **5. Security** | [ ] Not Run | IDOR /preferences, XSS JSON injection, Toast/Validation la i18n |

> **Khuyen Nghi Release:** Tat ca 10 diem Checklist va 5 Quality Gates phai dat 100% Passed, dac biet P0 Blockers: DB > LocalStorage State Priority, Fallback an toan, va Switcher vi tri chinh xac theo Figma.

---
**PHE DUYET BOI:** .................................... **NGAY:** ..../..../2026

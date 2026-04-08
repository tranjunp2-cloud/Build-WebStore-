# Tai Lieu Kiem Thu: F20 - Help Center
> **Phien ban:** 2.0 (Comprehensive) | **Cap nhat:** 2026-04-06 | **Thuc hien:** QA Team
> **Nguon:** PRD F20, User Stories US-F20-01 -> US-F20-04 (5 US, 8 ACs)
> **Ky thuat:** BVA, State Transition, Error Guessing (XSS/Auth), Concurrency, UI/UX States (10-Point)

---

## 1. Muc Tieu Kiem Thu

Vet can toan bo AC cua F20, dac biet: Bao mat truy cap (Auth/401), tuong tac Accordion Q&A, Lightbox Mobile Gestures, Lazy Loading/WebP, Hash Anchor Jump, va i18n Fallback. Moi AC Happy Path phai co it nhat 2-3 case Negative/Edge/UI State.

---

## 2. Moi Truong Kiem Thu

| Thong so | Yeu cau |
|---|---|
| Moi truong | Staging / Pre-Production |
| Trinh duyet | Safari iOS (bat buoc cho Touch Gesture), Chrome Android, Chrome Desktop |
| Breakpoints | 320px, 375px, 768px, 1920px |
| Mang | Throttle Slow 3G (Lazy Load tests), TTFB HTML tinh < 1s |
| Phan quyen | Admin/Owner, Staff (co quyen), Unauthenticated Guest |

---

## 3. Ma Tran Test Case Theo User Story

### US-F20-01: Xem 1-Page User Guideline & Dieu Huong

#### Nhom 1A — Hien Thi & Dieu Huong Co Ban

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F20-01-01** | `[Positive]` | Hien thi trang Help Center voi layout 2 cot | 1. Dang nhap CMS hop le.<br>2. Nhan "Help Center" tren Sidebar. | - Layout 2 cot xuat hien (Navigation trai, Content phai).<br>- Muc "1-Page Guideline" duoc highlight mac dinh. | High | [x] |
| **TC-F20-01-02** | `[Security]` | Chan truy cap boi nguoi dung chua dang nhap (401) | 1. Mo trinh duyet an danh.<br>2. Truy cap truc tiep `/cms/help`. | - Tu dong chuyen huong (Redirect) ve `/login`.<br>- Khong preload bat ky noi dung tai lieu mat nao. | Blocker | [x] |
| **TC-F20-01-03** | `[Security]` | Chan XSS qua URL Hash param | 1. Truy cap `/help#<script>alert(1)</script>`. | - Browser escape ky tu dac biet, khong thuc thi JS.<br>- Trang load binh thuong, khong crash. | Blocker | [x] |
| **TC-F20-01-04** | `[UI State]` | Loading Skeleton khi Help Center dang fetch noi dung | 1. Lam cham mang (Slow 3G).<br>2. Dieu huong sang trang Help Center. | - Skeleton placeholder hien thi thay vi trang trang.<br>- Khong flash layout trong qua trinh load. | Medium | [ ] |
| **TC-F20-01-05** | `[Positive]` | Sub-navigation highlight dung muc dang doc | 1. Nhan vao muc "Products" tren nav trai. | - Muc "Products" duoc to dam (Active State) trong sidebar trai.<br>- Content phai hien noi dung Products tuong ung. | Medium | [ ] |
| **TC-F20-01-06** | `[State]` | Highlight nav thay doi khi chuyen muc | 1. Nhan "Orders", roi chuyen sang "AI Editor". | - Highlight chuyen sang muc moi.<br>- Muc cu (Orders) mat highlight. | Low | [ ] |
| **TC-F20-01-07** | `[Positive]` | Chia se link Anchor Hash toi dong nghiep | 1. Nhan muc "Orders" -> sao chep URL hien tai (`/help#orders`).<br>2. Mo link do trong tab moi (co token dang nhap). | - Trang cuon thang xuong dung phan "Orders".<br>- Anchor scroll chinh xac, khong lech. | High | [ ] |

#### Nhom 1B — Mobile Navigation (US-F20-04 AC-2)

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F20-01-08** | `[Positive]` | Sidebar chuyen sang Dropdown tren 375px | 1. Chinh viewport xuong 375px.<br>2. Quan sat nav trai. | - Sidebar an, thay bang Top Dropdown hoac Off-canvas Menu.<br>- Khong che luat vung noi dung chinh. | Critical | [ ] |
| **TC-F20-01-09** | `[Positive]` | Off-canvas menu mo/dong tren Mobile | 1. Nhan bieu tuong Hamburger.<br>2. Chon 1 muc.<br>3. Menu tu dong dong. | - Menu mo ra muat ma.<br>- Sau khi chon muc, menu dong lai tu dong.<br>- Noi dung cuon ve dung phan. | High | [ ] |
| **TC-F20-01-10** | `[Edge]` | Khong cuon ngang tren man 320px | 1. Xem trang Help Center tren man 320px. | - Khong co thanh cuon ngang (overflow-x hidden).<br>- Van doc duoc toan bo noi dung. | High | [ ] |

---

### US-F20-02: Tuong Tac Q&A Accordion

#### Nhom 2A — Mo/Dong Accordion

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F20-02-01** | `[Positive]` | Mo rong noi dung Q&A khi click tieu de | 1. Chuyen sang tab Q&A.<br>2. Nhan vao tieu de cau hoi dau tien. | - Panel mo ra voi hieu ung dropdown muat ma.<br>- Bieu tuong Chevron xoay tu Down -> Up. | Medium | [ ] |
| **TC-F20-02-02** | `[State]` | Thu gon Q&A khi click lan 2 (Toggle) | 1. Mo mot cau hoi.<br>2. Nhan lai lan 2 vao tieu de do. | - Panel dong lai muat ma.<br>- Chevron xoay tu Up -> Down.<br>- Khong bi flash layout. | Medium | [ ] |
| **TC-F20-02-03** | `[Positive]` | Mo dong thoi nhieu Panel cung luc | 1. Nhan mo lien tiep 3 cau hoi. | - 3 panel deu hien thi noi dung day du.<br>- CSS Padding/Margin giua cac panel phan tach ro, khong de lan. | Low | [ ] |
| **TC-F20-02-04** | `[A11y]` | Dieu huong Q&A bang ban phim (Tab + Enter) | 1. Dung phim Tab de focus vao tieu de Q&A.<br>2. Nhan Enter hoac Space. | - Focus ring hien thi ro tieu de dang chon.<br>- Nhan Enter/Space mo dung panel tuong ung (khong can chuot). | Medium | [ ] |
| **TC-F20-02-05** | `[Edge]` | Q&A co noi dung rat dai khong pha layout | 1. Mo panel Q&A co noi dung > 500 chu.<br>2. Quan sat layout. | - Cot noi dung mo rong theo chieu doc.<br>- Khong tran ngang, khong de len Sidebar. | Medium | [ ] |

#### Nhom 2B — Tim Kiem Q&A

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F20-02-06** | `[Positive]` | Tim kiem Q&A co ket qua | 1. Nhap tu khoa ton tai (VD: "Products"). | - Danh sach loc ra cac Q&A chua tu khoa.<br>- Highlight tu khoa trong ket qua. | High | [ ] |
| **TC-F20-02-07** | `[UI State]` | Empty State khi tim kiem khong co ket qua | 1. Nhap tu khoa khong ton tai: `abc88xyz`. | - Hien thi thong bao "No answers found" o vi tri can giua.<br>- Khong crash, khong hien Exception 500. | High | [ ] |
| **TC-F20-02-08** | `[Security]` | Chan XSS trong o tim kiem Q&A | 1. Nhap chuoi `<script>alert(1)</script>` vao o search. | - Input duoc sanitize, JS khong thuc thi.<br>- DOM chi hien text literal an toan. | Blocker | [ ] |
| **TC-F20-02-09** | `[Security]` | Chan SQL Injection trong o tim kiem | 1. Nhap `' OR 1=1 --` vao o tim kiem. | - He thong xu ly nhu chuoi literal binh thuong.<br>- Khong gay loi DB, khong leak du lieu. | Blocker | [ ] |
| **TC-F20-02-10** | `[Perf]` | Tim kiem co Debounce 300ms, khong spam API | 1. Go nhanh "What is..." tung ky tu lien tiep. | - API chi duoc goi sau khi ngung go ~300ms (Debounce).<br>- Khong send 10 request cho 10 ky tu lien tiep. | Critical | [ ] |
| **TC-F20-02-11** | `[BVA]` | Tim kiem voi o trong / chi dau cach | 1. Nhap toan bo khoang trang vao o search.<br>2. Nhan Enter. | - Hien thi toan bo Q&A (khong filter).<br>- Khong goi API voi query rong. | Medium | [ ] |
| **TC-F20-02-12** | `[Edge]` | Tim kiem voi ky tu Unicode, Emoji | 1. Nhap emoji hoac ky tu Trung/Han vao o search. | - Server decode UTF-8 dung, khong crash.<br>- Tra ve ket qua hop le hoac Empty State. | High | [ ] |

---

### US-F20-03: Huong Dan Module Co Hinh Minh Hoa

#### Nhom 3A — Hien Thi Noi Dung & Hinh Anh

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F20-03-01** | `[Positive]` | Hien thi huong dan tung buoc theo module | 1. Chon module "Products" tren nav. | - Hien thi huong dan dang numbered steps ro rang.<br>- Moi buoc co hinh minh hoa kem theo. | High | [ ] |
| **TC-F20-03-02** | `[Perf]` | Hinh anh dung dinh dang WebP | 1. Mo DevTools > Network tab (Filter: Img).<br>2. Load trang huong dan Products. | - Toan bo anh Response Header la `content-type: image/webp`.<br>- Dung luong moi anh < 100KB. | High | [x] |
| **TC-F20-03-03** | `[Perf]` | Lazy Loading: Anh chi load khi vao viewport | 1. Kich hoat Slow 3G.<br>2. Mo trang huong dan co 15-20 anh HD.<br>3. Cuon cham tu tren xuong. | - Moi the `<img>` co thuoc tinh `loading="lazy"`.<br>- Network chi fetch anh khi sap vao viewport.<br>- Khong load tat ca anh ngay khi mo trang. | Blocker | [ ] |
| **TC-F20-03-04** | `[UI State]` | Skeleton/Blur hieu cho anh chua load xong | 1. Slow 3G, quan sat anh dang load. | - Skeleton hoac blur container chiem khong gian vat li truoc khi anh hien.<br>- Khong bi Cumulative Layout Shift (CLS) khi anh load xong. | Blocker | [ ] |
| **TC-F20-03-05** | `[Edge]` | Hien Fallback khi anh bi broken (Src 404) | 1. Thay URL anh thanh link chet (404).<br>2. Reload trang. | - Hien Fallback SVG (broken image placeholder) hoac Alt Text.<br>- Khung trang khong bi sap (khong crash React component).<br>- Van doc duoc van ban xung quanh. | High | [x] |
| **TC-F20-03-06** | `[Edge]` | Hash Anchor khong bi lech khi anh load cham | 1. Truy cap `/help#orders` voi mang Slow 3G.<br>2. Doi 10s de anh bung no day du. | - Sau khi anh render xong, viewport van bam dung phan "Orders".<br>- Khong bi truot anchor khoi diem tieu diem. | Blocker | [ ] |

#### Nhom 3B — Lightbox Modal

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F20-03-07** | `[Positive]` | Mo Lightbox khi click anh thumbnail | 1. Nhan vao anh minh hoa trong bai huong dan. | - Dark Overlay che kuat 100% nen lam viec.<br>- Anh hien thi can giua o do phan giai cao.<br>- Co nut dong (X) ro rang. | High | [ ] |
| **TC-F20-03-08** | `[Positive]` | Dong Lightbox bang nut X | 1. Mo Lightbox.<br>2. Nhan nut X. | - Modal dong lai.<br>- Giao dien tro ve trang Thai doc tinh binh thuong.<br>- Scroll position giu nguyen. | High | [ ] |
| **TC-F20-03-09** | `[Positive]` | Dong Lightbox bang phim ESC | 1. Mo Lightbox.<br>2. Nhan phim `ESC`. | - Modal unmount, thu nho ve giao dien chinh.<br>- Scroll position giu nguyen vi tri hien tai. | Medium | [ ] |
| **TC-F20-03-10** | `[Positive]` | Dong Lightbox khi click vao Overlay vung toi | 1. Mo Lightbox.<br>2. Click vao vung toi ben ngoai anh. | - Modal dong lai.<br>- Khong dong khi click vao chinh anh. | Medium | [ ] |
| **TC-F20-03-11** | `[UX]` | Khoa cuon nen khi Lightbox mo | 1. Mo Lightbox.<br>2. Cuon chuot (Wheel Roll) xu ong manh. | - `overflow: hidden` nen trang bat buoc dong cung.<br>- Noi dung phia sau khong truot.<br>- Sau khi dong Modal, scroll binh thuong tro lai. | Medium | [ ] |
| **TC-F20-03-12** | `[UI State]` | Z-Index Lightbox khong bi de boi Bottom Toolbar | 1. Mo Lightbox tren Mobile co Bottom Navigation (F18).<br>2. Quan sat layer. | - Overlay va Modal co Z-Index cao hon Bottom Toolbar F18.<br>- Khong bi lo (leak) thanh dieu huong xuyen qua overlay. | Critical | [ ] |
| **TC-F20-03-13** | `[Concurrency]` | Mo nhieu Lightbox lien tiep nhanh | 1. Click vao anh 1, roi ngay lap tuc click anh 2. | - Chi hien thi 1 Lightbox tai mot thoi diem.<br>- Modal cu dong truoc khi Modal moi mo. | Medium | [ ] |

---

### US-F20-04: Mobile Gesture — Pinch-to-Zoom Lightbox

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F20-04-01** | `[Positive]` | Pinch-to-Zoom phong to anh trong Lightbox (iOS Safari) | 1. Mo Lightbox tren iPhone Safari thuc.<br>2. Dung 2 ngon tay cham va keo ra (Pinch Spread). | - Anh phong to muot, khong thoat khoi Lightbox.<br>- CSS `touch-action: pinch-zoom` hoac handler cu the hoat dong. | Blocker | [ ] |
| **TC-F20-04-02** | `[Positive]` | Double-tap de phong to/thu nho | 1. Mo Lightbox tren Mobile.<br>2. Double-tap vao anh. | - Anh tang zoom 2x, double-tap lan 2 tro ve 1x.<br>- Muot, khong giat. | High | [ ] |
| **TC-F20-04-03** | `[Positive]` | Pan (keo) anh khi da zoom | 1. Zoom anh vao trong Lightbox.<br>2. Keo (pan) anh theo cac huong. | - Anh di chuyen theo ngon tay trong gioi han Lightbox.<br>- Khong truot nen trang background. | High | [ ] |
| **TC-F20-04-04** | `[Negative]` | He dieu hanh khong block Zoom trong Lightbox | 1. Kiem tra thiet bi iOS.<br>2. Thu Pinch trong Modal. | - `touch-action: none` chi ap dung cho nen, khong cho anh bên trong Lightbox.<br>- Zoom khong bi ngan boi `<meta viewport maximum-scale=1>`. | Blocker | [ ] |
| **TC-F20-04-05** | `[Edge]` | Anh van sac net sau khi Pinch Zoom | 1. Zoom anh toi da (3x-4x).<br>2. Quan sat do net cua chu trong hinh. | - Anh WebP c Scale len van giu net.<br>- Khong bi mo (blur) do over-scaling. | High | [ ] |
| **TC-F20-04-06** | `[Edge]` | Thu nho ve 1x sau khi zoom | 1. Zoom anh, roi Pinch thu nho ve 1x. | - Anh tro ve kich thuoc mac dinh trong Lightbox.<br>- Khong bi thu qua nho hoac mat anh khoi view. | Medium | [ ] |

---

### US-F20-05: Boc Dia Hoa & i18n Help Center Content (Tich hop tu F21)

| ID | Loai | Tieu De | Cac Buoc Thuc Hien | Ket Qua Mong Doi | Muc Do | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F20-05-01** | `[Positive]` | Chuyen sang BM: Label va Q&A cung doi ngon ngu | 1. CMS dang o ngon ngu EN.<br>2. Chuyen sang BM.<br>3. Mo Help Center. | - Tieu de nav, Q&A, nhan nut deu hien Bahasa Melayu.<br>- Khong co chuoi raw key nhu `help.title.welcome`. | Blocker | [ ] |
| **TC-F20-05-02** | `[Edge]` | Fallback EN khi khoa dich BM bi thieu | 1. Xoa khoa BM cua muc "Q&A" khoi file `bm.json`.<br>2. Chuyen sang BM. | - He thong hien text tieng Anh fallback.<br>- Khong hien raw key, khong trang trang. | Blocker | [ ] |
| **TC-F20-05-03** | `[Negative]` | Khong hien raw i18n key bat ky trong moi truong nao | 1. Kiem tra toan bo text tren Help Center o ca 2 ngon ngu. | - Khong ton tai chuoi dang `help.x.y` hien ra tren UI.<br>- Moi key deu co chuoi dich tuong ung. | High | [ ] |

---

## 4. Bien Ban Kiem Dinh — 10-Point Checklist (Sign-Off)

| # | Tieu Chi | Trang Thai |
|:---:|:---|:---:|
| 1 | **Auth/401 Guard:** Truy cap `/cms/help` khong co token bi redirect ve `/login`, khong preload noi dung. | [ ] |
| 2 | **XSS Sanitization:** O search Q&A va URL Hash deu escape HTML, khong thuc thi JS. | [ ] |
| 3 | **Lazy Loading:** Toan bo `<img>` co `loading="lazy"`, chi fetch khi goc viewport. | [ ] |
| 4 | **WebP Format:** Tat ca anh tra ve `content-type: image/webp`, < 100KB/anh. | [ ] |
| 5 | **Broken Image Fallback:** Link anh 404 hien SVG placeholder, khong crash React. | [ ] |
| 6 | **Lightbox Z-Index:** Overlay cao hon Bottom Toolbar F18, khong bi xuyen qua. | [ ] |
| 7 | **Pinch-to-Zoom (iOS):** `touch-action` duoc cau hinh dung, Pinch/Pan muat trong Lightbox. | [ ] |
| 8 | **Hash Anchor Stability:** `/help#orders` voi Slow 3G van bam dung phan sau khi anh load. | [ ] |
| 9 | **Mobile Responsive 375px:** Sidebar doi sang Off-canvas, khong cuon ngang. | [ ] |
| 10 | **i18n Fallback:** Chuyen BM, thieu key van hien EN fallback, khong lo raw key. | [ ] |

---

## 5. Quality Gates

| Nhom | Trang Thai | Ghi Chu |
|---|---|---|
| **1. Security & Auth** | [ ] Not Run | 401 Guard, XSS Search, XSS Hash, SQL Injection |
| **2. Media & Performance** | [ ] Not Run | Lazy Load, WebP, Broken Image Fallback, CLS Prevention |
| **3. Lightbox & Modal** | [ ] Not Run | Open/Close (X/ESC/Overlay), Z-Index, Body Scroll Lock, Concurrency |
| **4. Mobile Gestures** | [ ] Not Run | Pinch-to-Zoom, Double-tap, Pan, touch-action config |
| **5. Navigation & i18n** | [ ] Not Run | Anchor Hash stable, Sidebar 375px, BM/EN Fallback |

> **Khuyen Nghi Release:** Tat ca Blockers (dac biet: Auth 401, Lazy Load CLS, Lightbox Z-Index, Pinch-to-Zoom) phai dat Passed truoc khi Push Production.

---
**PHE DUYET BOI:** .................................... **NGAY:** ..../..../2026

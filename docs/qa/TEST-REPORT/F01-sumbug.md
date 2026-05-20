# Bug Report Summary — F01 AI Website Builder (GitHub Issues)

> **Project:** ECH Prime Web v2
> **Environment:** Staging — `https://web-cms-v2.dev.ecommercehub.my/`
> **Date:** 2026-04-10
> **Reported by:** QA Team (Extracted from GitHub Issues & Comments)
> **Status:** 🔴 OPEN — Pending Dev Fix

---

## Tổng quan

| Feature | Tổng Bug | P0 Critical | P1 High | P2 Medium | Trạng thái |
| :--- | :---: | :---: | :---: | :---: | :---: |
| F01 — AI Website Builder | 27 | 8 | 3 | 5 | 🔴 BLOCKED |

> **⚠️ Release Decision: BLOCKED**
> Có 8 lỗi P0 Critical liên quan đến Security và luồng chính (Block/Crash) phải được fix ngay lập tức.

---

## Danh sách Bug

### 🔴 P0 — CRITICAL

> Phải fix ngay — block toàn bộ release, liên quan trực tiếp bảo mật và database.

---

#### BUG-F01-01 · Lỗi Xuyên Thủng Bảo Mật: SQL Injection tại Endpoint Login

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **TC-ID** | TC-F01.02 |
| **Severity** | 🔴 P0 Critical |
| **Module** | Auth API (`/api/auth/login`) |
| **Nguồn** | Issue #347 |

**Mô tả**
Hệ thống không filter input, query trực tiếp gãy logic. Lỗ hổng cho phép tiêm SQL, trả về mã HTTP 200 OK và lấy được Auth JWT Token chứa cờ Admin. Hệ thống bị chiếm quyền hoàn toàn.

**Bước tái hiện**
1. Gửi request `POST` login qua API `/api/auth/login`.
2. Tiêm chuỗi Payload SQL Injection cơ bản vào trường email: `{"email": "admin' OR 1=1--", "password": "anypassword"}`
3. Đọc dữ liệu Payload Server gửi về.

**Kết quả thực tế**
Nhận mã `HTTP 200 OK` và response có token chứa role admin.

**Kết quả mong đợi**
Bộ lọc Data Validation/Sanitization phải chặn payload này hoặc trả `HTTP 401 Unauthorized`.

---

#### BUG-F01-02 · Lỗi Bảo mật IDOR/Tenant Isolation: Xuyên thủng JWT kéo data chéo Account

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **TC-ID** | TC-F01.48 |
| **Severity** | 🔴 P0 Critical |
| **Module** | Site Fetch API |
| **Nguồn** | Issue #346 |

**Mô tả**
Bypass Tenant Isolation. End-user có thể dùng JWT của account mình truy xuất trực tiếp API lấy toàn bộ thông tin nội dung website bí mật của account user khác.

**Bước tái hiện**
1. Đăng nhập bằng Account User A (JWT Token A). Lấy Site ID của User B (`{id_userB_site}`).
2. Gửi request `GET /api/sites/{id_userB_site}` sử dụng Header Auth của User A.

**Kết quả thực tế**
Endpoint trả về `HTTP 200 OK` kèm theo toàn bộ cục JSON mảng Site của User B.

**Kết quả mong đợi**
Server phải đối chiếu Account Scope và từ chối truy cập bằng mã `HTTP 403 Forbidden`.

---

#### BUG-F01-03 · Raw SQL Query Lộ Ra Trên Giao Diện Khi Truy Cập Builder

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **Severity** | 🔴 P0 Critical |
| **Module** | Builder UI |
| **Nguồn** | Issue #246 (Comment) |

**Mô tả**
Thay vì render layout form sinh web, hệ thống in toàn bộ raw text chứa raw SQL Join database schema của hàng loạt bảng cấu trúc web ra thẳng giao diện frontend. Lộ thông tin nhạy cảm của CSDL.

**Bước tái hiện**
1. Đăng nhập vào staging và xác thực OTP.
2. Chuyển hướng tới trang `/builder/new`.
3. Kiểm tra render UI dưới form.

**Kết quả thực tế**
Giao diện in thẳng SQL Query dài của database (table `pages_blocks_hero`, `pages_blocks_navigation`, vv...). Khách hàng nhìn thấy code lỗi rất lộ liễu.

**Kết quả mong đợi**
Không vứt catch errors DB raw message ra frontend GUI. Mọi lỗi DB cần trả `HTTP 500`. 

---

#### BUG-F01-04 · API AI Generate trả 500 — Thiếu 6+ bảng DB (BLOCKER)

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **Severity** | 🔴 P0 Critical |
| **Module** | AI Generate API Database |
| **Nguồn** | Issue #246 (Comment) |

**Mô tả**
Flow tạo web AI sập hoàn toàn do Payload CMS khi pushDevSchema đã thiếu khởi tạo 6 bảng CSDL liên quan đến component (như `pages_blocks_social_widget`, `_pages_v_blocks_social_widget`...). 

**Bước tái hiện**
1. Nhập full các trường bắt buộc (Business Name, Industry).
2. Click "Continue — AI will create your website".

**Kết quả thực tế**
API trả về 500 Internal Server error `relation "_pages_v_blocks_social_widget" does not exist`. Luồng tạo web AI bị crash toàn bộ. 

**Kết quả mong đợi**
Payload CMS phải setup đủ 100% database relation, site generate trơn tru.

---

#### BUG-F01-05 · Lỗ hổng API Rate Limit: Không chặn rác Spam Flooding DdoS

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **TC-ID** | TC-F01.46 |
| **Severity** | 🔴 P0 Critical |
| **Module** | Generation API |
| **Nguồn** | Issue #345 & Issue #246 |

**Mô tả**
Không có cơ chế chặn Anti-bot hay limit calls vào API gọi OpenAI. Hacker có thể send 15+ concurrent requests / second xuyên thủng hệ thống để đốt sạch Quota token API OpenAI gốc.

**Bước tái hiện**
1. Viết script loop gửi đồng thời ngập lụt 15 HTTP POST request trong 1 giây lên `/api/generate`.
2. Quan sát server logs.

**Kết quả thực tế**
Hệ thống nai lưng xử lý cả 15 requests (trả về 200 OK l loạt). Server bị delay treo luồng chính. 

**Kết quả mong đợi**
Middleware chặn rate-limit tối đa là 10. Từ request 11 phải trả mã `HTTP 429 Too Many Requests`.

---

#### BUG-F01-09 · Bypass API gọi Published domain sống siêu tốc

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **TC-ID** | TC-F01.25 |
| **Severity** | 🔴 P0 Critical |
| **Module** | Publish API |
| **Nguồn** | Issue #249 (Comment) |

**Mô tả**
Bypass API cập nhật trạng thái Site mà không thông qua business logic chuẩn. Lỗ hổng cho phép gởi `PUT` request đổi status website sang "Published" và đưa web lên live public internet chớp nhoáng trước khi DB kiểm duyệt nội dung.

**Kết quả thực tế**
Site được Public ngay lập tức qua API bypass mà không qua luồng phê duyệt an toàn.

---

#### BUG-F01-10 · Lỗi Xung đột DB WriteConflict (Cron/Layout)

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **TC-ID** | TC-F01.40 |
| **Severity** | 🔴 P0 Critical |
| **Module** | Database / Reorder Block |
| **Nguồn** | Issue #253 (Comment) |

**Mô tả**
Xung đột DB khi có nhiều transaction song song hoặc user bấm lưu Layout cùng lúc hệ thống chạy batch cập nhật, dẫn tới Database tung ngoại lệ WriteConflict và fail nghiệp vụ cứng.

**Kết quả thực tế**
Lỗi WriteConflict văng ra khi 2 lượt lưu layout / cron xảy ra cùng lúc, khiến Web Backend chết luồng.

#### BUG-F01-06 · Account mới bị lưu dính Data / local stories / Domain lạ

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **Severity** | 🔴 P0 Critical |
| **Module** | Local Data Storage / Onboarding |
| **Nguồn** | Issue #415 & Issue #246 (Comment) |

**Mô tả**
Lỗi rò rỉ dữ liệu Client-side. Khi một tài khoản đăng nhập sau trên cùng một trình duyệt, hệ thống điền sẵn form input với nội dung và tải web domain của user Account trước đó, cross-contamination giữa các accounts. 

**Bước tái hiện**
1. Dùng test user account mới hoàn toàn (ví dụ: `arytest14@yopmail.com`) để đăng nhập.
2. Ấn vào tạo web với chat AI.

**Kết quả thực tế**
Input fields trên form hiện rành rành nội dung và domain tên website thuộc về người lạ. Không load Empty Form sạch. 

**Kết quả mong đợi**
Client State/Session phải xoá trắng khi user logout. User khác đăng nhập thấy State sạch sẽ.

---

### 🟠 P1 — HIGH

> Lỗi chức năng cản trở flow, không gây lỗi hệ thống liên đới nhưng tổn hại UX nghiêm trọng.

---

#### BUG-F01-07 · Không lưu được trạng thái Draft, mất trắng dữ liệu khi tải lại trang

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **Severity** | 🟠 P1 High |
| **Module** | Form Draft Auto-save |
| **Nguồn** | Issue #246 (Comment) |

**Mô tả**
Người dùng điền form `/builder/new` giữa chừng hoặc gen web đang load, lỡ F5 tải lại trang thì trình duyệt bay sạch dữ liệu đã điền, biến mất màn progress hoàn toàn.

**Bước tái hiện**
1. Mở trang tạo web, điền đầy đủ. Bấm Generate đang đợi thanh Loading.
2. Vô tình ấn Refresh / Back browser. 

**Kết quả thực tế**
Draft huỷ toàn bộ, luồng huỷ trả về trang Form Input trống không, mất cống gõ.

**Kết quả mong đợi**
Browser khôi phục input data hoặc app tự khôi phục form session progress via LocalStorage/DB Draft. 

---

#### BUG-F01-08 · Quota Free bị trừ khi tạo website thất bại 

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **TC-ID** | TC-F01.67 |
| **Severity** | 🟠 P1 High |
| **Module** | Quota Transaction |
| **Nguồn** | Issue #246 (Comment) |

**Mô tả**
User có quyền sử dụng 01 Quota Free. Khi tạo website, nếu xảy ra lỗi Server bị 500 (như ở BUG-F01-04) hoặc timeout API OpenAI, tiến trình fail nhưng hệ thống vẫn ngang nhiên trừ sạch 1 credit. 

**Bước tái hiện**
1. Lấy acc 1 Quota, điền form cho chạy sinh Web. 
2. Chọc ngắt API hoặc server 500. 
3. Refresh Account xem Quota.

**Kết quả thực tế**
Tài khoản bị đánh dấu "hết lượt gen" và block chức năng với thông báo "Account Free chỉ được tạo website 1 lần".

**Kết quả mong đợi**
Chỉ trừ vào Quota Credit khi event generation hoàn toàn success. Nếu backend error thì kích hoạt Transaction Rollback.

---

#### BUG-F01-11 · Submit thay đổi Layout ghi đè chính xác vào Mongo nhưng UI chập chờn

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **TC-ID** | TC-F01.40 |
| **Severity** | 🟠 P1 High |
| **Module** | Preview Builder |
| **Nguồn** | Issue #253 (Comment) |

**Mô tả**
Thao tác dời thứ tự Layout (SortOrder update). API trả về OK (MongoDB Document sortOrder được thay đổi thành công rực rỡ), nhưng khi reload trang Layout trên DOM React UI không cập nhật lại đúng thứ tự mới trên cấu trúc web. Có sự đứt gãy giữa Backend DB Data và Frontend Cache.

**Kết quả thực tế**
Client State bất ổn, Block vừa kéo xong load lại trang trả về trạng thái cũ.

---

### 🟢 P2 — MEDIUM

> Lỗi sai sót giao diện Frontend, thiếu Validation field, các trải nghiệm đứt gãy không cản trở hoàn toàn luồng chính.

---

#### BUG-F01-12 · Không bắt lỗi Validation: Nhập input field dưới 3 ký tự hệ thống vẫn cho Pass

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **Severity** | 🟢 P2 Medium |
| **Module** | Onboarding Form Validation |
| **Nguồn** | Issue #247 (Comment) |

**Mô tả**
Theo yêu cầu, trường Business Type Input phải dài ít nhất 3 ký tự. Cấu trúc frontend cho phép bypass điền form chỉ với 1 ký tự và nhấn Proceed dễ dàng, không giăng dây bẫy lỗi ở Client Side.

**Kết quả thực tế**
Nhập field dưới 3 ký tự, hệ thống vẫn nhắm mắt pass qua Step 2.

---

#### BUG-F01-13 · Layout Màn hình: Giao diện Form Input không có phần chọn Industry

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **Severity** | 🟢 P2 Medium |
| **Module** | Builder Input Forms |
| **Nguồn** | Issue #250 (Comment) |

**Mô tả**
Lúc load màn Create Web lần đầu tiên, giao diện trả về trống và thiếu đi Option Box của trường quy định Ngành nghề (Industry), làm suy giảm chất lượng dữ liệu Context đưa cho Prompt AI.

**Kết quả mong đợi**
Gắn chặt Industry dropdown hoặc Selection Cards để user input chính xác sector của mình.

---

#### BUG-F01-14 · UI/UX: Lỗi mất cấu trúc và định dạng Responsive trên Desktop/Mobile

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **Severity** | 🟢 P2 Medium |
| **Module** | Builder Input Forms |
| **Nguồn** | Issue #250 (Comment) |

**Mô tả**
Màn hình tạo web hiển thị sai cấu trúc HTML/CSS trên breakpoint Mobile, dẫn đến bể giao diện / tràn chữ. Layout responsive xử lý Flex/Grid chưa trơn tru giữa Desktop và Tablet/Smartphones.

---

#### BUG-F01-15 · Lỗi không đồng nhất Font chữ và Placeholder giữa Desktop/Mobile

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **Severity** | 🟢 P2 Medium |
| **Module** | Builder Input Forms |
| **Nguồn** | Issue #250 (Comment) |

**Mô tả**
Cùng một màn hình tính năng những text font size, font family không đồng bộ và placeholder nhảy dòng lệch. Chênh lệch UX khi user đổi thiết bị.

---

#### BUG-F01-16 · Lỗi sai Visual Animation khi chọn option Industry trên Desktop/Mobile

| | |
| :--- | :--- |
| **Feature** | F01 — AI Website Builder |
| **Severity** | 🟢 P2 Medium |
| **Module** | Builder Input Forms |
| **Nguồn** | Issue #250 (Comment) |

**Mô tả**
Hiệu ứng focus/hover/active selection bị chệch. Bấm chọn Industry Options nhưng không rực sáng feedback đã click. Tương tác có cảm giác đơ.
### BUG-F01-17 · State không đồng bộ sau khi sắp xếp lại block (Reorder)

| | |
| :--- | :--- |
| **TC-ID** | TC-F01.38 |
| **Severity** | 🟠 P1 High |
| **Module** | Drag-and-Drop / State Sync |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Sau khi user kéo thả sắp xếp lại thứ tự các block, state trên UI không đồng bộ với thứ tự thực tế. Editor render blocks bên trong iframe, dẫn đến headings không truy cập được từ main DOM. Zustand store key được detect nhưng state sync giữa iframe và main DOM bị lỗi.

**Bước tái hiện**
1. Vào Editor, kéo thả sắp xếp lại block
2. Quan sát thứ tự hiển thị trên preview sau khi thả

**Kết quả thực tế:** Thứ tự block trên preview không phản ánh đúng thứ tự vừa sắp xếp. State giữa iframe và main DOM bị lệch.

**Kết quả mong đợi:** Sau khi kéo thả, thứ tự block trên preview phải cập nhật ngay lập tức và đồng bộ với state trong store.

---

### BUG-F01-18 · AI không xử lý được tiếng Việt viết tắt/slang — server crash

| | |
| :--- | :--- |
| **TC-ID** | TC-F01.54 |
| **Severity** | 🟠 P1 High |
| **Module** | NLU Advanced / AI Generation |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Khi user nhập tiếng Việt viết tắt/slang nặng (ví dụ: "Mk mún dg 1 wán nướng vĩa hè cho shvu sinh vin"), server trả về lỗi "Something went wrong on our end". AI không xử lý được text bị corrupted và không fallback gracefully.

**Bước tái hiện**
1. Vào trang tạo website
2. Nhập Business Name và Description bằng tiếng Việt viết tắt/slang nặng
3. Nhấn "Generate Website"

**Kết quả thực tế:** Server error — "Something went wrong on our end". Website không được tạo.

**Kết quả mong đợi:** AI cố gắng normalize text hoặc hiển thị thông báo yêu cầu user nhập lại rõ ràng hơn, không crash server.

---

### BUG-F01-19 · Subdomain 502 Bad Gateway sau khi Publish

| | |
| :--- | :--- |
| **TC-ID** | TC-F01.25 |
| **Severity** | 🟠 P1 High |
| **Module** | Publish / Infrastructure |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Sau khi user publish website, subdomain được cấp nhưng trả về Cloudflare 502 Bad Gateway. Website không hoạt động sau 30 giây chờ.

**Bước tái hiện**
1. Hoàn thành tạo website
2. Nhấn Publish
3. Truy cập vào subdomain được cấp (vd: `ten-web.ondigitalocean.app`)

**Kết quả thực tế:** Cloudflare hiển thị lỗi 502 Bad Gateway sau 30 giây.

**Kết quả mong đợi:** Website hiển thị bình thường trong vòng 30 giây sau Publish (theo SLA).

---

### BUG-F01-20 · Mobile — Input font-size 14px gây iOS Safari auto-zoom

| | |
| :--- | :--- |
| **TC-ID** | TC-F01.M02 |
| **Severity** | 🟠 P1 High |
| **Module** | Responsive Mobile — UI |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Tất cả các input field trên form Step 1 có font-size = 14px. Trên iOS Safari, khi user tap vào input, trình duyệt sẽ tự động zoom vào (iOS yêu cầu tối thiểu 16px để không zoom).

**Thiết bị bị ảnh hưởng:** iPhone (iOS Safari) — tất cả model

**Kết quả thực tế:** Màn hình zoom vào khi tap input, gây trải nghiệm xấu.

**Kết quả mong đợi:** `font-size: 16px` trên tất cả input để ngăn iOS tự zoom.

---

### BUG-F01-21 · Lỗi layout mobile tại màn hình Review (Step 2) — Toàn bộ section lệch

| | |
| :--- | :--- |
| **Severity** | 🟠 P1 High |
| **Module** | Responsive Mobile — Layout |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Tại Step 2 (màn hình Review website), toàn bộ các section trên preview không căn đều. Layout bị lỗi trên mobile.

**Chi tiết các lỗi layout:**
- Padding không đồng đều giữa các section
- Header mobile bị tràn viền (overflow)
- Footer bị dồn về bên trái, không căn giữa
- Tất cả section chưa được căn đều (alignment sai)
- Shop name đang hiển thị thay vì Logo thật (chưa tạo logo)

**Bước tái hiện**
1. Tạo website bằng AI
2. Chờ preview xong, chuyển sang xem trên mobile (375px)
3. Quan sát step 2 — màn hình Review

**Kết quả mong đợi:** Layout hiển thị đúng theo design trên mobile.

---

### BUG-F01-22 · Không có loading screen khi user ấn chuyển sang Dashboard

| | |
| :--- | :--- |
| **Severity** | 🟠 P1 High |
| **Module** | UX / Navigation |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Sau khi hoàn tất tạo website, khi user nhấn nút "Go to Dashboard", không có màn hình loading trung gian. Màn hình trắng hoặc chuyển đột ngột gây cảm giác crash.

**Kết quả mong đợi:** Hiển thị màn hình loading/skeleton khi đang chuyển trang sang Dashboard.

---

### BUG-F01-23 · AI generate nội dung 4 trang giống nhau — không có sự khác biệt

| | |
| :--- | :--- |
| **Severity** | 🟠 P1 High |
| **Module** | AI Generation / Content |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
AI tạo nội dung cho 4 trang (Home, About, Products, Contact) nhưng content gần như giống nhau. Mỗi trang phải có nội dung riêng biệt, phù hợp với mục đích của trang đó.

**Kết quả mong đợi:**
- Home: giới thiệu, banner, CTA chính
- About: lịch sử, đội ngũ, giá trị
- Products: danh sách sản phẩm/dịch vụ
- Contact: form liên hệ, địa chỉ, bản đồ

---

### BUG-F01-24 · AI gene lỗi — website bị mất menu và mất data sau generation

| | |
| :--- | :--- |
| **Severity** | 🟠 P1 High |
| **Module** | AI Generation / Data Integrity |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Sau khi AI generate xong, một số trường hợp website bị mất menu navigation và mất data đã nhập. Lỗi xảy ra không nhất quán (intermittent).

**Kết quả mong đợi:** Website sau khi generate phải đầy đủ menu và giữ nguyên data.

---

### BUG-F01-25 · Không click được vào các trang trên Menu (Step 2 Review)

| | |
| :--- | :--- |
| **Severity** | 🟠 P1 High |
| **Module** | Navigation / Step 2 Review |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Trên màn hình Review (Step 2), các trang được gắn trên Menu (Home, About, Products, Contact) không click được. Link chưa được gắn vào các menu item.

---

### BUG-F01-26 · Button "Publish" bị hiển thị nhầm ở Step 2 — cần ẩn đi

| | |
| :--- | :--- |
| **Severity** | 🟠 P1 High |
| **Module** | UI / Step Flow |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Button "Publish" hiển thị ở Step 2 (Review) nhưng theo flow thiết kế phải được ẩn đi ở bước này. User chưa hoàn thành review nhưng lại có thể publish trực tiếp, bỏ qua flow.

---

### BUG-F01-27 · Description field bắt buộc trên Mobile — sai logic nghiệp vụ

| | |
| :--- | :--- |
| **TC-ID** | TC-F01.M05 |
| **Severity** | 🟡 P2 Medium |
| **Module** | Form Validation / Mobile |
| **Nguồn** | BUG-REPORT-SUMMARY.md |

**Mô tả**
Trên mobile, field "Description" đang được xử lý như field bắt buộc (button Generate bị disabled khi không nhập). Theo yêu cầu nghiệp vụ, Description là optional.

---


## 🚫 Lỗi Thiếu Tính năng / Blocked Test Cases

> **Ghi chú:** Đây là danh sách các tính năng chưa được phát triển dẫn đến Test Cases bị Blocked.

| TC-ID | Title | Priority | Lý do BLOCKED |
| :--- | :--- | :---: | :--- |
| TC-F01.59 | Regenerate AI Image | High | Nút "Regenerate Image" chưa có trong editor UI. |
| TC-F01.86 | Regenerate Image rate limit | High | Phụ thuộc TC-F01.59 — không thể test rate limit khi button chưa tồn tại |

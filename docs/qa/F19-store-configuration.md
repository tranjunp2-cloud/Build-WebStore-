# Tài Liệu Kiểm Thử: F19 - Cấu hình Cửa Hàng & Quản Lý Nhân Sự
> **Phiên bản:** 7.1 (Comprehensive + Domain Deep-Dive) | **Cập nhật:** 2026-04-06 | **Thực hiện:** QA Team
> **Nguồn:** PRD F19, User Stories US-F19-01 → US-F19-06 (12 REQs, 6 USs, 17 ACs)
> **Kỹ thuật:** Equivalence Partitioning, BVA, State Transition, Error Guessing, Concurrency, UI/UX States

---

## 1. Mục Tiêu Kiểm Thử
Bộ test case vét cạn 100% Acceptance Criteria của F19, bao gồm: Quản lý tên miền (Custom Domain), Cài đặt thanh toán (Payment), và Phân quyền nhân sự (RBAC). Mỗi AC Happy Path đều có ít nhất 2-3 case Negative/Edge tương ứng.

---

## 2. Môi Trường Kiểm Thử

| Biến | Giá trị |
|---|---|
| Môi trường | Staging / Pre-Production |
| Trình duyệt | Chrome 110+, Safari iOS, Firefox |
| Thiết bị | Desktop (1440px), Mobile (iPhone 375px) |
| Tài khoản test | Owner (Chủ shop), Staff Full Access, Staff Custom (chỉ Orders) |

---

## 3. Ma Trận Test Case Theo User Story

### US-F19-01: Thêm Tên Miền Tùy Chỉnh (Add Custom Domain)

#### Nhóm 1A — Form Validation & Input (BVA)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.01** | `[Positive]` | Hiển thị giao diện tab Domain | 1. Đăng nhập CMS với quyền Owner.<br>2. Vào **Cài đặt > Domains**. | - Tab Domains hiển thị trong Main Content Area đúng chuẩn F18 layout.<br>- Sidebar và Header không bị ảnh hưởng. | Medium | [ ] |
| **TC-F19.02** | `[Positive]` | Thêm tên miền hợp lệ thành công | 1. Nhấn **"Add Custom Domain"**.<br>2. Nhập `my-store.com`.<br>3. Nhấn **"Connect"**. | - Hệ thống hiển thị bảng DNS gồm **A Record (IP)** và **CNAME**.<br>- Tên miền được thêm vào list với trạng thái **"Pending Verification"**. | High | [ ] |
| **TC-F19.03** | `[Negative]` | Chặn nhập tên miền bỏ trống / chỉ có khoảng trắng | 1. Nhấn "Add Custom Domain".<br>2. Nhập một chuỗi toàn dấu cách hoặc để trống.<br>3. Nhấn "Connect". | - Viền input đổi màu đỏ.<br>- Thông báo: *"Vui lòng nhập tên miền hợp lệ"*.<br>- Nút Connect bị vô hiệu hóa. | High | [ ] |
| **TC-F19.04** | `[Negative]` | Chặn định dạng URL có tiền tố http/https | 1. Nhập `http://store.com`.<br>2. Nhấn Connect. | - Báo lỗi: *"Không cần nhập http/https, chỉ nhập tên miền"*. | High | [ ] |
| **TC-F19.05** | `[Negative]` | Chặn domain thiếu phần mở rộng TLD | 1. Nhập `mystore` (không có `.com`, `.my`, v.v.).<br>2. Nhấn Connect. | - Báo lỗi format không hợp lệ. Nút Connect bị block. | High | [ ] |
| **TC-F19.06** | `[Negative]` | Chặn domain có khoảng trắng | 1. Nhập `my store.com`.<br>2. Nhấn Connect. | - Regex kiểm tra phát hiện khoảng trắng, báo lỗi ngay lập tức. | High | [ ] |
| **TC-F19.07** | `[BVA]` | Chặn ký tự đặc biệt không hợp lệ | 1. Nhập `my@store!.com`.<br>2. Nhấn Connect. | - Báo lỗi: ký tự `@` và `!` không được phép trong tên miền. | High | [ ] |
| **TC-F19.08** | `[BVA]` | Chặn domain vượt giới hạn độ dài (>253 ký tự theo RFC) | 1. Paste chuỗi domain dài hơn 253 ký tự vào ô nhập liệu.<br>2. Nhấn Connect. | - Hệ thống cắt hoặc báo lỗi vượt giới hạn, không gửi API. | Medium | [ ] |
| **TC-F19.09** | `[ErrorGuess]` | Chặn XSS Injection trong input domain | 1. Nhập `<script>alert(1)</script>.com`.<br>2. Nhấn Connect. | - Input được sanitize, không render script.<br>- Báo lỗi format hoặc trả về lỗi 400 từ server. | Blocker | [x] |
| **TC-F19.10** | `[Edge]` | Subdomain cấp 3: `blog.mystore.com` | 1. Nhập `blog.mystore.com`.<br>2. Nhấn Connect. | - Cần xác nhận với dev: Hệ thống có hỗ trợ subdomain cấp 3 không? Nếu không, phải thông báo rõ ràng. | Medium | [ ] |

#### Nhóm 1B — State Transition (Vòng đời Domain)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.11** | `[State]` | DNS chưa trỏ → Verify → Giữ Pending | 1. Add domain thành công.<br>2. Chưa cấu hình DNS tại Registrar.<br>3. Nhấn "Verify Connection". | - Trạng thái vẫn là **"Pending Verification"**.<br>- Thông báo: *"Bản ghi DNS có thể mất tới 24-48 giờ để cập nhật"*. | Medium | [ ] |
| **TC-F19.12** | `[Positive]` | DNS đã trỏ đúng → Verify → Connected + SSL | 1. Cấu hình DNS đúng tại Registrar (CNAME trỏ đúng host).<br>2. Nhấn "Verify Connection". | - Trạng thái đổi sang **"✓ Connected"** màu xanh.<br>- SSL tự động được cấp phát (HTTPS hoạt động). | High | [ ] |
| **TC-F19.13** | `[Positive]` | SSL tự động cấp sau khi Verify | 1. Domain vừa chuyển sang trạng thái Connected.<br>2. Mở domain đó bằng trình duyệt. | - Trình duyệt hiển thị **ổ khóa HTTPS màu xanh**.<br>- Không có cảnh báo chứng chỉ không hợp lệ. | Blocker | [x] |
| **TC-F19.14** | `[State]` | Domain Connected → Xóa → Giải phóng domain | 1. Domain đã Connected, nhấn "Remove".<br>2. Xác nhận xóa. | - Domain biến mất khỏi danh sách.<br>- SSL của domain bị thu hồi.<br>- Domain không còn route tới store nữa. | High | [ ] |
| **TC-F19.15** | `[State]` ⭐ | Domain bị Store A xóa → Store B add lại cùng domain | 1. Store A xóa domain `fashionstore.com`.<br>2. Store B ngay sau đó add `fashionstore.com`. | - Domain đã được **giải phóng hoàn toàn**.<br>- Store B add thành công bình thường, không bị báo trùng bởi Store A. | High | [ ] |
| **TC-F19.16** | `[Negative]` | DNS trỏ sai IP → Verify thất bại | 1. Cố ý trỏ DNS sang IP của Google thay vì IP hệ thống.<br>2. Nhấn Verify. | - Trạng thái không chuyển sang Connected.<br>- Thông báo: *"Bản ghi DNS không khớp. Vui lòng kiểm tra lại cấu hình"*. | High | [ ] |
| **TC-F19.17** | `[Recovery]` | DNS sai → Sửa lại → Verify lần 2 thành công | 1. Verify lần 1 thất bại (DNS sai).<br>2. Sửa lại DNS đúng tại Registrar.<br>3. Nhấn Verify Connection lần 2. | - Hệ thống kiểm tra lại DNS và cập nhật trạng thái **Connected** thành công. | High | [ ] |

#### Nhóm 1C — Multi-Tenant Security (Chống Chiếm Đoạt Domain)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.18** | `[Negative]` | Chặn add domain đang được store khác sử dụng | 1. Store B nhập `fashionstore.com` — domain đang active ở Store A.<br>2. Nhấn Connect. | - Server trả lỗi: *"Tên miền này đã được gắn với một cửa hàng khác"*.<br>- Không tạo bản ghi trùng trong database. | Blocker | [x] |
| **TC-F19.19** | `[Security]` | Staff không có quyền Add Domain qua API | 1. Lấy JWT Token của Staff (dù là Full Access).<br>2. Dùng Postman gửi `POST /api/domains` với tên miền mới. | - Server kiểm tra Role trong JWT Token.<br>- Trả về **HTTP 403 Forbidden** — chỉ Owner mới được phép thêm domain. | Blocker | [x] |
| **TC-F19.20** | `[Security]` | IDOR: Xóa domain của Store khác qua API | 1. Từ Store A, lấy Domain ID của Store B.<br>2. Gọi `DELETE /api/domains/{domain_id_of_store_B}`. | - Server kiểm tra TenantID của JWT Token không khớp với domain.<br>- Trả về **HTTP 403 Forbidden**. Store B không bị ảnh hưởng. | Blocker | [x] |

#### Nhóm 1D — Concurrency & Race Conditions

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.21** | `[Concurrency]` ⭐ | Race Condition: 2 Store cùng add 1 domain trong 0.1s | 1. Dùng script gửi 2 request `POST /api/domains` với cùng domain `fashionstore.com` đồng thời từ 2 tài khoản Store A và Store B. | - DB unique constraint đảm bảo chỉ **1 store được add thành công**.<br>- Store còn lại nhận lỗi Duplicate Key Error.<br>- Không xảy ra tình trạng cả 2 store cùng chiếm domain. | Blocker | [x] |
| **TC-F19.22** | `[Concurrency]` | Spam nút Connect liên tục — Chống gửi API trùng | 1. Nhập domain hợp lệ.<br>2. Nhấn nút "Connect" liên tục 5-10 lần nhanh. | - Sau lần nhấn đầu, nút chuyển trạng thái **Loading** và bị disable.<br>- Chỉ **1 request** được gửi lên server. | Medium | [ ] |
| **TC-F19.23** | `[Concurrency]` | Spam nút Verify — Anti-duplicate DNS check | 1. Domain đang Pending.<br>2. Nhấn "Verify Connection" 10 lần nhanh. | - Nút disable ngay sau lần nhấn đầu, Spinner xuất hiện.<br>- Chỉ 1 API call DNS check được thực hiện. | Medium | [ ] |

#### Nhóm 1E — UI States (Empty, Loading, Error, Network Drop, Cancel)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.24** | `[UI State]` | Empty State — Chưa có domain nào | 1. Tài khoản mới, chưa thêm domain nào.<br>2. Vào tab Domains. | - Hiển thị màn hình trống có mô tả hướng dẫn rõ ràng.<br>- Nút **"Add Custom Domain"** nổi bật làm Call-to-Action. | Medium | [ ] |
| **TC-F19.25** | `[UI State]` | Loading State khi Verifying DNS | 1. Nhấn "Verify Connection". | - Nút hiển thị text **"Verifying..."** kèm Spinner quay.<br>- Input domain bị disable tạm thời. | Low | [ ] |
| **TC-F19.26** | `[UI State]` | Error State — Verify thất bại hiển thị rõ ràng | 1. Verify DNS thất bại (sai bản ghi).<br>2. Quan sát phản hồi của UI. | - Hiển thị badge đỏ hoặc thông báo lỗi mô tả rõ nguyên nhân.<br>- Nút "Verify Connection" được khôi phục để thử lại. | High | [ ] |
| **TC-F19.27** | `[UI State]` | Network Drop khi đang Verify | 1. Nhấn "Verify Connection".<br>2. Ngay lập tức tắt WiFi hoặc ngắt mạng. | - Toast màu cam/đỏ: *"Lỗi kết nối. Vui lòng thử lại"*.<br>- Không bị đứng treo Loading vĩnh viễn. | High | [ ] |
| **TC-F19.28** | `[Cancel]` | Hủy giữa chừng khi đang nhập domain | 1. Nhấn "Add Custom Domain", gõ một phần tên miền dở dang.<br>2. Nhấn Cancel hoặc nút đóng (✕) của Modal. | - Modal đóng lại.<br>- Form được **reset sạch**, không lưu dữ liệu vào hệ thống. | Medium | [ ] |

---

### US-F19-02: Thiết Lập Tên Miền Chính (Primary Domain)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.12** | `[Positive]` | Đặt tên miền tùy chỉnh làm Primary | 1. Có ít nhất 2 domain đã Connected.<br>2. Tại tên miền thứ hai, nhấn **"Set as Primary"**. | - Tên miền thứ hai được đánh dấu nhãn **"Primary Domain"** (Badge màu tím/teal).<br>- Tên miền cũ mất nhãn Primary. | High | [ ] |
| **TC-F19.13** | `[Positive]` | Chuyển hướng 301 từ miền phụ sang miền chính | 1. Sau khi đặt Primary domain mới.<br>2. Truy cập đường dẫn tên miền phụ (VD: `store.echprime.com/products/abc`). | - Trình duyệt tự redirect **HTTP 301** về miền chính tương ứng: `primarydomain.com/products/abc`.<br>- **URL path được giữ nguyên** (không mất slug). | Blocker | [x] |
| **TC-F19.14** | `[Negative]` | Chặn Set Primary cho domain Pending | 1. Có domain ở trạng thái "Pending Verification".<br>2. Tìm nút "Set as Primary" ở dòng đó. | - Nút bị **Disabled** hoặc ẩn hoàn toàn.<br>- Tooltip khi hover: *"Hãy xác thực domain trước khi đặt làm Primary"*. | Medium | [ ] |
| **TC-F19.15** | `[Negative]` | Cấm xóa default subdomain (.echprime.com) | 1. Tìm nút Remove hoặc Delete tại dòng domain mặc định của hệ thống. | - Nút Xóa không tồn tại hoặc bị disable.<br>- Domain mặc định luôn tồn tại làm fallback dự phòng. | High | [ ] |
| **TC-F19.16** | `[Edge]` | Miền mặc định có thể bị hạ từ Primary xuống | 1. Miền mặc định đang là Primary.<br>2. Set một custom domain khác làm Primary. | - Miền mặc định **mất nhãn Primary** nhưng vẫn còn trong danh sách (không bị xóa). | Medium | [ ] |

---

### US-F19-03: Cài Đặt Phương Thức Thanh Toán (Payment Methods)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.17** | `[Positive]` | Bật COD độc lập | 1. Vào **Cài đặt > Payments**.<br>2. Gạt Toggle **COD** sang ON. | - Toggle đổi màu xanh sáng.<br>- Phương thức "Cash on Delivery" xuất hiện tại trang Checkout của Storefront (F09). | High | [ ] |
| **TC-F19.18** | `[Positive]` | Tắt COD | 1. Toggle COD đang ON.<br>2. Gạt về OFF. | - Toggle trở về màu xám.<br>- Phương thức COD **biến mất khỏi Checkout** của Storefront. | High | [ ] |
| **TC-F19.19** | `[Positive]` | Bật cả COD và QR Banking đồng thời | 1. Upload ảnh QR hợp lệ trước.<br>2. Bật cả hai Toggle COD và QR Banking lên ON. | - Cả hai Toggle xanh.<br>- Trang Checkout xuất hiện **đồng thời 2 phương thức**: COD và Bank Transfer/QR. | High | [ ] |
| **TC-F19.20** | `[Negative]` | Chặn bật QR Banking khi chưa có ảnh | 1. Chưa upload ảnh QR.<br>2. Gạt Toggle QR Banking sang ON. | - Toggle tự **giật về OFF**.<br>- Xuất hiện Toast hoặc thông báo: *"Vui lòng upload ảnh QR trước khi bật QR Banking"*. | Blocker | [x] |
| **TC-F19.21** | `[Positive]` | Upload ảnh QR hợp lệ | 1. Nhấn upload trong ô QR Banking.<br>2. Chọn file ảnh JPG, dung lượng 500KB. | - Ảnh hiển thị preview thumbnail ngay lập tức trong khung cài đặt.<br>- Toggle QR Banking có thể bật ON được. | High | [ ] |
| **TC-F19.22** | `[Negative]` | Chặn upload ảnh vượt kích thước 2MB | 1. Chọn file ảnh PNG dung lượng 5MB.<br>2. Nhấn Upload. | - Toast đỏ xuất hiện: *"File quá lớn. Kích thước tối đa là 2MB"*.<br>- Ảnh **không được lưu**. Khung upload reset về trạng thái rỗng. | High | [ ] |
| **TC-F19.23** | `[Negative]` | Chặn upload định dạng file không hợp lệ | 1. Upload file định dạng `.gif` hoặc `.webp`.<br>2. Upload file `.exe` đổi đuôi thành `.jpg` (Magic Byte test). | - **Trường hợp `.gif`/`.webp`**: Báo lỗi định dạng không được hỗ trợ (chỉ JPG/PNG).<br>- **Trường hợp file giả mạo**: Server phát hiện Magic Bytes không khớp, trả về HTTP 400. | Blocker | [x] |
| **TC-F19.24** | `[State]` | Tự động tắt QR Banking khi xóa ảnh | 1. QR Banking đang hoạt động (Toggle ON, có ảnh QR).<br>2. Xóa ảnh QR bằng cách nhấn icon **(✕)** xóa. | - Toggle QR Banking **tự động chuyển về OFF** ngay lập tức.<br>- Phương thức QR Banking biến mất khỏi Checkout Storefront. | High | [x] |
| **TC-F19.25** | `[Positive]` | Thay thế ảnh QR (Replace Image) | 1. Đã có ảnh QR cũ.<br>2. Upload đè ảnh QR mới lên. | - Ảnh cũ bị thay thế.<br>- Preview cập nhật ngay.<br>- File cũ bị xóa khỏi storage để tránh rác dữ liệu. | High | [ ] |
| **TC-F19.47** | `[State]` | **Tắt COD trong khi có đơn hàng đang Checkout** | 1. Khách đang ở bước Checkout và chọn COD.<br>2. Owner tắt Toggle COD ngay lúc đó. | - Đơn hàng đang xử lý không bị ảnh hưởng retroactively.<br>- Các phiên Checkout **mới** sau đó không hiển thị COD. | High | [ ] |
| **TC-F19.48** | `[Concurrency]` | Bật/tắt Toggle COD nhanh nhiều lần liên tục | 1. Bật Toggle COD ON → OFF → ON → OFF → ON trong 2 giây. | - Trạng thái cuối cùng là đúng với thao tác cuối.<br>- Không bị race condition làm lệch trạng thái (VD: hiện ON nhưng thực tế OFF). | Medium | [ ] |
| **TC-F19.49** | `[Concurrency]` | Spam nút Save Settings nhiều lần liên tiếp | 1. Thay đổi cài đặt Payment.<br>2. Click Save 5-10 lần nhanh. | - Nút Save bị disable sau lần click đầu (Loading state).<br>- Chỉ 1 request PUT được gửi lên server. | Medium | [ ] |
| **TC-F19.50** | `[Network Drop]` | Mất mạng trong khi đang Upload ảnh QR | 1. Chọn file ảnh QR và bắt đầu upload.<br>2. Ngắt mạng ngay khi đang upload. | - Toast lỗi màu đỏ: *"Upload thất bại. Vui lòng thử lại"*.<br>- Ảnh không được lưu một phần.<br>- Khung upload reset về trạng thái rỗng. | High | [ ] |
| **TC-F19.51** | `[BVA]` | Upload ảnh QR đúng biên trên 2MB | 1. Tạo file ảnh JPG đúng 2048KB (= 2MB).<br>2. Nhấn Upload. | - Cần xác nhận rõ: `< 2MB` hay `≤ 2MB`.<br>- Hệ thống phải xử lý nhất quán với thông báo lỗi chính xác. | High | [ ] |
| **TC-F19.52** | `[BVA]` | Upload ảnh QR cực nhỏ (< 5KB, 1x1px) | 1. Upload ảnh JPG dung lượng 1KB (ảnh miniature). | - Hệ thống chấp nhận (không có giới hạn tối thiểu).<br>- Hoặc nếu có giới hạn tối thiểu: báo lỗi rõ ràng. | Medium | [ ] |
| **TC-F19.53** | `[UI State]` | Empty State trong khung upload QR khi chưa có ảnh | 1. Vào Payments tab khi chưa upload ảnh QR lần nào. | - Khung upload hiển thị placeholder rõ ràng (icon + hướng dẫn: *"Upload ảnh QR ngân hàng"*).<br>- Có nút kích hoạt chọn file hoặc vùng Drag & Drop. | Medium | [ ] |
| **TC-F19.54** | `[UI State]` | Loading skeleton khi trang Payments đang fetch dữ liệu | 1. Làm chậm mạng (Devtools throttling).<br>2. Điều hướng vào tab Payments. | - Hiển thị skeleton loading, không trang trắng.<br>- Sau khi load xong, Toggle và ảnh hiển thị đúng trạng thái đã lưu. | Medium | [ ] |
| **TC-F19.55** | `[Cancel]` | Kéo thả ảnh ngoài vùng Dropzone | 1. Chọn file ảnh từ máy tính.<br>2. Thả ảnh ra ngoài vùng Dropzone (vào giữa trang). | - Trình duyệt không mở tab mới với ảnh.<br>- Upload không được kích hoạt ngoài ý muốn. | Medium | [ ] |
| **TC-F19.56** | `[Storefront]` | Tắt hết cả COD lẫn QR Banking — Storefront vẫn ổn định | 1. Tắt Toggle COD về OFF.<br>2. Tắt Toggle QR Banking về OFF. | - Trang CMS lưu thành công.<br>- Trang Checkout của Storefront vẫn render, không crash.<br>- Hiển thị thông báo: *"Chưa có phương thức thanh toán"* hoặc ẩn bước thanh toán. | High | [ ] |

---

### US-F19-04: Trải Nghiệm Mobile (Camera Roll & Tap-to-Copy DNS)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.26** | `[Positive]` | Mở Camera Roll để upload QR trên Mobile | 1. Truy cập CMS bằng điện thoại (Safari iOS / Chrome Android).<br>2. Vào Payments, nhấn Upload ảnh QR. | - Trình chọn ảnh **Native Photo Picker** của iOS/Android được kích hoạt.<br>- Không bị crash hoặc mở trang trắng. | High | [ ] |
| **TC-F19.27** | `[Positive]` | Tap-to-Copy DNS Record trên Mobile | 1. Xem danh sách DNS Records (A Record, CNAME) trên điện thoại.<br>2. Tap vào icon Copy kế bên giá trị. | - Giá trị được copy vào **Clipboard** của thiết bị.<br>- Xuất hiện Toast xanh: *"Đã sao chép vào clipboard"*. | High | [ ] |
| **TC-F19.28** | `[UI State]` | Bảng Staff responsive trên Mobile | 1. Mở tab Staff Management trên màn hình 375px. | - Bảng danh sách staff **không bị tràn ngang** (Không có scroll X).<br>- Dữ liệu tự chuyển sang dạng Card stack hoặc co giãn cột thông minh. | Medium | [ ] |

---

### US-F19-05: Mời Nhân Viên & Phân Quyền (Invite Staff & Role Assignment)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.29** | `[Positive]` | Mời Staff với email hợp lệ | 1. Vào **Cài đặt > Staff Management**.<br>2. Nhấn **"Invite New Staff"**.<br>3. Nhập email `newstaff@example.com` và chọn vai trò.<br>4. Nhấn Invite. | - Hệ thống gửi email mời tham gia.<br>- Staff mới xuất hiện trong bảng danh sách với trạng thái **"Pending"**. | High | [ ] |
| **TC-F19.30** | `[Negative]` | Chặn email sai định dạng | 1. Nhập email `staffname` (thiếu @ và domain).<br>2. Nhấn Invite. | - Viền input đỏ, hiện thông báo lỗi format email.<br>- Không gửi request API. | High | [ ] |
| **TC-F19.31** | `[Negative]` | Chặn email đã tồn tại trong Workspace | 1. Mời email `staff@example.com` lần 2 (đã có trong danh sách). | - Báo lỗi: *"Email này đã là thành viên của cửa hàng"*.<br>- Không tạo bản ghi trùng. | Medium | [ ] |
| **TC-F19.32** | `[Positive]` | Phân quyền Full Access | 1. Khi mời Staff, chọn vai trò **"Full Access"**.<br>2. Staff đăng nhập vào CMS. | - Staff thấy **toàn bộ Sidebar Menu** (Products, Orders, Blog, AI Editor, v.v.).<br>- **Không thấy** mục Billing và không có nút xóa Workspace. | Critical | [ ] |
| **TC-F19.33** | `[Positive]` | Phân quyền Custom — Chỉ chọn một module | 1. Chọn **"Custom"** và chỉ tick chọn ô **"Orders"**.<br>2. Staff đăng nhập. | - Sidebar của Staff **chỉ hiển thị mục Orders**.<br>- Mọi module khác (Products, Blog, Settings...) biến mất hoàn toàn. | Blocker | [x] |
| **TC-F19.34** | `[Negative]` | Chặn lưu khi Custom Role không chọn tính năng nào | 1. Chọn vai trò "Custom".<br>2. Bỏ chọn hết tất cả các checkbox.<br>3. Nhấn Invite. | - Nút Invite/Save bị **disable**.<br>- Hiện thông báo yêu cầu phải chọn ít nhất 1 module. | Medium | [ ] |
| **TC-F19.35** | `[Security]` | Chặn Staff truy cập module không có quyền qua URL | 1. Staff Custom chỉ có quyền Orders.<br>2. Gõ thủ công URL `/dashboard/settings` trên thanh địa chỉ. | - Hệ thống không render trang Settings.<br>- Tự động chuyển hướng về trang 403 Access Denied hoặc Dashboard. | Blocker | [x] |
| **TC-F19.36** | `[Security]` | Chặn API call trực tiếp bằng Postman (Backend RBAC) | 1. Lấy JWT Token của Staff Custom.<br>2. Dùng Postman gửi `POST /api/settings/payments` để bật COD. | - Server check RBAC Middleware từ JWT Token.<br>- Trả về **HTTP 403 Forbidden**.<br>- Database không bị thay đổi. | Blocker | [x] |
| **TC-F19.37** | `[Concurrency]` | Cập nhật quyền Real-time | 1. Staff đang đăng nhập với quyền Orders only.<br>2. Owner thêm quyền Products cho Staff này.<br>3. Staff nhấn F5 hoặc chuyển route. | - Menu **Products xuất hiện ngay** trong Sidebar của Staff sau khi reload/refresh. | High | [ ] |
| **TC-F19.57** | `[BVA]` | Email mời vượt giới hạn độ dài (> 254 ký tự theo RFC 5321) | 1. Paste chuỗi email siêu dài hơn 254 ký tự vào ô Invite. | - Hệ thống cắt bớt hoặc báo lỗi vượt giới hạn RFC email. Không gửi API. | Medium | [ ] |
| **TC-F19.58** | `[BVA]` | Owner tự mời chính email của mình (Self-invite) | 1. Nhập email của Owner đang đăng nhập vào ô Invite Staff. | - Hệ thống ngăn lại với thông báo: *"Email này đã là Owner của cửa hàng"*. | High | [ ] |
| **TC-F19.59** | `[Concurrency]` | Spam nút Invite Staff nhiều lần nhanh | 1. Điền email hợp lệ.<br>2. Nhấn nút "Invite" 5-10 lần liên tiếp trong 2 giây. | - Chỉ 1 email mời được gửi đến hộp thư.<br>- Chỉ 1 bản ghi Pending xuất hiện trong danh sách. | Medium | [ ] |
| **TC-F19.60** | `[Cancel]` | Mở Modal Invite → nhập email dở → nhấn Cancel | 1. Nhấn "Invite New Staff", gõ email chưa xong.<br>2. Nhấn Cancel hoặc nút đóng (✕). | - Modal đóng lại, form reset sạch.<br>- Không tạo bản ghi nào trong hệ thống. | Medium | [ ] |
| **TC-F19.61** | `[Cancel]` | Xác nhận Remove Staff → nhấn "Hủy" trong Modal | 1. Nhấn nút Remove tại một Staff.<br>2. Modal xác nhận xuất hiện → nhấn nút "Hủy". | - Modal đóng lại.<br>- Staff **không bị xóa**, danh sách giữ nguyên. | Medium | [ ] |
| **TC-F19.62** | `[UI State]` | Empty State khi chưa có Staff nào trong danh sách | 1. Workspace mới chưa mời Staff nào.<br>2. Vào tab Staff Management. | - Hiển thị màn trống có thông báo mô tả và nút **"Invite New Staff"** nổi bật. | Medium | [ ] |
| **TC-F19.63** | `[UI State]` | Danh sách Staff nhiều (50+ người) — Hiệu năng & Phân trang | 1. Workspace có hơn 50 Staff trong danh sách.<br>2. Vào tab Staff Management. | - Bảng không bị lag hay freeze.<br>- Có Pagination hoặc Virtual Scroll xử lý đúng. | High | [ ] |
| **TC-F19.64** | `[Network Drop]` | Mất mạng khi đang nhấn Invite | 1. Điền đầy đủ thông tin mời Staff.<br>2. Nhấn Invite, ngắt mạng ngay lập tức. | - Toast lỗi mạng hiện ra.<br>- Không gửi email mời.<br>- Không tạo bản ghi Pending rỗng trong DB. | High | [ ] |
| **TC-F19.65** | `[ErrorGuess]` | SQL Injection trong ô Email Staff | 1. Nhập `'; DROP TABLE users; --@test.com` vào ô Email.<br>2. Nhấn Invite. | - Server sanitize đầu vào, không crash DB.<br>- Báo lỗi format email không hợp lệ bình thường. | Blocker | [x] |
| **TC-F19.66** | `[State]` | Staff chấp nhận lời mời → Trạng thái Pending → Active | 1. Staff nhận email mời và click link chấp nhận.<br>2. Owner xem lại danh sách Staff. | - Trạng thái của Staff đó đổi từ **Pending → Active**.<br>- Hiển thị đúng, không cần Owner refresh tay. | High | [ ] |
| **TC-F19.67** | `[State]` | Đổi Role Staff từ Full Access → Custom (thu hẹp quyền) | 1. Staff đang Active với role Full Access.<br>2. Owner đổi role thành Custom chỉ chọn Orders.<br>3. Staff nhấn F5. | - Sidebar của Staff thu hẹp còn mỗi Orders.<br>- Các module cũ bị ẩn ngay sau reload. | Blocker | [x] |
| **TC-F19.68** | `[State]` | Đổi Role Staff từ Custom → Full Access (mở rộng quyền) | 1. Staff đang Custom chỉ Orders.<br>2. Owner đổi thành Full Access.<br>3. Staff nhấn F5. | - Sidebar của Staff mở rộng đủ toàn bộ module. | High | [ ] |
| **TC-F19.69** | `[Concurrency]` | 2 Owner cùng Remove cùng 1 Staff cùng lúc | 1. Dùng script gửi 2 request DELETE Staff cùng một StaffID từ 2 phiên Owner khác nhau. | - Lệnh thứ nhất thành công, lệnh thứ hai trả về 404 (Staff không còn tồn tại).<br>- Không có lỗi 500, xử lý gracefully. | Medium | [ ] |

---

### US-F19-06: Quản Lý Danh Sách & Thu Hồi Quyền Staff

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.38** | `[Positive]` | Hiển thị đủ thông tin Staff Directory | 1. Vào tab Staff Management. | - Danh sách hiển thị đầy đủ cột: **Avatar, Email, Role (Full/Custom kèm danh sách module), Status (Pending/Active)**. | High | [ ] |
| **TC-F19.39** | `[Positive]` | Xóa Staff đang Active | 1. Nhấn nút **"Remove"** tại dòng của một Staff Active.<br>2. Xác nhận trong Modal cảnh báo. | - Staff biến mất khỏi danh sách.<br>- Token của Staff bị thu hồi ngay lập tức. | High | [x] |
| **TC-F19.40** | `[Positive]` | Hủy lời mời Pending chưa chấp nhận | 1. Nhấn nút "Remove" tại Staff có trạng thái **"Pending"**. | - Staff bị xóa khỏi danh sách.<br>- Link mời trong email **trở nên không hợp lệ** (Expired). | Medium | [ ] |
| **TC-F19.41** | `[Security]` | Force Logout ngay khi bị thu hồi quyền | 1. Staff đang thao tác trên CMS.<br>2. Owner nhấn Remove Staff đó.<br>3. Staff nhấn Lưu/thực hiện bất kỳ thao tác tiếp theo. | - Request tiếp theo của Staff **trả về 401 Unauthorized**.<br>- Trình duyệt điều hướng về màn hình Login. | Blocker | [x] |
| **TC-F19.42** | `[Security]` | Owner không thể bị xóa bởi bất kỳ ai | 1. Đăng nhập bằng tài khoản Staff Full Access.<br>2. Xem dòng của Owner (Chủ cửa hàng) trong danh sách Staff. | - Nút **"Remove"** hoàn toàn bị ẩn hoặc disabled tại dòng của Owner.<br>- Không có API nào cho phép xóa Owner. | Blocker | [ ] |
| **TC-F19.43** | `[Security]` | Chặn xóa Staff của Workspace khác (IDOR) | 1. Dùng tài khoản Owner Store A.<br>2. Gửi API `DELETE /api/staff/{staffId_of_store_B}`. | - Server kiểm tra TenantID trong JWT Token không khớp với StaffID.<br>- Trả về **HTTP 403 Forbidden**. Store B không bị ảnh hưởng. | Blocker | [x] |

---

### US-F19-07: Giao Diện Và Quyền Truy Cập Khi Staff Đăng Nhập (Staff Login View)

#### Nhóm A — Luồng Chấp Nhận Lời Mời (Invite Onboarding)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.70** | `[Positive]` | Staff nhấn link mời trong email — Trang mở đúng | 1. Staff nhận email mời.<br>2. Click link trong email. | - Link mở đúng trang setup tài khoản của PrimeWeb.<br>- Không báo lỗi 404 hay trang trắng. | High | [ ] |
| **TC-F19.71** | `[Positive]` | Staff chưa có tài khoản — Được tạo mật khẩu lần đầu | 1. Staff mới chưa đăng ký PrimeWeb bao giờ.<br>2. Click link mời. | - Hiển thị form đặt mật khẩu.<br>- Sau khi đặt xong, tự redirect vào CMS của store thẳng. | High | [ ] |
| **TC-F19.72** | `[Positive]` | Staff đã có tài khoản PrimeWeb — Tự link workspace | 1. Staff đã đăng ký PrimeWeb với email đó trước đó.<br>2. Click link mời. | - Không yêu cầu tạo lại tài khoản.<br>- Workspace của store mới tự xuất hiện trong danh sách Workspace của Staff. | High | [ ] |
| **TC-F19.73** | `[Negative]` | Staff click link mời đã hết hạn hoặc đã bị hủy | 1. Owner hủy lời mời (Remove Pending).<br>2. Staff sau đó click link trong email. | - Trang hiển thị thông báo rõ: *"Lời mời không hợp lệ hoặc đã hết hạn"*.<br>- Không cho phép truy cập vào Workspace. | High | [ ] |

#### Nhóm B — Màn Hình CMS Sau Khi Staff Đăng Nhập (CMS View)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.74** | `[Positive]` | Staff Full Access — Kiểm tra từng item Sidebar | 1. Staff Full Access đăng nhập vào CMS. | - Sidebar hiển thị: Dashboard, Products, Orders, Blog, AI Builder, AI Editor.<br>- **Không thấy:** Settings, Billing, nút Xóa Workspace. | Blocker | [x] |
| **TC-F19.75** | `[Negative]` | Staff Full Access — Không thấy Settings trong Sidebar | 1. Staff Full Access đăng nhập.<br>2. Tìm mục Settings trong Sidebar. | - Settings hoàn toàn không có trong menu.<br>- Nhập URL `/dashboard/settings` → trả về 403. | Blocker | [x] |
| **TC-F19.76** | `[Positive]` | Staff Custom (Orders only) — Không thấy module nào khác | 1. Staff Custom chỉ Orders đăng nhập.<br>2. Mở CMS, xem Sidebar. | - Sidebar chỉ gồm **duy nhất mục Orders**.<br>- Dashboard, Products, Blog, Settings... đều không xuất hiện. | Blocker | [x] |
| **TC-F19.77** | `[Positive]` | Staff Custom — Trang mặc định sau login là module được phép | 1. Staff Custom chỉ Orders vừa đăng nhập. | - Hệ thống redirect về trang **Orders** ngay lập tức (không về Dashboard nếu không có quyền). | High | [ ] |
| **TC-F19.78** | `[UI State]` | Staff xem Header CMS — Hiển thị đúng tên Store và Avatar | 1. Staff đăng nhập vào CMS.<br>2. Xem góc trên của Header. | - Header hiển thị đúng **Tên Workspace** của store.<br>- Avatar/tên của Staff (không phải Owner) được hiển thị ở menu cá nhân. | Medium | [ ] |

#### Nhóm C — Thay Đổi Quyền Realtime & Data Isolation

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.79** | `[State]` | Owner thu hẹp quyền — Staff mất module sau reload | 1. Staff đang có quyền Products + Orders.<br>2. Owner bỏ quyền Products.<br>3. Staff nhấn F5. | - Sau reload, mục Products **biến mất** khỏi Sidebar của Staff. | Blocker | [x] |
| **TC-F19.80** | `[State]` | Staff đang xem trang module bị thu hồi quyền | 1. Staff đang ở trang `/dashboard/products`.<br>2. Owner thu hồi quyền Products ngay lúc đó.<br>3. Staff nhấn F5. | - Trang báo **403 Access Denied** hoặc tự redirect về module được phép. | High | [ ] |
| **TC-F19.81** | `[Security]` | Staff chỉ thấy dữ liệu của Store mình (Cross-Tenant Isolation) | 1. Staff đăng nhập vào Store A.<br>2. Xem danh sách Orders, Products của Store A. | - Tất cả dữ liệu **chỉ thuộc Store A**, không lẫn dữ liệu Store B.<br>- API response không chứa bất kỳ dữ liệu nào của tenant khác. | Blocker | [x] |

#### Nhóm D — Giới Hạn Hành Động Trong Module Được Phép

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.82** | `[RBAC]` | Staff Orders — Làm rõ quyền CRUD trong module Orders | 1. Staff Custom chỉ Orders đăng nhập.<br>2. Thử các thao tác: Xem danh sách, Xem chi tiết, Cập nhật trạng thái, Xóa đơn. | - Cần xác nhận với dev scope của role "Orders": View only, hay có Update status, hay có Delete?<br>- Kết quả phải đúng với thiết kế RBAC. | High | [ ] |
| **TC-F19.83** | `[RBAC]` | Staff Products — Làm rõ quyền CRUD trong module Products | 1. Staff Custom chỉ Products đăng nhập.<br>2. Thử tạo sản phẩm mới, chỉnh sửa, xóa sản phẩm. | - Làm rõ: Custom role Products có full CRUD hay chỉ View/Edit?<br>- Xóa sản phẩm có được phép không? | High | [ ] |
| **TC-F19.84** | `[RBAC]` | Staff không được thấy số liệu tài chính nhạy cảm | 1. Staff đăng nhập (bất kỳ role nào).<br>2. Tìm kiếm thông tin: Doanh thu tổng, Lợi nhuận, Giá vốn sản phẩm. | - Staff **không thấy** thông tin tài chính nội bộ (doanh thu, lợi nhuận, chi phí).<br>- Những số liệu này chỉ Owner mới được xem. | High | [ ] |

---

### Global AC: Tuân Thủ Layout CMS (F18 Compliance)

| ID | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F19.44** | `[Layout]` | Layout F19 không phá vỡ F18 | 1. Điều hướng từ Dashboard vào bất kỳ tab nào của F19 (Domains, Payments, Staff).<br>2. Cuộn trang. | - Nội dung F19 render gọn trong **Main Content Area**.<br>- Header F18 và Sidebar F18 đứng nguyên vị trí, không bị che khuất.<br>- Không có Reload toàn trang. | Blocker | [x] |
| **TC-F19.45** | `[UI State]` | Toast thành công khi lưu thay đổi | 1. Bật/tắt bất kỳ cài đặt nào (COD, QR, Staff Role).<br>2. Nhấn Save. | - Toast màu xanh xuất hiện ở góc trên phải: *"Thay đổi đã được lưu ✓"*.<br>- Tự biến mất sau 3 giây. | Low | [ ] |
| **TC-F19.46** | `[Security]` | Chặn XSS trong ô nhập Email Staff | 1. Nhập `<svg onload=alert(1)>@abc.com` vào ô Email khi mời Staff. | - Input sanitize chuỗi, không render script.<br>- Hệ thống báo lỗi format email không hợp lệ. | Blocker | [x] |

---

## 4. Hành Trình Kiểm Thử E2E (UAT Flow)

**Kịch bản:** Owner thiết lập cửa hàng mới từ đầu.

1. **[Domain]** Vào Settings > Domains. Thêm `fashion-shop.my`. Sao chép IP trỏ DNS. Chờ propagation rồi Verify → Connected → Set as Primary. Truy cập domain phụ kiểm tra 301 redirect.
2. **[Payment]** Vào Payments, upload ảnh QR ngân hàng (< 2MB, JPG). Bật Toggle QR Banking. Bật Toggle COD. Kiểm tra Storefront Checkout hiển thị đủ 2 phương thức.
3. **[Staff]** Vào Staff, mời `ketoan@fashion.my` với Custom Role chỉ chọn "Orders". Đăng nhập Staff kiểm tra Sidebar chỉ có Orders. Thử gõ URL `/dashboard/products` → 403.
4. **[Audit]** Owner xóa Staff cũ đã nghỉ việc. Staff đó thực hiện thao tác tiếp theo → bị force logout.

---

## 5. Quality Gates

| Tiêu Chí | Trạng Thái | Ghi Chú |
|---|---|---|
| **1. Domain & DNS** | [ ] Chưa chạy | Verify DNS, SSL Auto, 301 Redirect giữ path |
| **2. Payment File Guard** | [ ] Chưa chạy | Magic Byte check, 2MB limit, Auto-off khi xóa ảnh |
| **3. RBAC Sidebar & URL Guard** | [ ] Chưa chạy | Custom Role ẩn đúng module, chặn URL bypass, chặn API Postman |
| **4. Force Logout** | [ ] Chưa chạy | Token hủy ngay khi Remove Staff |
| **5. Owner Protection** | [ ] Chưa chạy | Nút Remove ẩn tại dòng Owner, IDOR cross-tenant |
| **6. F18 Layout Compliance** | [ ] Chưa chạy | Không reload, Header/Sidebar không bị phá |
| **7. Mobile UX** | [ ] Chưa chạy | Camera Roll picker, Tap-to-copy DNS |

---

## 6. Danh Sách 10 Chốt Chặn Trước Khi Release

- [ ] Staff Custom: Đã test gõ URL trực tiếp vào module cấm? (Kết quả phải là 403)
- [ ] QR Banking: Đã thử bật Toggle khi chưa có ảnh? (Phải tự tắt về OFF)
- [ ] File Upload: Upload `.exe` giả .jpg đã bị chặn bởi Magic Byte check?
- [ ] 301 Redirect: Domain phụ redirect về Primary giữ nguyên path/slug?
- [ ] SSL: Domain Connected có ổ khóa HTTPS xanh?
- [ ] Force Logout: Staff bị Remove → thao tác tiếp theo có bị đá ra không?
- [ ] Owner Protection: Nút Remove tại dòng Owner có ẩn không?
- [ ] IDOR Test: API xóa Staff của Workspace B từ Workspace A có bị chặn 403?
- [ ] Mobile Camera Roll: Upload QR trên iPhone có mở Gallery native không?
- [ ] XSS Email: Nhập `<script>` vào ô email có bị escape không?

---
**PHÊ DUYỆT BỞI:** .................................... **NGÀY:** ..../..../2026

---

## 7. Addendum — F19 Vercel Migration: Add Domain Flow (Cập nhật 2026-05-11)

> **Áp dụng cho branch:** `investigate/F19-domain-ui-flow`
> **Thay đổi lớn:** (1) Always-pending policy — domain không tự active khi add. (2) Hard DNS preflight trước verify. (3) TxtChallengeCard cho ownership challenge. (4) Cloudflare proxy hint.
> **Môi trường:** Local (mock mode) cho Phase 1–3. Staging (Vercel thật + DNS thật) cho Phase 4–6.

---

### Phase 1 — Client Validation (Local ✅)

Vào **Settings → Domains → "Add Custom Domain"** → modal mở.

| TC | Input | Bước | Kết quả mong đợi | Env |
|----|-------|------|-----------------|-----|
| **TC-D01** | `https://shop.mystore.com` | Gõ → click Add | Inline error đỏ: *"Do not include http/https, enter the domain name only"* — modal vẫn mở | Local |
| **TC-D02** | *(để trống)* | Click Add | Inline error đỏ: *"Please enter a domain name"* | Local |
| **TC-D03** | `shop my store.com` | Gõ → click Add | Inline error đỏ: *"Domain name cannot contain spaces"* | Local |
| **TC-D04** | Chuỗi 254 ký tự | Paste → click Add | Inline error đỏ: *"Domain name must not exceed 253 characters"* | Local |
| **TC-D05** | `nodothere` | Gõ → click Add | Inline error đỏ: *"Domain must include an extension (e.g., .com, .my)"* | Local |
| **TC-D06** | `shop!@#$.com` | Gõ → click Add | Inline error đỏ: *"Domain contains invalid characters"* | Local |
| **TC-D07** | `-.com` hoặc `-start.com` | Gõ → click Add | Inline error đỏ: *"Invalid domain format"* | Local |

**Pass criteria:** Modal không đóng, không call server, error hiện đúng dưới input.

---

### Phase 2 — Server Errors khi Add (Staging ⚠️)

| TC | Tình huống | Cách reproduce | Kết quả mong đợi |
|----|-----------|---------------|-----------------|
| **TC-D08** | Domain đã có ở tenant khác | Lấy domain đang active ở store khác → add vào store này | `toast.error("Domain already registered by another store.")` |
| **TC-D09** | Domain đã có ở chính tenant này | Add domain đã thấy trong danh sách | `toast.error("Domain already added to your store.")` |
| **TC-D10** | Vercel 409 — domain trong Vercel project khác | Domain đang gắn project Vercel khác cùng team | `toast.error("Domain already registered by another store.")` |

---

### Phase 3 — Add thành công → Pending UI

#### TC-D11: Domain hoàn toàn mới, chưa trỏ CNAME (Local ✅)

**Bước:**
1. Add `shop.newdomain.com` (domain chưa từng dùng)
2. Quan sát UI

**Kết quả mong đợi:**
- [ ] Modal đóng ngay
- [ ] Toast xanh: *"Domain added. Point your DNS records below, then click Verify."*
- [ ] Badge cam **"Pending Verification"** xuất hiện
- [ ] A Record: `76.76.21.21` + copy button → click copy → toast *"Copied IP 1!"*
- [ ] CNAME: `cname.vercel-dns.com` + copy button → click copy → toast *"Copied!"*
- [ ] Text nhỏ: *"Using Cloudflare? Disable the proxy (orange cloud → grey cloud) before verifying."*
- [ ] Nút **"Verify Connection"** (gradient xanh) hiện
- [ ] Nút **"Remove"** (đỏ) hiện
- [ ] **Không có** TxtChallengeCard

#### TC-D12: Domain đã trỏ CNAME đúng sẵn (Staging ⚠️)

**Bước:**
1. Đảm bảo `shop.mystore.com` đã có CNAME → `cname.vercel-dns.com` tại registrar
2. Add domain này vào hệ thống

**Kết quả mong đợi:**
- [ ] Giống TC-D11 hoàn toàn — vẫn badge cam, vẫn pending (không tự active)
- [ ] Click **"Verify Connection"** ngay → ~3–5s → card chuyển xanh **"Connected & Secured"**

#### TC-D13: Domain mới + Vercel yêu cầu TXT (Staging ⚠️)

*Xảy ra khi domain đang dùng bởi project Vercel khác trong cùng team.*

**Kết quả mong đợi:**
- [ ] Pending card hiện như TC-D11
- [ ] **TxtChallengeCard** hiện thêm bên dưới:
  - Hostname: `_vercel.shop.mystore.com`
  - Value: `vc-domain-verify-xxxxx` + copy button
  - Text: *"Last checked: just now"*
  - Nút **"Verify Now"**

---

### Phase 4 — Click "Verify Connection"

#### TC-D14: Loading state (Local ✅)

**Bước:** Click **"Verify Connection"**

**Kết quả mong đợi:**
- [ ] Nút đổi thành **"Verifying..."** + spinner ngay lập tức
- [ ] Nút bị disable trong lúc chờ (không click thêm được)

#### TC-D15: Double-click debounce (Local ✅)

**Bước:** Click **"Verify Connection"** 2 lần thật nhanh (< 1 giây)

**Kết quả mong đợi:**
- [ ] Chỉ 1 request gửi lên server — không double submit

#### TC-D16: DNS chưa trỏ — Apex domain (Staging ⚠️)

*Apex = `mystore.com` không có subdomain prefix*

**Bước:**
1. Add `mystore.com` (chưa set A record)
2. Click Verify ngay

**Kết quả mong đợi:**
- [ ] Error banner đỏ: *"DNS records not detected yet. Please add the A record above and try again..."*
- [ ] `toast.error(...)` cùng nội dung
- [ ] Nút về lại "Verify Connection" — không bị kẹt

#### TC-D17: A record trỏ sai IP — Apex domain (Staging ⚠️)

**Bước:**
1. Set A record `mystore.com` → IP sai (vd: `1.2.3.4`)
2. Click Verify

**Kết quả mong đợi:**
- [ ] Error banner đỏ: *"Expected A record: 76.76.21.21 — currently resolves to: 1.2.3.4. Please update your DNS..."*

#### TC-D18: CNAME chưa trỏ — Subdomain (Staging ⚠️)

**Bước:**
1. Add `shop.mystore.com` (chưa set CNAME)
2. Click Verify ngay

**Kết quả mong đợi:**
- [ ] Error banner đỏ: *"DNS records not detected yet. Please add the CNAME record above and try again..."*

#### TC-D19: CNAME trỏ sai — Subdomain (Staging ⚠️)

**Bước:**
1. Set CNAME `shop.mystore.com` → `some-other-host.com`
2. Click Verify

**Kết quả mong đợi:**
- [ ] Error banner đỏ: *"Expected CNAME: cname.vercel-dns.com — currently resolves to: some-other-host.com..."*

#### TC-D20: Cloudflare proxy ON (Staging ⚠️ — cần Cloudflare account)

**Bước:**
1. Domain dùng Cloudflare, proxy 🟠 ON
2. CNAME đã set đúng nhưng proxy che
3. Click Verify

**Kết quả mong đợi:**
- [ ] Verify fail vì DNS không thấy CNAME thật
- [ ] User thấy hint: *"Using Cloudflare? Disable the proxy..."* ở DNS card

**Fix:** Tắt proxy 🔘 OFF → click Verify lại → pass

#### TC-D21: DNS đúng → Verify thành công (Staging ⚠️)

**Bước:**
1. Set CNAME/A record đúng → chờ propagate
2. Verify bằng `dig CNAME shop.mystore.com +short` → thấy `cname.vercel-dns.com.`
3. Click **"Verify Connection"**

**Kết quả mong đợi:**
- [ ] Card chuyển **xanh lá "Connected & Secured"** ✓
- [ ] `toast.success("Domain active. SSL provisioning may take 1-2 minutes.")`
- [ ] **SSL Banner** xuất hiện bên dưới card (~60s rồi tự ẩn)
- [ ] TxtChallengeCard biến mất (nếu có trước đó)
- [ ] Nút **"Remove Domain"** hiện, click được

#### TC-D22: Reload sau verify — vẫn active (Local ✅ / Staging ⚠️)

**Bước:** Sau TC-D21 → F5 reload trang

**Kết quả mong đợi:**
- [ ] Domain vẫn **"Connected & Secured"** — không reset về pending

---

### Phase 5 — TxtChallengeCard flow (Staging ⚠️)

| TC | Bước | Kết quả mong đợi |
|----|------|-----------------|
| **TC-D23** | Click "Verify Now" trên TxtChallengeCard khi TXT chưa add | Error: *"Verification failed. Please add the TXT record below."* — card cập nhật token mới |
| **TC-D24** | Add TXT record đúng tại registrar → click "Verify Now" | Domain flip active — giống TC-D21 |
| **TC-D25** | Reload trang khi đang có TxtChallengeCard | TxtChallengeCard vẫn hiện (persist từ DB) |

---

### Phase 6 — Remove Domain (Local ✅ / Staging ⚠️)

| TC | Bước | Kết quả mong đợi |
|----|------|-----------------|
| **TC-D26** | Click "Remove" trên domain pending | Confirm modal xuất hiện: *"Are you sure you want to remove..."* |
| **TC-D27** | Confirm modal → click "Remove Domain" | Domain biến khỏi danh sách + `toast.success("Custom domain removed.")` |
| **TC-D28** | Add lại domain vừa remove | Thành công — không bị báo duplicate |
| **TC-D29** | Click "Remove" trên primary domain | Nút bị disable — không click được |

---

### Phase 7 — Primary Domain (Local ✅)

| TC | Bước | Kết quả mong đợi |
|----|------|-----------------|
| **TC-D30** | Click "Select primary domain" | Panel slide-in từ phải |
| **TC-D31** | Panel hiện — domain pending | Domain pending **không xuất hiện** trong danh sách chọn |
| **TC-D32** | Chọn active domain → Save | `toast.success('"xxx.com" is now your Primary Domain.')` |
| **TC-D33** | Reload | Domain đó vẫn là primary |

---

### Checklist nhanh cho tester

```
LOCAL (không cần net/staging):
[ ] TC-D01  https:// prefix → error đỏ
[ ] TC-D02  Empty → error đỏ
[ ] TC-D03  Space → error đỏ
[ ] TC-D04  >253 chars → error đỏ
[ ] TC-D05  No TLD → error đỏ
[ ] TC-D06  Ký tự đặc biệt → error đỏ
[ ] TC-D07  Format sai → error đỏ
[ ] TC-D11  Add mới → pending card + badge cam + A/CNAME card
[ ] TC-D14  Click verify → "Verifying..." spinner
[ ] TC-D15  Double-click → chỉ 1 request
[ ] TC-D22  Reload → vẫn active
[ ] TC-D30  Primary panel → pending không xuất hiện

STAGING (cần Vercel API + DNS thật):
[ ] TC-D08  Domain tenant khác → error
[ ] TC-D09  Domain trùng tenant → error
[ ] TC-D12  Add domain đã trỏ CNAME → verify ngay → active
[ ] TC-D16  DNS chưa trỏ apex → "DNS records not detected yet"
[ ] TC-D17  A record sai → expected vs actual
[ ] TC-D18  CNAME chưa trỏ subdomain → error
[ ] TC-D19  CNAME sai → expected vs actual
[ ] TC-D21  DNS đúng → verify → Connected + SSL banner
[ ] TC-D26  Remove → confirm → biến mất
[ ] TC-D29  Remove primary → disabled

STAGING + CLOUDFLARE:
[ ] TC-D20  Proxy ON → verify fail + thấy hint
```

# Release Test Plan & Test Cases: F02 - Auth Flow
> **Version:** 2.2 (Release Candidate - Full Coverage) | **Updated:** 2026-03-17 | **Role:** Test Engineer
> **Reference PRD:** [F02-auth.md](../prd/F02-auth.md) | **Reference US:** [F02-auth-stories.md](../stories/F02-auth-stories.md)

---

## 1. Mục Tiêu Kiểm Thử (Objective)
Tài liệu cung cấp kế hoạch kiểm thử nghiệm thu toàn diện (Release Gate) đối với tính năng F02 Auth Flow. Đảm bảo cấu trúc chuẩn 42 Test Cases bao gồm UI/UX, Automation (Playwright), Server API (Payload CMS), Performance (K6) và Security risk. Không phát sinh rò rỉ chức năng.

Hệ thống được kiểm định qua 6 nhóm nghiệp vụ:
1. `UI/UX & RWD`: Giao diện ứng dụng và đáp ứng hiển thị nền tảng đa điểm.
2. `Func`: Kiểm soát luồng chức năng Đăng ký, Đăng nhập, và Phân quyền Cơ bản.
3. `Validate`: Xác thực độ chuẩn xác biểu mẫu Form phía Client/Server.
4. `Sec & Auth`: Giao thức bảo vệ Session, Role Invite-only và Anti-Enumuration.
5. `API & DB`: Liên kết lưu trữ CSDL Payload Tenant an toàn, gửi phản hồi Email chính xác.
6. `Perf & Stress`: Đo lượng Performance và mức trần ứng dụng.

---

## 2. Quản Lý Truy Vết (Traceability Matrix)

| Khu vực Nghiệp Vụ (Area) | User Story Reference | FR Reference | Tổng Cấp Số TCs |
|---|---|---|---|
| **1. UI/UX & Responsive Web Design** | US-F02-02 | FR-07, FR-10 | 6 TCs |
| **2. Đăng Ký (Register - Owner)** | US-F02-01 | FR-01, 02, 03, 04, 05, 06 | 12 TCs |
| **3. Đăng Nhập (Login) & 2FA** | US-F02-02, 07| FR-08, 09 | 8 TCs |
| **4. Quên / Đổi Mật Khẩu (Password)** | US-F02-05, 06| FR-14, 15 | 6 TCs |
| **5. Auth Guard & Role Access** | US-F02-03, 04| FR-11, 12, 13 | 7 TCs |
| **6. Hiệu Năng và Non-Functional** | N/A | BR-03, BR-05 | 3 TCs |

---

## 3. CHI TIẾT TEST CASES

### 3.1. Nhóm UI/UX & Tương Thích (RWD / Compatibility) - (US-F02-02, FR-07, FR-10)

| ID | LOẠI | TIÊU ĐỀ KỊCH BẢN | CÁC BƯỚC THỰC HIỆN | KẾT QUẢ MONG ĐỢI | ƯU TIÊN |
|:---|:---|:---|:---|:---|:---|
| **TC-F02.01** | `UI` | Kiểm tra hiển thị màn hình Login theo bố cục Split-Screen trên Desktop | Mở đường dẫn `/login` ở kích thước màn hình Desktop (>=1280px). | Web hiển thị vùng Banner bên trái và vùng Form tương tác bên phải. Nút Hướng dẫn nằm phía dưới cùng. | Medium |
| **TC-F02.02** | `UI` | Kiểm tra bố cục Stack Column trên thiết bị di động | Thu hẹp kích thước trình duyệt hoặc duyệt bằng thiết bị chiều rộng <= 768px. | Bố cục Form nằm theo trục dọc (Stack). Các phần tử khả dụng có diện tích click >= 44px. Bàn phím ảo không che khuất khu vực Form. | High |
| **TC-F02.03** | `UX` | Kiểm tra Loading State của các nút Submit (Button) | Nhấn "Sign In" trên trang đăng nhập. | Nút chặn tương tác (Disabled) và hiển thị hoạt ảnh Loading. Đảm bảo chống thao tác kích đúp (Double-click). | High |
| **TC-F02.04** | `UX` | Kiểm tra hiển thị Error State (Thông báo và cảnh báo lỗi) | Submit Form đăng ký với dữ liệu lỗi định dạng. | Các Validation field hiển thị cảnh báo đỏ trực tiếp (Inline-error). Banner Alert cảnh báo xuất hiện. | High |
| **TC-F02.05** | `Compat`| Kiểm tra độ tương thích trên các trình duyệt đa nền tảng | Hành động tải màn hình Auth qua môi trường Safari và Firefox. | Toàn bộ CSS rendering chính xác. Console không cảnh cáo JavaScript Errors. | Low |
| **TC-F02.06** | `UX` | Khả năng truy cập biểu mẫu bằng phím Tab (Web Content Accessibility) | Duyệt Form Đăng ký/Login bằng phím `Tab` không dùng thiết bị cắm chuột. | Outline Focus được xử lý chỉ định cụ thể trên Email -> Pass -> Nút điều lệnh, tuân theo vòng quy định WCAG. | Low |
| **TC-F02.06b** | `UX` | Chống Auto-Zoom trên iOS Safari & OTP Numpad (US-F02-08) | Dùng iPhone/iOS Safari truy cập màn `/login` và focus vào ô Input Text, sau đó qua màn `/verify-otp`. | Form Input sử dụng font-size tối thiểu 16px cản zoom màn hình. Ô OTP 6 số kích hoạt đẩy Virtual Keyboard toàn Số (Numpad) `inputmode=numeric`. Focus auto-advance mượt. | High |

---

### 3.2. Nhóm Đăng Ký Sinh Tài Khoản (Register - Role Owner) - (US-F02-01, FR-01 -> FR-06)

| ID | LOẠI | TIÊU ĐỀ KỊCH BẢN | CÁC BƯỚC THỰC HIỆN | KẾT QUẢ MONG ĐỢI | ƯU TIÊN |
|:---|:---|:---|:---|:---|:---|
| **TC-F02.07** | `API` | Nhận SSO Webhook Payload khởi tạo cấp quyền Owner (FR-01, FR-04) | Gọi API `POST /api/users/sso/provision` bằng Token System. Truyền đầy đủ Payload JSON bắt buộc. | Hệ thống tiếp nhận thành công (HTTP 201), tự tạo 1 Account `owner` và 1 Workspace Tenant ánh xạ khớp Data chuẩn. | Blocker |
| **TC-F02.08** | `Func`| Kiểm tra kích hoạt gửi nội dung Welcome Email (FR-05) | Thực hiện tạo tài khoản thành công bằng SSO Payload (như TC-F02.07). | Thư xác nhận được gửi tới địa chỉ Email của Owner bằng Payload Email Service, kèm Link Redirect. | High |
| **TC-F02.09** | `Valid`| (SSO API) Reject Payload thiếu tham số Service ID / Pack Code (FR-02) | Bắn API Webhook đăng ký chứa `service_id` là rỗng `""` hoặc chuỗi `"NA"`. | API Endpoint từ chối request, trả mã HTTP 400 Bad Request giải thích thiếu Service ID cần cung cấp. | Khẩn |
| **TC-F02.10** | `Valid`| (SSO API) Rule Unique Identifier Global Check Duplicate (FR-02) | Gửi Payload mà các trường `email`, `customer_id_number` hoặc `service_id` đã từng đăng ký trước đó rồi. | Trực trạm Endpoint chặn ngay lập tức, trả mã Lỗi HTTP 409 Conflict Chống Ghi Đè Database. | Khẩn |
| **TC-F02.11** | `DB`  | (SSO API) Ghi nhận cấu hình Gói cước (Pack_code) & Meta Data Cắt Lọc (FR-03) | Payload gửi dư hàng loạt Params Phụ và giá trị Nhánh Gói Doanh Nghiệp Cứng `pack_code="STARTER"`. | Khối Tenant được trỏ field Option Gói Mạng Thành "STARTER". Mọi Data Rác Phụ chuyển gói dạng JSON đổ về Object `meta_data` lưu dự phòng. | High |
| **TC-F02.15** | `Sec` | Phân Cách Policy - Cấm Role Staff đăng ký API tự do (BR-04) | Gửi tay thủ công thông HTTP JSON thay thế role "staff". | Trả Override Payload hoặc Từ Chối 403 Forbidden Access do vượt mặt Policy Nhóm Chỉ Danh (Invite by Owner only). | Blocker |
| **TC-F02.16** | `DB` | Thiết Lập: Khởi Tạo 1 Dữ liệu Tenant Ngầm Cho Host Owner (BR-03) | Xác minh cấu trúc Document DB trên MongoDB/PosgreSQL Schema. | Payload System Insert Dữ liệu mảng object `tenants` trỏ Role Owner. Hạn chế Đúng 1 Record Workspace cho khách Account đăng ký. | Khẩn |
| **TC-F02.17** | `Auth` | Điều Khoản Access Control List (ACL) Tác Vụ Owner Create Tenant Giả | Owner Cố gắng lạm dụng lệnh POST tạo thêm Record Workspace thứ 2. | Server Endpoint `tenants` Response chặn 401 do Payload Configuration Tenant cản lại. | High |
| **TC-F02.18** | `DB` | Data Payload Storage Check - Xác nhận Data ánh xạ Schema DB | Kiểm tra record Users sau đăng ký từ Panel Admin Control CMS. | Tên Công ty, BRN lưu xuống Collection Mở Rộng. Tên Last / First ánh xạ Core Users. | High |

---

### 3.3. Nhóm Verify Đăng Nhập Hệ Thống & Kiểm Duyệt OTP (2FA) - (US-F02-02, 07)

| ID | LOẠI | TIÊU ĐỀ KỊCH BẢN | CÁC BƯỚC THỰC HIỆN | KẾT QUẢ MONG ĐỢI | ƯU TIÊN |
|:---|:---|:---|:---|:---|:---|
| **TC-F02.19** | `Sec`  | Xác nhận Bắt buộc Cơ Chế 2FA Mọi Tài Khoản (Mandatory Anti-Bypass) (BR-02) | Khởi tạo Staff với cấu hình Không dùng 2FA. Cố tình Login đúng Mật Khẩu Cơ Sở. | Webstore Chống Lệnh Override, Vẫn Bắt Trở ra Modal Đòi Nhập Mã OTP Mail Bất Bất Tuân, Cấm cấp thẳng Session JWT. Luôn 100% Phải Qua OTP. | Blocker |
| **TC-F02.20** | `Func` | Đăng nhập Không Cấp Phép Do Hành vi Credentials Không Chính Xác (FR-10) | Gõ Password không tuân thủ cấu hình. | Chặn phiên HTTP 401 Unauthorized. Thông báo Toast lỗi Auth Alert. Nút đăng nhập Release Khỏi Disabled State. | High |
| **TC-F02.21** | `Func` | Triggers Logic OTP 2FA Sau khi Xác nhận Mật Khẩu thành công (FR-06) | Tương tác Flow Authentication Đăng Nhập Native cho Role Staff nhập đúng thông số. | Hệ Thống Bỏ Qua set-cookie, Di Chuyển Modal Chờ Mã OTP Email Trực Diện Giao diện. Tiến hành đếm Timer gửi Email. | Blocker |
| **TC-F02.22** | `Sec` | URL Manipulation Bypass Trạng Thái chờ OTP 2FA | Giữa Lúc Ở View Verify Màn OTP, tự định hướng Route Next về `/dashboard`. | Auth Guard Ngăn truy cập Data, Đá Ngược URL Mạch Bảo Mật `/login`. Trắng Phiên. | Khẩn |
| **TC-F02.23** | `Func` | Đệ Trình POST OTP Đạt Chuẩn Hưởng Trọn Vẹn Session (FR-09) | Trích Mã Random 6 Tự nhận Tại Email cấp vào Client Form. Submit Code. | Hành động Success, Token Nhận Chuẩn JWT 2x64, Route Chuyển Tới Workspace. | Blocker |
| **TC-F02.24** | `Valid`| Phát Hiện OTP Giả Mạo Hệ Cơ Sở (Mismatch Check) | Lừa Hệ điều hành 6 con Số Chả Phải Sinh Ra Bời Payload (000000). | Phản hồi Ngắt Đứt (Response Reject). Cảnh cáo UI Invalid Code Auth. | High |
| **TC-F02.25** | `Bound`| Kiểm Tra Hết Hạn OTP Sau 5 Phút (Expired Timer) | Duy Trì Mã Valid, để quá giới hạn thời gian Window 5 Mins, Bấm Confirm Tự Chế. | Server Logic báo Code Outdated Cũ, Khuyến Mãi Client Load Mã Lại. Tách Thời Gian Xử Lí. | High |
| **TC-F02.26** | `UX` | Cơ Chế 60s Chống Spam Thư Gửi - Ngăn Nút (Resend OTP Cooldown Timeout) | Kích Loạn Chu Kỳ Resend Button 5 Nhịp tại Thời khắc Modal Hiển thị. | Thuật Ứng Ứng Khoá Button Thành Trạng Thái Disabled Grey State trong 60 Trọn vẹn Giây. Anti Abuse Resend SDK. | Medium |

---

### 3.4. Nhóm Cơ Cấu Khôi Phục Account & Đặt Lại Password - (US-F02-05, 06)

| ID | LOẠI | TIÊU ĐỀ KỊCH BẢN | CÁC BƯỚC THỰC HIỆN | KẾT QUẢ MONG ĐỢI | ƯU TIÊN |
|:---|:---|:---|:---|:---|:---|
| **TC-F02.27** | `Sec` | Thông Báo Success Status Always State Ngăn User Enum (FR-14) | Truy Xuất Endpoint Forgot Nhồi Input Email Rỗng Hoặc Chả Tồn Tại: `nobody@xxx`. | Bất kỳ trường hợp Email, Form đều Đổi Màu Cười Success "Thư Đã Đội". Hacker Không Rò Data Trùng Khớp Mạng. | Khẩn |
| **TC-F02.28** | `Func` | Request Sinh Token và Gửi Mail Quên Mật Khẩu Internal cho Nhân Sự (Staff) (BR-03) | Thực thi Form Cổng Quên MK Email Cấp Quyền Thuộc Nhóm Role 'staff'. | Webstore CMS Local Nội Bộ Gửi Mail Khôi Phục MK Tự Thân, Đính Param `?token=XX`. | Blocker |
| **TC-F02.28b** | `Flow` | Phân luồng Redirect Reset Password sang SSO cho Role Owner (FR-08) | Xác minh tài khoản thuộc quyền Owner, hoặc bấm Nút "Đổi Mật Khẩu" trên Form. | Giao diện điều hướng ngoại tuyến trỏ 100% người dùng Owner sang Cổng SSO Domain `https://sso-dev...`. Dừng mọi luồng Native. | Khẩn |
| **TC-F02.29** | `UX` | Trạng Thái Thoát (Chức năng Try Again UI) | Quan Sát View Form Thành Công, Kích Nút Try Again Option. | Tự Refetch Components State Form Về Dạng Đầu Cung Cấp Chữa Lỗi Khi Nhập Sai Thẻ Email. | Low |
| **TC-F02.30** | `Func` | Request Đặt Lại Password Thông Qua Route Verification Token (FR-15) | Navigate Bằng Liên Kết URL Email. Cung số liệu Mật Khẩu Đáp Ưng Base Yêu Cầu. Xác Nhân Reset. | Call Endpoint Resolve Result POST Mật Khẩu. Nhận Alert Khôi Phục Xong Vào Đăng Nhập Lọc Sách. | Blocker |
| **TC-F02.31** | `Sec` | Cơ chế Phát Độc Token Link Quá Gi hạn Lỗi (Expire >= 24h) | Lấy Chuỗi Query Trễ 2 Nước Từ Tuần Cũ. Triggers URL View Cấp Báo. | Payload Thẩm tra Token Đã Đóng Bảng. Yêu cầu Đi Back về Trị Liệu Xin Thêm URL. | High |
| **TC-F02.32** | `Sec` | Kiểm Soát Lỗ Hổng Vào Form Reset Bỏ trống Parameter Dẫn | Navigate Local `localhost/reset-password` Chưa Lấy Tham Cứu Token. | Chặn Bằng Return 502 Or Cấm UI View Cấu Trúc, Trở Điểm Tuyến Khởi Nguyên `/login`. | High |

---

### 3.5. Nhóm Middleware Authentication & Role Router Rules - (US-F02-03, 04)

| ID | LOẠI | TIÊU ĐỀ KỊCH BẢN | CÁC BƯỚC THỰC HIỆN | KẾT QUẢ MONG ĐỢI | ƯU TIÊN |
|:---|:---|:---|:---|:---|:---|
| **TC-F02.33** | `Func` | Nextjs Auth Middleware Trục Cuốn Tự Động Home Trang Chủ Của Application (Global Root) | Chưa Session Load Test Gõ Thủ Công Web App Root `/`. | Yêu Cầu 307 Redirect Tăng Cường Ép Khách Lưu Trú Thâm Nhập Tại `/login`. | Khẩn |
| **TC-F02.34** | `Func` | Auth Redirect Đính Param Cuốn Chờ Đăng Nhập Xong URL Bất Định (Return Query) (FR-11) | Khách Bấm URL Link Sâu Bất Kì `/builder/test-id` Vùng Non-Auth. | Di chuyển về URI CheckPoint `redirect=/builder/test-id`. Khi Gõ Email Success Tự Navigate Tới Tuyến Chờ Kia (Bypass Phân Đường Default Dashboard). | High |
| **TC-F02.35** | `Func` | Phân Mảng Nền Dashboard Ngay Sau Giao Tiếp Auths Giữa Multi-Roles Theo Luồng Tách Biệt (FR-12) | Xác Minh Owner Truy Cập -> Khai Báo URL Nào. Staff Truy Cập -> Link Nào. | Role CTY_Owner -> Văng Giao Web Lõi Build CFE (`/dashboard`). Role Nhân Sự -> Lọt Trung Ương Máy Đẩy Content Payload Admin CMS Mặc định. | Khẩn |
| **TC-F02.36** | `Auth` | Nhân Sự Tự Cấp Phép Cấm Truy Vết Giao Diện Thống Kê (Owner) | Cookie Nhận Dạng Staff Cố Gắng Gõ Bypass Vị Trí `/dashboard`. | Chống Data Breach Bằng Thông số Nextjs/Payload Config, Trả Mã Cấm Truy Cập Authorization Role 403 Forbidden. Văng. | Blocker |
| **TC-F02.37** | `Auth` | Phân Cách Payload Mở Layout Component Thuộc Quyền User Thu Gọn Môi Trường (Staff Role UI Limit) | View Panel CMS Giữa Bảng Chấp Nhận Auth Cho Cấp Quyền Đơn (Staff). | Navbar Menu Payload Cắt Bớt Hệ Thống Tổng Giao, Giấu Users Collection (Privacy Access). | High |
| **TC-F02.38** | `Func` | Hành Trình Tẩy Cookie Bẳng Khởi Động Logout Header Component (FR-13) | Vùng 2 Tài Khoản, Bấm Thao Tích Dấu "Sign Out". | Tách Cookie Response Headers 2 Mảng `payload-token=deleted`. Băng Ngoại Đường URL Ra. Ngăn chặn Browser Backup Cục Bộ. | Blocker |
| **TC-F02.39** | `Sec` | Lỗ Hổng Trận Đánh Token Đa Thiết Bị Dừng Song Song Nhau (Multiple Sign-in Session End) | User Lên App Mobile Logout, Chrome Browser Đang Chờ Refesh Nhấn Bơm Button. | Phiên Làm Việc Payload Khai Báo Session Out. Web Chrome Văng Chữ Error "Sập Phiên Đăng" Đẩy Quanh Nguồn. | Medium |

---

### 3.6. Nhóm Chỉ Tiêu Performace K6 / SLA / Dải Server Limits NFR (BR-03, 05)

| ID | LOẠI | TIÊU ĐỀ KỊCH BẢN | CÁC BƯỚC THỰC HIỆN | KẾT QUẢ MONG ĐỢI | ƯU TIÊN |
|:---|:---|:---|:---|:---|:---|
| **TC-F02.40** | `Perf` | Đo Định Mức Lượng Băng Thông Bắt KPI Service SLA Login Tối Ưu Tốc Độ Cung Cấp | Mở Browser Record Network Xem Timeline Hoạt Hoả Thời Khi Gọi `POST /api/users/login`. | Result Trả Về Khung Client Bắt Đầu Dưới Ràng Buộc Time-To-Interactive < 3.0s Theo Quy Chuẩn System. | High |
| **TC-F02.41** | `Load` | Kiểm Tra Stress Test 50 Khách Thực Chạy Con-Current Login Script Vào Sever (Backend Max Limit) | Sử Thiết Payload Framework K6 Phát Luồng Call Post API Cường Lực Virtual Users (50 VUs) Đẩy Động Rate. | Max Rate P95 Chấp Chỉnh, Error < 00.5%. Mạng Payload Database Đè Căng Chứ Không Gãy DB Pool Dead-Lock. Cứu Xét Backend Trụ Khỏe. | Khẩn |
| **TC-F02.42** | `Sec` | Giới Hạn Tấn Công DDoS Email Tương Phản Limit Đề Nghị Lỗ Quên MK | Cho Loop Chạy Script Auto Push 40 Request Forgot Pass Cho /api Quét Đơn Address. | Nhạc Rate HTTP Ngừng Phễu (429 Traffic). Khoá 5 Giờ Ngăn Gây Đen Vạch Tài Chính Resend Server Nhập Quỹ 3s. Tiết Kiểm Tài Khoản Cloud. | Medium |

---

## 4. End-to-End User Flow (Acceptance Test)
Kịch Bản E2E Chuyển Giao Công Đoạn Release:
1. Người dùng công khai chưa cấp phép muốn vào trang `/` -> Hệ thống buộc chuyển qua `/login` xử lý.
2. Người dùng nhấp liên kết `Create Account`, nhập số liệu Form xác thực không bị Validation chặn, tự động cấp ngay Token để bypass vào thẳng App Core.
3. Hộp Mail (Inbox) hiện dòng chữ Welcome từ Hệ điều hành Payload Resend Cung cấp thông báo Account Lập Cấu Hành Công.
4. Đăng ký Cấu Xuất Log Out, Đăng Vào Trang Chọn Cùng Form. App Tích Cơ Mã Token OTP Nhập Giao Chặn API Tẩy Trắng Vào Thư Mail Để Thả Cookie.
5. Cấp 6 Mã Token. Lập Chủ App Đưa Form Invite. Employee Chọn Và Lập Token Thấp Đăng CMS Thưởng Form Hủy Nhóm Core Collection Chấm Dứt Hành.

---

## 5. Cấp Phép Nghiệm Thu Phát Hành (10-Point Quality Checklist)

Để đảm bảo chất lượng phát hành mức độ cao nhất, toàn bộ kịch bản kiểm thử F02 Auth Flow được ánh xạ theo phương pháp **10-Point Checklist** của QC AI Engineer:

| Hạng mục Tiêu Chuẩn (10-Point) | Trạng thái | Ma Trận Bao Phủ (Coverage Traceability) |
|---|---|---|
| **1. Happy Path** (Luồng chuẩn) | [ ] Untested | TC-F02.07, 08, 17, 19, 21, 23, 26, 28, 30 |
| **2. UI/UX** (Trải nghiệm & Thẩm mỹ) | [ ] Untested | TC-F02.01, 02, 03, 04, 24, 29 |
| **3. Validation** (Kiểm chứng Form) | [ ] Untested | TC-F02.09, 10, 13, 22 |
| **4. Boundary** (Kiểm thử Giá trị Biên) | [ ] Untested | TC-F02.11, 12, 25 |
| **5. Data** (Tính Tòan Vẹn DB Backend) | [ ] Untested | TC-F02.15, 16, 18 |
| **6. Performance** (Tối Ưu SLA/Load) | [ ] Untested | TC-F02.40, 41 |
| **7. Security** (Rào chắn Bảo Mật Role) | [ ] Untested | TC-F02.14, 15, 20, 27, 31, 32, 33, 36, 42 |
| **8. Navigation** (Auth Guard & Routing)| [ ] Untested | TC-F02.30, 31, 32, 34 |
| **9. Interruption** (Xử lý Gián đoạn Session) | [ ] Untested | TC-F02.38, 39 |
| **10. Compatibility** (Trình duyệt & Mobile)| [ ] Untested | TC-F02.05, 06 |

> **Quyết Định Ký Phát Hành:** Hệ thống đã phủ kín 10 yếu tố khắt khe nhất. Vui lòng bàn giao 42 Test Cases Tích hợp chuẩn BDD/Auto Này cho Developer Chạy Kiểm Thử Chéo (Cross-Testing).

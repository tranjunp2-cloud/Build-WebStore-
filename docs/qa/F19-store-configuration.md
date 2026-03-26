# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F19 — Store Configuration & Staff
> **Phiên bản:** 5.0 (Exhaustive Matrix) | **Cập nhật:** 2026-03-25 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F19-store-configuration.md`), User Stories (17 ACs), F18 Dashboard Layout Standards.
> **Kỹ năng ứng dụng (.agent):** Advanced RBAC Auditing, DNS/SSL Verification Logic, Mobile CMS UX, Security Bypassing Prevention.

---

## 1. Mục Tiêu (Objective)
Cung cấp bộ Test Suite **triệt để (Exhaustive Matrix)** cho tính năng Cấu hình Cửa hàng & Quản lý Nhân sự (F19). Bộ kịch bản này đảm bảo độ phủ 100% cho 17 ACs, tập trung vào tính bảo mật của hệ thống phân quyền (RBAC), tính ổn định của luồng kết nối Domain/SSL và các quy tắc nghiệp vụ về thanh toán (QR Gatekeeping).

Bộ kiểm thử bao gồm **62 kịch bản chi tiết**, được thiết kế để phát hiện sớm các rủi ro về cấu trúc và logic trước khi release.

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Deployment Sandbox |
| Authentication | Seller Role (Owner) vs Staff Role (Full Access / Custom) |
| DNS Testing | Thực hiện với domains test (Vidu: `.space`, `.site`) |
| Data | Workspace đa nhân viên, QR Code mẫu, File dung lượng lớn |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU (Steps & Test Data) | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-F19-01] Quản Lý Tên Miền (Custom Domain Management)** |
| **TC-F19.01** | `AC-1` | `UI` | **[Positive]** Giao diện thêm Domain (Add Domain Modal) | **1.** Vào Settings > Domains. <br>**2.** Nhấn "Add Custom Domain". | Hiện Modal với Input Domain và nút "Connect Domain". Tuân thủ F18 Dashboard Layout. | Medium | [ ] |
| **TC-F19.02** | `AC-1` | `Func` | **[Negative]** Chặn định dạng Domain sai (Invalid URL) | **1.** Nhập `mystore` (thiếu .com). <br>**2.** Nhập `http://store.com`. | Báo lỗi "Please enter a valid domain name (e.g. store.com)". Chặn nút Connect. | High | [ ] |
| **TC-F19.03** | `AC-1` | `Edge` | **[Negative]** Chặn Domain đã liên kết với Workspace khác | **1.** Nhập 1 domain đang active tại site khác. | Báo lỗi "This domain is already linked to another store". Chặn duplicate domain. | Blocker | [x] |
| **TC-F19.04** | `AC-2` | `Logic` | **[Positive]** Hiển thị DNS Instructions (A Record/CNAME) | **1.** Add domain thành công. | Hiện bảng thông số: A Record (IP) và CNAME. Trạng thái domain là "Pending Verification". | High | [ ] |
| **TC-F19.05** | `AC-3` | `Perf` | **[Positive]** Kiểm tra trạng thái xác thực (Verify Connection) | **1.** Đã trỏ DNS đúng. <br>**2.** Nhấn "Verify Connection". | **EXPECTED** Trạng thái đổi sang màu xanh "✓ Connected" (Success). | High | [ ] |
| **TC-F19.06** | `PRD` | `Sec` | **[Positive]** Tự động cấp phát SSL (HTTPS Provisioning) | **1.** Truy cập domain vừa connect. | SSL được cấp phát tự động (Let's Encrypt). Trình duyệt hiện khóa xanh (HTTPS). | Blocker | [ ] |
| **TC-F19.07** | `PRD` | `Edge` | **[Negative]** Xử lý khi DNS chưa Propagation kịp | **1.** Nhấn Verify ngay khi vừa trỏ record. | Trạng thái vẫn là "Pending". Hiện thông báo "DNS changes may take 24-48h to propagate". | Medium | [ ] |
| **[US-F19-02] Tên Miền Chính (Primary Domain Selection)** |
| **TC-F19.08** | `AC-1` | `UX` | **[Positive]** Thiết lập Tên miền chính (Primary Domain) | **1.** Có 2 domains Connected. <br>**2.** Nhấn "Set as Primary" cho domain mới. | Domain mới có Badge "Primary". Domain cũ mất badge. | Medium | [ ] |
| **TC-F19.09** | `AC-2` | `Logic` | **[Positive]** Redirect 301 từ Secondary -> Primary Domain | **1.** Truy cập domain phụ. | **EXPECTED** Trình duyệt tự động chuyển hướng về domain chính với mã HTTP 301. SEO Integrity pass. | Critical| [x] |
| **TC-F19.10** | `AC-3` | `Logic` | **[Negative]** Chặn xóa Tên miền mặc định (.echprime.com) | **1.** Tìm nút xóa tại subdomain mặc định. | Nút Xóa bị ẩn hoặc disabled. Subdomain mặc định luôn tồn tại làm fallback. | High | [ ] |
| **TC-F19.11** | `Edge` | `UX` | **[Negative]** Chặn Set Primary cho domain "Pending" | **1.** Nhấn "Set Primary" cho domain chưa verify. | Nút bị disabled. Tooltip hiện: "Verify domain first to set as primary". | Medium | [ ] |
| **[US-F19-03] Thanh Toán & Quy tắc QR (Payment Configuration)** |
| **TC-F19.12** | `AC-1` | `Func` | **[Positive]** Bật/Tắt đồng thời COD và QR Banking | **1.** Bật cả 2 Toggles. | Cả 2 trạng thái hiển thị 'Enabled'. Check Checkout: Hiện cả 2 phương thức. | High | [ ] |
| **TC-F19.13** | `AC-2` | `Logic` | **[Negative]** Ràng buộc Bật QR Banking (Gatekeeping Rule) | **1.** Nhấn bật QR khi chưa upload ảnh. | Hệ thống chặn Toggle sang ON. Hiện thông báo "Please upload your QR Code image first". | Blocker | [x] |
| **TC-F19.14** | `AC-2` | `Data` | **[Negative]** Upload QR Code quá dung lượng (> 2MB) | **1.** Upload file 5MB. | Báo lỗi Toast đỏ "File size exceeded (Max 2MB)". Reset vùng upload. | High | [ ] |
| **TC-F19.15** | `AC-2` | `Data` | **[Negative]** Upload QR Code sai định dạng (PDF/DOC) | **1.** Upload file PDF. | Báo lỗi "Only JPG/PNG formats are supported". | High | [ ] |
| **TC-F19.16** | `AC-3` | `Logic` | **[Positive]** Tự động Tắt QR Banking khi xóa ảnh QR | **1.** Nhấn dấu (X) xóa ảnh QR đang active. | **EXPECTED** Toggle "QR Banking" tự động nhảy về OFF. | High | [x] |
| **TC-F19.17** | `Design`| `UI` | **[Positive]** Preview ảnh QR sau khi upload | **1.** Upload ảnh QR thành công. | Ảnh hiện thumbnail sắc nét trong khung setup để Seller kiểm tra lại. | Low | [ ] |
| **[US-F19-05] Mời Nhân Viên & Phân Quyền (Staff Management RBAC)** |
| **TC-F19.18** | `AC-1` | `Func` | **[Positive]** Gửi lời mời Staff qua Email (Invite Flow) | **1.** Nhấn Invite Staff. Nhập Email. <br>**2.** Kiểm tra Directory. | Staff mới xuất hiện với trạng thái "Pending". Gửi email template Welcome thành công. | High | [ ] |
| **TC-F19.19** | `AC-2` | `Sec` | **[Positive]** Phân quyền "Full Access" (Workspace Admin) | **1.** Gán quyền Full Access cho Staff A. | Staff A vào được mọi module (Products, Orders, v.v.). Chặn Billing & Delete Workspace. | Critical| [ ] |
| **TC-F19.20** | `AC-3` | `Sec` | **[Positive]** Phân quyền "Custom Features" (Tick-box) | **1.** Chọn Custom. Chỉ tick 'Products'. <br>**2.** Staff log in. | **EXPECTED** Sidebar chỉ hiện menu Products. Các menu khác (Orders, Settings) biến mất hoàn toàn. | Blocker | [ ] |
| **TC-F19.21** | `AC-3` | `Sec` | **[Negative]** Chặn truy cập module bị cấm qua URL (Bypass Check) | **1.** Staff chỉ có quyền 'Products'. <br>**2.** Cố tình gõ trực tiếp `/dashboard/orders` lên trình duyệt. | Trình duyệt chuyển hướng về trang chủ hoặc hiện "403 Forbidden". Không được render data. | Blocker | [x] |
| **TC-F19.22** | `Limit` | `Logic` | **[Negative]** Chặn lưu quyền Custom khi chưa chọn tính năng nào | **1.** Chọn Custom -> Bỏ chọn hết checkboxes. | Nút "Save/Invite" bị disabled. | Medium | [ ] |
| **TC-F19.23** | `Edge` | `Sec` | **[Negative]** Chặn mời Email đã có sẵn trong Workspace | **1.** Mời email `staff@abc.com` 2 lần. | Báo lỗi "This email is already part of your staff". | Medium | [ ] |
| **[US-F19-06] Danh Mục Nhân Viên & Thu Hồi Quyền (Directory Management)** |
| **TC-F19.24** | `AC-1` | `UI` | **[Positive]** Hiển thị Staff Directory đầy đủ thông tin | **1.** Vào Tab Staff. | Danh sách hiện đủ: Avatar, Email, Role Type, List quyền (nếu Custom), Trạng thái. | High | [ ] |
| **TC-F19.25** | `AC-2` | `Func` | **[Positive]** Xóa/Revoke quyền truy xuất Workspace | **1.** Nhấn Remove Staff. Xác nhận Modal. | Staff biến mất khỏi danh sách. Token truy cập của Staff bị thu hồi ngay lập tức. | High | [x] |
| **TC-F19.26** | `AC-2` | `Sec` | **[Positive]** Force Logout sau khi bị thu hồi quyền | **1.** Staff đang thao tác. <br>**2.** Owner thực hiện Remove. | Staff bị đá văng ra màn hình Login tại thao tác tiếp theo. | High | [ ] |
| **TC-F19.27** | `AC-3` | `Sec` | **[Negative]** Bảo vệ Owner (Owner Protection) | **1.** Dùng Staff "Full Access". <br>**2.** Cố tình nhấn Remove tại dòng của Chủ shop (Owner). | Nút Remove bị ẩn hoặc báo lỗi "You cannot remove the Workspace Owner". | Blocker | [ ] |
| **TC-F19.28** | `Edge` | `Func` | **[Positive]** Hủy lời mời đang chờ (Revoke Pending Invite) | **1.** Nhấn Remove tại staff trạng thái "Pending". | Lời mời bị hủy. Link trong email mời cũ trở nên vô hiệu (Expired). | Medium | [ ] |
| **[US-F19-04] Mobile Web UX (CMS Native-Feeling)** |
| **TC-F19.29** | `AC-1` | `UX` | **[Positive]** Tích hợp Camera Roll để upload QR trên Mobile | **1.** Mobile: Nhấn Upload QR. | Mở Native Photo Picker (iOS/Android). Không bị crash hoặc đứng trang. | High | [ ] |
| **TC-F19.30** | `AC-2` | `UX` | **[Positive]** Tính năng Tap-to-Copy DNS Records | **1.** Tap vào icon copy bên cạnh IP/CNAME. | Hiện toast "Copied to clipboard". Copy đúng giá trị string. | High | [ ] |
| **TC-F19.31** | `UI` | `Mobile`| **[Positive]** Staff Table Responsive (Mobile Stack) | **1.** Chuyển sang Mobile View. | Bảng nhân viên chuyển sang dạng Card hoặc co giãn cột thông minh để không bị vỡ giao diện. | Medium | [ ] |
| **[MỞ RỘNG - EXHAUSTIVE] Boundary, Performance & Security (Advanced Cases)** |
| **TC-F19.32** | `Sec` | `RBAC` | **[Positive]** "Full Access" không thể xóa Workspace | **1.** Staff Full Access vào Settings. | Nút "Delete Workspace" hoặc khu vực nguy hiểm bị ẩn/chặn. | Critical| [x] |
| **TC-F19.33** | `Data` | `Sync` | **[Positive]** Update quyền Real-time (Permission Hot-swap) | **1.** Staff đang login. <br>**2.** Owner thay đổi quyền (Thêm 'Orders' cho staff). | Staff thấy menu 'Orders' xuất hiện ngay sau khi F5 hoặc nhảy route. | High | [ ] |
| **TC-F19.34** | `Perf` | `SLA` | **[Positive]** DNS Verification Timeout Handling | **1.** Proxy request verify DNS quá lâu (>10s). | Hiện thông báo: "Xác thực đang mất nhiều thời gian, chúng tôi sẽ cập nhật trạng thái sau ít phút". Không treo UI. | Medium | [ ] |
| **TC-F19.35** | `Sec` | `Auth` | **[Negative]** Brute-force Invite Staff (Rate Limit) | **1.** Thử gửi 50 lời mời staff liên tục bằng script. | Hệ thống chặn IP hoặc hiện Captcha/Rate limit message. | High | [ ] |
| **TC-F19.36** | `Data` | `Integr`| **[Positive]** Duy trì dữ liệu staff khi Workspace đổi tên | **1.** Đổi tên Store. | Danh sách staff và phân quyền không bị ảnh hưởng. Quan hệ Database (TenantID) bền vững. | High | [ ] |
| **TC-F19.37** | `Locale` | `UI` | **[Positive]** Đa ngôn ngữ cho Phân quyền (Permission Labels) | **1.** Switch sang Tiếng Việt. | 'Products' -> 'Sản phẩm', 'Orders' -> 'Đơn hàng'. Dịch chuẩn UI. | Medium | [ ] |
| **TC-F19.38** | `Sec` | `IDOR` | **[Negative]** Chặn thao tác Staff của Workspace khác | **1.** Dùng ID Staff của Workspace B gõ vào link xóa của Workspace A. | Trả lỗi 403. Không được phép xóa chéo workspace. | Blocker | [x] |
| **TC-F19.39** | `UX` | `State` | **[Positive]** Trạng thái Loading khi Verify Domain | **1.** Nhấn Verify Connection. | Nút hiện Spinner. Input bị disable tạm thời để tránh dubmit trùng. | Low | [ ] |
| **TC-F19.40** | `API` | `Func` | **[Positive]** 301 Redirect giữ nguyên URL Path | **1.** Truy cập `secondary.com/products/123`. | **EXPECTED** Chuyển về `primary.com/products/123`. Không bị mất slug/path. | High | [x] |
| **TC-F19.41** | `UI` | `Layout`| **[Positive]** Column Alignment trong Dashboard Standard | **1.** Kiểm tra khoảng cách lề và font chữ. | Áp dụng đúng F18 Standard (Inter font, 16px base, Teal accents). | Low | [ ] |
| **TC-F19.42** | `Edge` | `DNS` | **[Negative]** Domain trỏ sai IP (Wrong Target) | **1.** Trỏ CNAME về google.com thay vì echprime.com. | Báo lỗi "Records do not match our system. Please check DNS settings." | High | [ ] |
| **TC-F19.43** | `Edge` | `DNS` | **[Negative]** Domain trỏ về IP cũ của hệ thống | **1.** Trỏ về IP cũ (nếu có migration). | Báo lỗi "Update to our new IP: [New IP]". Hướng dẫn người dùng nâng cấp. | Medium | [ ] |
| **TC-F19.44** | `Sec` | `Auth` | **[Positive]** Hết hạn Token mời (Invite Expiry) | **1.** Staff click link mời sau 7 ngày (hoặc time config). | Hiện trang lỗi "Invitation Expired. Please ask the owner to resend". | Medium | [ ] |
| **TC-F19.45** | `Func` | `Staff` | **[Positive]** Resend Invitation (Gửi lại lời mời) | **1.** Nhấn nút "Resend" cho staff đang 'Pending'. | Gửi lại email mới. Vô hiệu hóa email cũ. Cập nhật timestamp. | Medium | [ ] |
| **TC-F19.46** | `Logic` | `Staff` | **[Positive]** Staff tự thoát khỏi Workspace (Leave Workspace) | **1.** Staff nhấn "Leave Store" trong menu cá nhân. | Staff bị xóa khỏi Directory. Owner nhận notification. | Medium | [ ] |
| **TC-F19.47** | `Func` | `Payment`| **[Positive]** Update ảnh QR mới (Replace Image) | **1.** Upload đè ảnh QR mới lên ảnh cũ. | Ảnh cũ bị xóa khỏi storage. Ảnh mới hiển thị preview và được link vào hệ thống. | High | [ ] |
| **TC-F19.48** | `Data` | `Clean` | **[Positive]** Dọn dẹp Storage khi xóa Workspace | **1.** Seller xóa toàn bộ Store. | Toàn bộ ảnh QR và bản ghi Domain của store đó phải được xóa sạch khỏi DB/Storage. | High | [ ] |
| **TC-F19.49** | `UI` | `State` | **[Positive]** Hiển thị Zero-state cho danh sách Domain | **1.** Store mới tinh. | Tab Domain hiện hướng dẫn "Connect your first branding domain". | Low | [ ] |
| **TC-F19.50** | `UX` | `Error` | **[Positive]** Toast thông báo khi gán quyền thành công | **1.** Lưu thay đổi Staff. | Hiện Toast xanh: "Staff permissions updated successfully". | Low | [ ] |
| **TC-F19.51** | `Sec` | `XSS` | **[Negative]** Chống XSS trong Input Email Staff | **1.** Nhập `<svg onload=alert(1)>@abc.com`. | Hệ thống escape chuỗi hoặc báo lỗi email format. Không render script. | Blocker | [x] |
| **TC-F19.52** | `Sec` | `CSRF` | **[Negative]** Chống CSRF khi Revoke Staff | **1.** Thực hiện request xóa qua 1 site lạ (Attack vector). | Bị chặn do thiếu CSRF token hoặc SameSite policy. | High | [ ] |
| **TC-F19.53** | `Func` | `Market` | **[Positive]** Thanh toán QR Banking hiển thị tại Checkout F09 | **1.** Bật QR trong F19. <br>**2.** Sang Storefront mua hàng. | Phương thức "Bank Transfer / QR" phải xuất hiện trong Payment List. | Blocker | [ ] |
| **TC-F19.54** | `Func` | `Market` | **[Positive]** COD hiển thị tại Checkout F09 | **1.** Bật COD trong F19. <br>**2.** Sang Storefront mua hàng. | Hiện phương thức "Cash on Delivery". | High | [ ] |
| **TC-F19.55** | `Perf` | `SSL` | **[Positive]** SSL Auto-renewal (Kiểm tra lý thuyết) | **1.** Kiểm tra cấu hình cronjob/certbot. | Cert được tự động renew trước 30 ngày hết hạn. Không cần can thiệp thủ công. | High | [ ] |
| **TC-F19.56** | `UI` | `Mobile`| **[Positive]** Tap target cho Toggle buttons | **1.** Dùng ngón tay bật/tắt COD trên Mobile. | Kích thước toggle đủ lớn (>44px), phản hồi xúc giác mượt (Visual feedback). | High | [ ] |
| **TC-F19.57** | `Func` | `DNS` | **[Edge]** Domain dạng Subdomain của domain khác (blog.site.com) | **1.** Nhập domain cấp 3. | Hệ thống vẫn cho phép và cung cấp DNS record phù hợp (thường là CNAME). | Medium | [ ] |
| **TC-F19.58** | `Logic` | `RBAC` | **[Positive]** Quyền Admin không thể đổi Primary Domain của Owner | **1.** Dùng Staff Full Access. | Nút "Set Primary" bị ẩn hoặc disabled. Chỉ Owner mới được đổi danh tính store. | Critical| [ ] |
| **TC-F19.59** | `UX` | `Nav` | **[Positive]** Giao diện Sidebar Active State | **1.** Đang ở menu 'Staff'. | Menu 'Staff' ở sidebar trái phải được highlight màu Teal đặc trưng của EchPrime. | Low | [ ] |
| **TC-F19.60** | `Func` | `Staff` | **[Positive]** Thay đổi Email của Staff đang active | **1.** Owner edit email của Staff B. | Báo lỗi hoặc yêu cầu tạo lời mời mới. Bảo mật: Không cho đổi email trực tiếp của user khác. | High | [ ] |
| **TC-F19.61** | `Data` | `Sync` | **[Positive]** Cache Clearing sau khi đổi Domain | **1.** Đổi Primary Domain. | Truy cập web thấy logo/info cập nhật theo domain mới ngay (Clear CDN cache). | High | [ ] |
| **TC-F19.62** | `Design`| `UI` | **[Positive]** Giao diện "Select primary domain" Button | **1.** Có từ 2 domains Connected trở lên. <br>**2.** Nhấn nút "Select primary domain" (màu xám, bo góc) cạnh nút Add. | Hiện Dropdown/Menu xổ xuống liệt kê các domains khả dụng để chọn nhanh làm Primary. | Medium | [ ] |
| **TC-F19.63** | `Design`| `State` | **[Positive]** Trạng thái "Verifying..." kèm Spinner | **1.** Tại domain Pending, nhấn Verify Connection. | Nút chính đổi màu sang xanh đậm hơn, Text: "Verifying..." kèm icon Spinner quay đều. | Low | [ ] |
| **TC-F19.64** | `Design`| `UI` | **[Positive]** Sidebar Navigation & Breadcrumb Active | **1.** Tại Dashboard, click "Store Config" > "Domains". | Sidebar highlight mục "Domains". Header hiện tiêu đề chuẩn: "Domain Management". | Low | [ ] |
| **TC-F19.65** | `Design`| `UI` | **[Positive]** Nhãn tím "Current Primary Domain" | **1.** Xem tên miền chính. | Có Badge màu tím (Purple) với nội dung "Current Primary Domain" hiển thị ngay sau tên miền. | High | [ ] |
| **TC-F19.66** | `Design`| `UI` | **[Positive]** Nút "Remove" màu đỏ (Right-aligned) | **1.** Xem 1 domain bất kỳ (Expanded view). | Có chữ "Remove" màu đỏ nằm ở góc phải hàng dưới cùng, đối xứng với nút Verify. | High | [ ] |
| **TC-F19.67** | `Design`| `UI` | **[Positive]** Modal Subtext & Instruction | **1.** Nhấn "Add Custom Domain". | Modal có dòng Note: "Note: Make sure you have access to your registrar" nằm ngay dưới tiêu đề. | Medium | [ ] |
| **TC-F19.68** | `Design`| `UI` | **[Positive]** Blue Copy Icons (A & CNAME) | **1.** Xem chi tiết domain Pending. | Cả A RECORD và CNAME RECORD đều có icon Copy màu xanh (Blue) ở cuối hàng. | Medium | [ ] |
| **TC-F19.69** | `Design`| `UX` | **[Positive]** Trạng thái Pending (Yellow Badge) | **1.** Thêm domain mới. | Hiển thị Badge màu vàng với icon đồng hồ và text "Pending Verification". | High | [ ] |
| **TC-F19.70** | `Design`| `UI` | **[Positive]** Giao diện Credit/Debit Gateway (Stripe) | **1.** Xem danh sách Payment. | Có mục "Credit/Debit Gateway" với subtext "Accept credit and debit card payments via Stripe". | Medium | [ ] |
| **TC-F19.71** | `Design`| `State` | **[Positive]** Trạng thái Inactive (Grey Badge) | **1.** Cổng thanh toán chưa cấu hình (Stripe hoặc QR chưa có ảnh). | Hiển thị Badge màu xám với text "Inactive" bên dưới tên cổng. | High | [ ] |
| **TC-F19.72** | `Design`| `UX` | **[Positive]** Thông báo "Changes saved! ✓" (Success Toast) | **1.** Thay đổi 1 cấu hình bất kỳ. | Xuất hiện Toast xanh ở góc trên bên phải với nội dung "Changes saved! ✓". | High | [ ] |
| **TC-F19.73** | `Design`| `UI` | **[Positive]** Thông tin Dropzone (Max size: 2MB) | **1.** Mở vùng upload QR. | Có dòng instruction: "JPG or PNG. Max size: 2MB" bên dưới icon upload. | Medium | [ ] |
| **TC-F19.74** | `Design`| `UI` | **[Positive]** Nút Xóa ảnh (Red X Icon) | **1.** Upload ảnh QR thành công. | Xuất hiện icon (X) màu đỏ ở góc trên bên phải của khung chứa ảnh để xóa nhanh. | High | [ ] |
| **TC-F19.75** | `Final` | `Audit` | **[Positive]** Institutional Excellence Gate | **1.** Rà soát toàn bộ tính năng dựa trên Corporate Standards & Design Fidelity (US-F19-03 Focus). | Đạt 100% tiêu chí về bảo mật, hiệu năng, tính ổn định và giống Design 100%. | Blocker | [x] |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)

1. **[Setup Định danh]**: Seller vào Domains, add `fashion-shop.site`. Copy IP trỏ DNS. Nhấn Verify -> Connected -> Set Primary. (TC-F19.01, 04, 05, 08).
2. **[Setup Vận hành]**: Sang Payments, bật COD. Upload ảnh QR Bank và bật QR Banking thành công. (TC-F19.12, 13, 17).
3. **[Setup Team]**: Vào Staff, mời `accountant@fashion.com` với quyền Custom: chỉ chọn 'Orders'. (TC-F19.18, 20).
4. **[Verify Access]**: Staff accountant login, chỉ thấy duy nhất menu Đơn hàng. Cố tình vào Blog bị chặn (TC-F19.21).
5. **[Audit Hàng tuần]**: Seller kiểm tra danh sách, xóa 1 nhân viên đã nghỉ việc (TC-F19.25).

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes & Rules Chuyên Gia) |
|---|---|---|
| **1. AC Coverage** | [x] 100% | Bao phủ đầy đủ 17 ACs từ stories và các mô tả trong PRD. |
| **2. RBAC Security Integrity** | [ ] PENDING | Cần verify kỹ lớp API Middleware để chặn 403 tuyệt đối. |
| **3. Market Context (MY)** | [ ] PENDING | Đã bao gồm các kịch bản QR Banking cho thị trường Malaysia. |
| **4. SSL & Redirect Reliability** | [ ] PENDING | Phải test 301 trên thực tế VPS/CDN sau khi deploy. |
| **5. Mobile native performance** | [ ] PENDING | Kiểm tra cảm giác "mượt" khi swipe đóng Bottom Sheet (nếu có dùng). |

---

## 6. Bộ Quy Tắc "Chốt Chặn" 10 Điểm (10-Point Quality Checklist)
> Dành cho QC Lead trước khi ký duyệt Release.

1.  **[ ] Zero-Bypass RBAC**: Staff có quyền 'Custom' đã được thử gõ trực tiếp URL vào các module cấm chưa? (Kết quả phải là 403).
2.  **[ ] SSL Green Lock**: Domain vừa connect có hiện ổ khóa xanh ngay lập tức không?
3.  **[ ] SEO 301 Check**: Truy cập domain phụ có nhảy về domain chính (Keep path) không?
4.  **[ ] QR Gatekeeping**: Đã thử bật QR Banking mà không upload ảnh chưa? (Hệ thống phải chặn).
5.  **[ ] Mobile Photo Picker**: Upload QR trên iPhone/Android có mở đúng Gallery không?
6.  **[ ] Owner Invincibility**: Staff Admin có thử xóa Chủ shop (Owner) chưa? (Nút xóa phải bị vô hiệu).
7.  **[ ] Data Clean-up**: Khi xóa 1 nhân viên, họ có thực sự bị "Kick" ra khỏi phiên làm việc (Logout) ngay không?
8.  **[ ] DNS UX**: Thông báo "Pending" có hiện rõ ràng khi DNS chưa trỏ không?
9.  **[ ] CMS Responsive**: Bảng danh sách Staff có bị tràn màn hình khi xem trên điện thoại không?
10. **[ ] Internationalization**: Các nhãn phân quyền (Permissions) đã được dịch sang Tiếng Việt chuẩn chưa?

---
**PHÊ DUYỆT BỞI:** .................................... **NGÀY:** ..../..../2026

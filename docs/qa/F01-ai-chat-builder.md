# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F01 - AI Chat Builder
> **Phiên bản:** 3.1 (Professional Tone Update) | **Cập nhật:** 2026-03-17 | **Thực hiện:** QA Team
> **Tài liệu tham chiếu PRD:** [F01-ai-chat-builder.md](../prd/F01-ai-chat-builder.md) | **Tài liệu tham chiếu User Stories (32 ACs):** [F01-ai-chat-builder-stories.md](../stories/F01-ai-chat-builder-stories.md)

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case này được xây dựng nhằm đảm bảo chất lượng toàn diện cho tính năng khởi tạo Website qua hội thoại AI (AI Chat Builder - F01). Mục tiêu cốt lõi là đạt độ phủ (Coverage) 100% cho 8 User Stories và 32 Acceptance Criteria (ACs) đã định nghĩa tại tài liệu đặc tả.

Bộ kiểm thử bao gồm **42 kịch bản chi tiết** (bao quát luồng chính, trường hợp ngoại lệ, kiểm thử biên, bảo mật và hiệu năng). Nhằm tối ưu hóa quá trình theo dõi và thực thi, toàn bộ kịch bản được tổng hợp trong một ma trận duy nhất (Unified Matrix).

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production |
| Browsers | Chrome (v110+), Firefox (v105+), Safari |
| OS / Desktop | Windows 11, macOS |
| Devices (Responsive) | Desktop (1920x1080), Mobile (iPhone 14 Pro 375px) |
| Network | 4G (Fast/Slow), Wifi, Mạng ngắt kết nối giả lập (Offline Simulator) |
| Test Data | Tập dữ liệu JSON được tham số hóa |

---

## 3. Unified Test Cases (Traceability Matrix)
_Bảng tổng hợp kịch bản kiểm thử, phân loại theo User Story nhằm đảm bảo khả năng truy vết._

| ID | Tham chiếu | LOẠI (Type) | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN (Steps) | KẾT QUẢ MONG ĐỢI (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-01: Generate Site from Prompt]** |
| **TC-F01.01** | `US-01/AC1` | `Perf/Func` | **[Happy Path]** Khởi tạo Website thành công với Prompt đầy đủ | 1. Nhập mô tả hợp lệ (VD: "Tiệm bánh ABC quận 3").<br>2. Gửi yêu cầu. | Hệ thống bắt đầu phản hồi (stream) trong `< 2 giây`. Quá trình kết xuất toàn bộ trang web hoàn tất trong `< 60 giây`. | Blocker | [x] |
| **TC-F01.02** | `US-01/AC1` | `UI/UX`     | **[Realtime]** Cập nhật Live Preview đồng bộ | 1. Quan sát giao diện Live Preview (iFrame) trong quá trình xử lý. | Thanh tiến trình (Progress Bar) hiển thị trạng thái hiện tại. Giao diện render tuần tự các block HTML theo thời gian thực tương ứng với dữ liệu stream. | High | [ ] |
| **TC-F01.03** | `US-01/AC2` | `NLU`       | **[Clarify]** AI đặt câu hỏi bổ sung khi thiếu ngữ cảnh | 1. Nhập mô tả khái quát (VD: "Tôi muốn tạo trang bán hàng").<br>2. Trả lời khái quát ở các lượt tiếp. | AI đặt câu hỏi làm rõ ngành hàng/yêu cầu (Tối đa 2 lần). Lần thứ 3, hệ thống tự động thiết lập giả định (assumption) và bắt đầu trình tạo Web. | High | [x] |
| **TC-F01.04** | `US-01/AC3` | `Flow`      | **[Post-Gen]** Hiển thị các hành động khả dụng sau khi hoàn tất | 1. Chờ tiến trình khởi tạo đạt 100%. | Giao diện xuất hiện 2 tùy chọn chức năng: "Tinh chỉnh" và "Publish ngay". Template nháp (Draft) tự động được lưu trữ vào Database. | High | [x] |
| **TC-F01.05** | `US-01/AC4` | `UX/State`  | **[Recovery]** Duy trì phiên làm việc (Session) khi tải lại trang | 1. Trong lúc tiến trình xử lý đạt 50%.<br>2. Thực hiện tải lại trang (F5) hoặc điều hướng Back. | Tiến trình xử lý không bị gián đoạn. Giao diện khôi phục trạng thái sinh Web đúng tại mốc 50% trước đó. | High | [x] |
| **TC-F01.06** | `US-01/AC5` | `Edge`      | **[Failover]** Xử lý ngoại lệ khi API OpenAI gặp lỗi | 1. Giả lập phản hồi HTTP 500 từ OpenAI API.<br>2. Gửi yêu cầu khởi tạo. | Hệ thống hiển thị thông báo lỗi (Error Toast). Dữ liệu văn bản trong hộp thoại (Chat Input) của người dùng phải được bảo lưu để thực hiện gửi lại. | High | [x] |
| **TC-F01.07** | `US-01/AC6` | `Func`      | **[Output]** Xác thực cấu trúc 4 trang cơ bản | 1. Kiểm tra kiến trúc thanh điều hướng (Navigation) của Website kết quả. | Hệ thống phải thiết lập đầy đủ 4 module trang: Homepage, About Us, Products/Services, và Contact Us. Liên kết menu hoạt động chính xác. | Blocker | [x] |
| **TC-F01.08** | `US-01/AC7` | `AI Logic`  | **[Smart]** Áp dụng Layout tương thích với từng lĩnh vực | 1. Yêu cầu tạo trang "Spa thẩm mỹ".<br>2. Yêu cầu tạo trang "Cửa hàng bán lẻ giày". | Lĩnh vực Spa: Giao diện sử dụng tông màu thư giãn, ưu tiên cấu trúc thư viện ảnh (Gallery). Lĩnh vực Bán lẻ: Ưu tiên hiển thị danh mục sản phẩm (Product Grid). | High | [ ] |
| **TC-F01.09** | `Negative`  | `Limit`     | **[Validation]** Xử lý input vượt quá quy định độ dài (Token Limit) | 1. Nhập từ khóa mô tả vượt quá 10,000 ký tự. | Frontend vô hiệu hóa tương tác Gửi, hiển thị thông báo vượt giới hạn độ dài. Hệ thống không khởi tạo request API. | High | [x] |
| **[US-02: Store Setup - Basic Info & Database]** |
| **TC-F01.10** | `US-02/AC1` | `Flow`      | **[Onboard]** Điều hướng tạo trang từ màn hình Onboarding | 1. Tại trang `/onboarding`, chọn "Tạo bằng AI". | Điều hướng thành công đến `/builder/new`. Trích xuất Tên, Lĩnh vực và lưu chính xác tham số vào cột `site.aiContext` trong CMS Payload. | High | [x] |
| **TC-F01.11** | `US-02/AC2` | `Flow`      | **[Alternative]** Người dùng chọn thư viện Template có sẵn | 1. Tại trang `/onboarding`, chọn "Khám phá Template". | Điều hướng thành công đến thư viện `/templates`. Tải trực tiếp thiết kế vào hệ Editor, bỏ qua luồng tương tác cấu hình AI. | Medium | [x] |
| **TC-F01.12** | `US-02/AC3` | `Boundary`  | **[Validation]** Ngăn chặn Input rỗng hoặc thiếu độ dài hợp lệ | 1. Điền khoảng trắng hoặc dữ liệu độ dài `< 3 ký tự`. | Hệ thống đưa ra yêu cầu bổ sung thông tin chi tiết mảng dịch vụ. Ngăn chặn việc gửi Payload lỗi tới tầng API xử lý. | High | [x] |
| **[US-03: AI Hero Image Generation (DALL-E)]** |
| **TC-F01.13** | `US-03/AC1` | `API`       | **[Happy Path]** Khởi tạo thành công hình ảnh Banner chính | 1. Chờ quá trình xử lý hoàn thiện phân hệ Banner Trang chủ. | Dữ liệu trả về hình ảnh có chủ đề và bảng màu tương ứng lĩnh vực. Tệp tin được tải lên CDN và ghi nhận bản ghi Media tại hệ quản trị CMS. | High | [x] |
| **TC-F01.14** | `US-03/AC2` | `Edge`      | **[Failover]** Xử lý dự phòng khi DALL-E Offline (Fallback) | 1. Giả lập chặn kết nối API DALL-E. | Tiến trình render HTML của trang không bị Crash. Hệ thống tự động sử dụng hình ảnh mặc định (Default Stock Image) tương ứng danh mục để hiển thị thay thế. | Blocker | [x] |
| **TC-F01.15** | `US-03/AC3` | `Func`      | **[Action]** Tính năng làm lại hình ảnh (Regenerate Image) | 1. Di chuột đến khối Ảnh và chọn "Generate New Image". | LLM xử lý Prompt và trả kết quả hình ảnh mới. Cập nhật và thay thế hình cũ đồng thời lưu tệp Media mới vào CMS. | High | [x] |
| **TC-F01.16** | `Extra`     | `Sec/UI`    | **[Watermark]** Tính năng đóng nhãn nhận diện dữ liệu tạo bởi AI | 1. Kiểm tra DOM Element của Hình ảnh tại giao diện Builder. | Element được đính kèm nhãn "AI Generated ✨". Nhãn dán này tự động loại bỏ trên giao diện End-User Public khi Website phát hành (Publish). | Low  | [ ] |
| **[US-04: One-Click Publish Domains]** |
| **TC-F01.17** | `US-04/AC1` | `Func`      | **[First Pub]** Phát hành trạng thái công khai lần đầu | 1. Click phím chức năng "Publish". | Hoàn tất cấu hình triển khai `< 30 giây`. Sub-domain `{slug}.primeweb.app` khả dụng truy cập trả trạng thái HTTP 200. Hiển thị thông báo Thành công. | Blocker | [x] |
| **TC-F01.18** | `US-04/AC2` | `Func`      | **[RePub]** Áp dụng thay đổi cho Website đang hoạt động (Re-publish) | 1. Chỉnh sửa nội dung trang và click chọn "Publish" lần nữa. | Ghi đè cấu hình đã sửa đổi lên Version đang công khai. Website hiển thị thay đổi mới và tự động sinh bản chuẩn Sitemap.xml cho mục đích SEO. | High | [x] |
| **TC-F01.19** | `US-04/AC3` | `Flow`      | **[Unpublish]** Rút tên miền và dừng quyền truy cập | 1. Truy cập cài đặt và chọn "Unpublish". Tải lại URL công khai. | Tên miền hiện trạng HTTP 404 (Không tồn tại). CMS thay đổi cờ trạng thái của Website từ Live sang Draft. Dừng tiếp nhận Traffic. | High | [x] |
| **[US-05: Conversational AI Onboarding Flow & Chip Input]** |
| **TC-F01.20** | `US-05/AC1` | `UX`        | **[Greeting]** Hiển thị màn hình tiếp đón đầu tiên | 1. Tải trang làm việc theo đường dẫn `/builder/new`. | Trợ lý xuất hiện kèm phản hồi độ dài `< 2 câu` bằng Tiếng Anh mặc định. Hiển thị gợi ý nhóm Tag hành động nhanh (Quick Reply Chips) bên trên ô text nhập liệu. | High | [x] |
| **TC-F01.21** | `US-05/AC2` | `NLU/Func`  | **[Detect VI]** Điều chỉnh ngôn ngữ giao tiếp sang cú pháp Tiếng Việt | 1. Trong lúc Assistant chờ Tiếng Anh, người dùng nhập nội dung bằng Tiếng Việt. | Dựa trên Prompt, Bot tự động chuyển đổi ngôn ngữ trả lời thành Tiếng Việt. Cập nhật Biến Localize cho toàn cấu trúc tương tác tiếp theo. | Blocker | [x] |
| **TC-F01.22** | `US-05/AC2` | `NLU/Func`  | **[Detect BM]** Cập nhật tương tác văn phong bản địa (Bahasa Melayu) | 1. Người dùng nhập Prompt có từ khóa hoặc ngữ pháp Bahasa Melayu. | Hệ thống hiệu chuẩn cấu trúc phản hồi sang văn phong trang trọng của BM (Formal BM). Không yêu cầu cấu hình cài đặt Setting bằng thao tác. | High | [x] |
| **TC-F01.23** | `US-05/AC3` | `UX/Flow`   | **[Limits]** Ngưỡng tối đa hội thoại trích xuất đầu vào | 1. Trả lời nội dung thiếu chiều sâu cho 5 lần giao tiếp. | Trợ lý tự giới hạn vòng đời hỏi-đáp tối đa 4 vòng thẩm định. Truy vấn vòng 5 kích hoạt lập tức Cơ chế Khởi Tạo Xây Dựng để giảm độ trễ (Fatigue rate). | High | [x] |
| **TC-F01.24** | `US-05/AC3` | `UX`        | **[Chips]** Liên kết Option thẻ Quick-Select trực tiếp làm Text Input | 1. Chọn click tag Chips ngành nghề đã render cấu trúc đề xuất. | Lựa chọn Option thay đổi thành dữ liệu đầu vào Payload text gửi đi tương đương Text Gõ Thủ công. Quá trình khai báo liền mạch. | Medium | [ ] |
| **TC-F01.25** | `US-05/AC4` | `NLU`       | **[Extraction]** AI trích xuất phân mục dữ liệu song song một nhịp | 1. Truy vấn mô tả mang cấu trúc đa thông tin: "Bán đồ thủ công, 2012, Hồ Chí Minh". | NPL bóc tách thành công 3 biến (Lĩnh vực, Thời điểm Thành lập, Địa điểm). Xác nhận thông tin và bỏ qua câu khai thác nhóm dữ liệu trùng. | Blocker | [x] |
| **[US-06: Multilingual Generated Web Output]** |
| **TC-F01.26** | `US-06/AC1` | `DB/Locale` | **[Output BM]** Dịch hóa tự động Content Website bản BM | 1. Luồng đàm thoại tạo bằng Bahasa Melayu. Kiểm định giao diện tạo thành. | Đoạn văn, Nút tương tác CTA, Định vị cấu hình Text đảm bảo biên phiên độ chính xác Tiếng Bahasa Melayu chuyên nghiệp. | High | [x] |
| **TC-F01.27** | `US-06/AC1` | `DB/Locale` | **[Output VI]** Dịch hóa tự động Content bản Việt chuẩn SME | 1. Luồng đàm thoại định vị Tiếng Việt. Kiểm định thông số web sinh ra. | Văn phong bản kết xuất Tiếng Việt tự nhiên và mang tính chất thương mại (Ví dụ ưu tiên dùng danh xưng "Mặt hàng hot" hoặc "Nhận tư vấn"). | High | [x] |
| **TC-F01.28** | `US-06/AC2` | `Logic`     | **[Dual Lang]** Tính năng gợi ý tạo song bản Local & Tiếng Anh | 1. Hoàn tất Website bản địa tự chọn. | Hệ thống hiển thị Dialog bổ sung bản sao Tiếng Anh. Chấp thuận khởi tạo nền Background process chuyển đổi Language Pack thành giao diện thứ 2. | Medium | [ ] |
| **TC-F01.29** | `US-06/AC3` | `Edge`      | **[Fallback EN]** Ngoại lệ phản ứng Localize với Ngôn ngữ hiếm | 1. Nhập Prompt ngôn ngữ Swahili / Tamil để test ngưỡng biên dịch. | Fallback bảo toàn hệ ngôn ngữ Kết quả qua Tiếng Anh Mặc Định. Hệ thống tránh Crash Log Backend Server, đưa ra phản hồi hỗ trợ English. | Medium | [x] |
| **[US-07: Post-Generation Success Confirm & CMS Admin Redirects]** |
| **TC-F01.30** | `US-07/AC1` | `UI`        | **[Screen]** Kiểm định Interface Confirm sau quá trình Build | 1. Xác nhận hành động hoàn tất "Confirm & Publish". | Khung Modal Thành Công hiển thị 4 Action Component: Preview URL (In Đậm), Action Copy Link, Navigation View Live và Goto Admin CMS Backend Tầng Layout. | High | [ ] |
| **TC-F01.31** | `US-07/AC2` | `Flow/Auth` | **[Go Admin]** Điều Hướng Vào Tầng CMS Backend Mà Không Yêu Cầu Xác Thực Lại | 1. Nhấp phím Action "Go to Admin Dashboard". | Cookie Auth session duy trì điều hướng hệ thống quản trị `/admin` Payload Mà Không yêu cầu Login Re-Verification. Danh định Site đã tồn tại Mục Current. | Blocker | [x] |
| **TC-F01.32** | `US-07/AC3` | `Flow`      | **[Gen Edit]** Quyết Trụ Chuyển Điều Kiện Trang Biên Tập Editor UI | 1. Chọn phím chức năng "Continue Editing" Trên Modal Box. | Router Trình Sinh Màn View Mode `/editor/:siteId`. Mạng Lưới Đánh Cờ Trạng Thái Về "Published". Thao Tác Lưu Lại Qua Button Re-Publish. | Medium | [x] |
| **TC-F01.33** | `US-07/AC4` | `UI/UX`     | **[Clipboard]** Tương tác Tính Năng Copy Domain | 1. Click phím Icon "Copy Link" Dọc Theo Tên SubDomain Cấp Sẵn. | Tooltip chuyển hiển thị trạng thái Thành 1.5s Toast Label. Chuỗi Ký Tự Text Được sao chép vào Clipboard hệ điều hành. | Low  | [ ] |
| **[US-08: Drag-and-Drop Block Reorder On Preview Interface (DND Focus)]** |
| **TC-F01.34** | `US-08/AC1` | `UX/Desktop`| **[DND]** Tương tác Di Chuyển Section bằng Desktop | 1. Tại Desktop Client. Trỏ Focus chuột Handgrip Kéo Nhả Component Sang Khối Layout Vị Trí Mới. | Trật Tự Index HTML Node thay đổi DOM không Reload. Thao Tác Dữ liệu được đưa vào Store Application SortOrder Runtime Logic bộ. Không Thực Thi Re-fetch. | High | [ ] |
| **TC-F01.35** | `US-08/AC2` | `UI/Render` | **[Visual UX]** Hoạt ảnh Phản ứng UX/UI trong Reorder | 1. Bắt Nhịp Tác Vụ Rê Thả Block Bất Kì Trong Không Gian Workspace Screen Render. | Khối Block Giảm Chỉ Số Opacity Đạt 0.7 với Bóng Tạm (Shadow Box). Chỉ báo Target Marking Căn Dịch Điểm Tới. Hoàn Tất Đoạn Hoạt hình Animations Nhẹ thả Khoảng 200ms. | Medium | [ ] |
| **TC-F01.36** | `US-08/AC3` | `DB`        | **[Persistence]** Payload CMS Cập nhật Vị Trí SortOrder DB Async | 1. Thực Hiện Cập nhật Vị trí Chỉnh sửa Đóng Gói Yêu Cầu Ghi "Publish". | API Server Tích xuất Cây SortOrder Index Qua Request Đồng Bộ POST Cập Database Payload Schema. Verify Trạng Thái Database Backend Map Hoàn Toàn 100%. | Blocker | [x] |
| **TC-F01.37** | `US-08/AC4` | `Mobile`    | **[DND Touch]** Nhận diện Thao Túng Touch Điểm (Mobile Device) | 1. Sử dụng Màn Hình Nhỏ 375px. Thực Hành Giữ Long-Tap Điểm Chạm Handgrip Block Re-drag. | Vô hiệu hóa tính năng Kéo Scrolling Window Web Browser Mặc định Hệ thống Đảm bảo Không Lấn Cấn Sự Kiện Target Touch Sensor Khi người dùng thay Đổi Layout. | High | [ ] |
| **TC-F01.38** | `US-08/AC5` | `Boundary`  | **[Giới Hạn]** Ngăn thao tác với Các Khối Mặc Định Chống Lỗi (Fixed Components) | 1. Tác Động Nắn Kéo Di Chuyển Hai Thành Phần Header Navbar & Body Footer Component. | Thuộc Tính Báo Xử Khóa Index hiển thị (Lock). Handgrip Kéo vô Hiệu hóa, Tích Phân Đỉnh Ngăn người Dùng Thực Thi Tạo Khối Sai Hỏng Chức Năng Bố Cục Thẩm Mỹ Hệ Thống Navigation Căn Bản. | High | [x] |
| **[Non-Functional: Bảo Mật, SLA & Kiểm Soát Tải API]** |
| **TC-F01.39** | `Negative`  | `Security`  | **[Bảo mật]** Ngăn chặn tấn công Injection/XSS Script xuyên luồng Input | 1. Khai báo chuỗi Chatbot Input giá trị XSS: `<script>alert(1)</script>`. Tiến Hành Tạo AI Component Payload. | Middleware Sanitization Hệ AI Quét & Bóc tách Lớp Token Data Nguy Hại. Input Về dạng Text Clean Chuẩn Trước Đi Qua Luồng ChatGPT OpenAI Lớp Server CMS Core Data. | Blocker | [x] |
| **TC-F01.40** | `Edge`      | `Access`    | **[Bảo mật]** Cách Ly Quyền Truy Cập (Tenant Level DB Isolation) | 1. Authentication Role Người Dùng Cấp 1 Móc Fetch Yêu Cầu Header Data API Payload Của User Nền Hệ Nhánh Site Cấp Khác (A qua B). | Server Payload Firewall Trách Xuất Mã Rule Quyền Hạn Từ Trả Lỗi 403 Forbidden Error, Cấp Nhánh Phân Cụm Ngăn Trái Thỏa Hiệp Thâm Nhập Privacy Cửa Hậu Hệ Thống Vận Hành Chung Bằng Biện Pháp Data Role Limit Chéo Tuyệt Mật. | Blocker | [x] |
| **TC-F01.41** | `Negative`  | `Safety`    | **[Giám Sát AI]** Triển Khai Kiểm Soát Nội Dung Sensitive Prompt Guard (NSFW) | 1. Gửi Input Cố Tình Thu Nạp Khích Bác Text/Data 18+ Vi phạm quy chuẩn. | Mạng Phân Tích Chuẩn LLM System Ngăn Sinh Tệp Content Phản Hồi Trọng Tải Giới HTTP Lỗi 400 Bad Request Cấm Output. Cảnh Báo Toast Màn Đỏ Vi Phạm Chánh sách, Hệ Không Vất Năng Lực Trả Render File HTML / Domain Bẩn. | High | [x] |
| **TC-F01.42** | `Negative`  | `API Limit` | **[Kiểm Soát Tải DDoS]** Ngưỡng Throttling Bảo Vệ Máy Chủ Load Stress | 1. Sử dụng Tự động Automation Kích Lập API Call `Generate-Website` Loop Khung Target Quá Mức Độ Request User/Giây Liên tục. | Server Gateway Node Xác Nhu Cầu Gửi Mã Cạn 429 Too Many Rate Limit Chém Phăng Giới Hạn Port Limit Quota Tránh Thiệt Hại Hao Hụt Tiền Budget Call OpenAI, Chống Căng Bộ Nhớ Lỗi Kéo Nền Server Khác Down Ngủ Đông. | Blocker | [x] |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)
_Mô tả kịch bản kiểm thử dựa trên hành vi tổng thể của Cửa hàng Bán lẻ (SME Owner)._

**Kịch bản E2E:** 
1. **[Tiếp nhận - US-05]** Sau khi đăng nhập, User vào giao diện tạo Website bằng AI. Hệ thống hiển thị Onboarding bằng Tiếng Anh. User phản hồi bằng Tiếng Việt (VD: "Làm trang kinh doanh mỹ phẩm"). AI nhận diện ngữ cảnh, chuyển giao tiếp sang Tiếng Việt và trích xuất thành công các biến thông số kỹ thuật (lĩnh vực, thời gian, quy mô) mà không cần yêu cầu điền thêm form bổ sung. (TC-F01.21, TC-F01.25).
2. **[Thực thi - US-01]** AI khởi tạo bộ mã nguồn theo thông tin trích xuất. Giao diện (Thanh Progress & iFrame Preview) xử lý phản hồi đồng bộ dưới chu kỳ 60s cho 4 Pages Core (TC-F01.07), tích hợp quá trình gọi DALL-E tự sinh Banner chuẩn hình ảnh Layout thực tế (TC-F01.13), đi kèm bộ văn phong Tiếng Việt thương mại. (TC-F01.27).
3. **[Hiệu chỉnh - US-08]** User đánh giá, thực hiện thao tác kéo lê (Drag and Drop) module cấu trúc trong Live Preview dễ dàng (TC-F01.34). Thực thi tác vụ chốt bằng nút "Confirm & Publish" (TC-F01.04).
4. **[Phát hành - US-07, US-04]** Giao diện thông báo xuất bản Sub-domain thành công với chức năng sao chép tự động (TC-F01.33). Tiếp tục kết luồng điều hướng mượt mà đến trình quản trị Payload CMS (TC-F01.31) cho bước tiến tới vận hành Live Product.

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes) |
|---|---|---|
| **1. UI/UX Coverage** | [ ] Đã chạy 0/9 TC | Thực thi kiểm định đa kích thước màn hình & tính năng thao tác chạm (Touch) thiết bị di động thực tế. |
| **2. AI Logic & Functions** | [ ] Đã chạy 0/20 TC | Kiểm duyệt Auto Test Run Pass cho chuỗi Onboarding NLP Bot và API Stream Layout. |
| **3. Security & DB Validation** | [ ] Đã chạy 0/9 TC | Xác định Rate Limit DDoS, SQL Injection / XSS, Prompt Guard và Cô Lập Dữ liệu Tenant (Isolation) hoạt động nghiêm ngặt không sai sót. |
| **4. Performance SLA** | [ ] Not Run | Phê duyệt chuẩn Load API Trực tiếp (K6 Report) giới hạn < 2s API SSE stream khởi điểm và < 60s Render HTML khối chốt. |
| **5. E2E UAT Approval** | [ ] Not Run | Quản lý dự án / QA Manager Kiểm Định Chấp Nhận Ký Duyệt Luồng UAT Phản hồi tốt với Hành vi người dùng khối ngành SME. |

> **Khuyến Nghị Release:** Chưa đáp ứng (Cần triển khai quá trình Automation Playwright Run Test để đạt Rate Passed TCs 100%). Luồng F01-AI-Builder mang giá trị Cốt lõi của phần mềm, cần thiết bảo vệ 100% Core Logic Bugs khỏi cấp độ Lỗi Nghiêm Trọng P0/P1 trước phiên Code Freeze Launch Production Target.

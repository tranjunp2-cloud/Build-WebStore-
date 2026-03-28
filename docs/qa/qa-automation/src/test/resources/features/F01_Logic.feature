Feature: F01 AI Builder Core Logic & Backend

  # Nhóm 1: Bảo mật & Quota
  @Security @DDoS
  Scenario: TC-F01.46 - Giả lập tấn công DDoS Rate Limit 10 req/s
    Given API Endpoint POST "/api/ai/generate-site"
    When Tôi gửi liên tiếp 15 requests trong vòng 1 giây
    Then Hệ thống phải chặn từ request thứ 11 với mã HTTP 429 Too Many Requests

  @Security @SQLi
  Scenario: TC-F01.02 - SQL Injection vào Payload Login
    Given User gửi POST "/api/auth/login" với email "admin' OR 1=1--" và mật khẩu bất kỳ
    Then Server trả về mã HTTP 401 Unauthorized
    And Payload an toàn không leak lỗi cơ sở dữ liệu

  @Security @Tenant
  Scenario: TC-F01.48 - Tenant Isolation ngăn cản chéo User Data
    Given Tôi có JWT Token của User A
    When Tôi gửi GET request để lấy thông tin site của User B
    Then Server trả về mã HTTP 403 Forbidden

  # Nhóm 2: SSE & Stream API
  @Perf @Timer
  Scenario: TC-F01.08 - Response API Stream hoạt động dưới 60s
    Given Gửi thông tin form tạo site hợp lệ tới "/api/ai/generate-site"
    When Kết nối SSE stream
    Then Phải nhận được event kết thúc trước cột mốc 60 giây

  @Edge @Refund
  Scenario: TC-F01.67 - Giả lập ngắt nguồn OpenAI để test hoàn tiền Quota
    Given Gửi request tạo web nhưng giả lập timeout kết nối với OpenAI
    When API timeout HTTP 504 hoặc 500 ném ra
    Then Số lượng Quota hiện tại của User không bị trừ đi

  # Nhóm 3: Database & Cron Job
  @Database @Update
  Scenario: TC-F01.40 - Submit thay đổi Layout ghi đè chính xác vào Mongo
    Given Gửi PATCH request "page.layout.sortOrder" với array "[3, 1, 2]"
    When API trả về 200 OK
    Then Truy vấn trực tiếp Mongo Collection "sites" phải thu được array layout tương đương

  # Nhóm 4: CMS Status 
  @Flow @Status
  Scenario: TC-F01.25 - Bypass API gọi Published domain sống siêu tốc
    Given Gửi PUT request cập nhật Site status thành "Published"
    When Truy cập trực tiếp subdomain cấp phát
    Then Domain phản hồi mã HTTP 200 trong vòng 30 giây

# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: [Mã Feature] - [Tên Feature]
> **Phiên bản:** [1.0] | **Cập nhật:** [YYYY-MM-DD] | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`[Tên file PRD].md`), User Stories ([Số lượng] ACs), Figma Design ([Link Node Figma])
> **Kỹ năng ứng dụng (.agent):** BDD (Gherkin Expectations), Performance SLA Validators, Security Contexting, Automation Locator Healer, Payload CMS DB Assertions.

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case này được xây dựng nhằm đảm bảo chất lượng toàn diện cho tính năng [Tên Feature]. Mục tiêu cốt lõi là đạt độ phủ (Coverage) 100% cho [Số lượng] User Stories, bao quát chính xác **[Số lượng] Acceptance Criteria (ACs)** đã định nghĩa tại tài liệu đặc tả và các yêu cầu thẩm mỹ UI từ bản thiết kế Figma hiện tại.

Bộ kiểm thử bao gồm **[Số lượng] kịch bản chi tiết** (Positive + Negative edge cases). Toàn bộ kịch bản được tổng hợp trong Unified Matrix.
---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production |
| Browsers | Chrome (v110+), Firefox (v105+), Safari |
| Devices (Responsive) | Desktop (1920x1080), Mobile (iPhone 14 Pro 375px) |
| Test Data & SLA | Input XSS/SQLi Vectors, Network Throttling, SLA Metrics `<60s` |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU (Steps & Test Data) | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[Nhóm/Phần Hành/User Story]** |
| **TC-[Mã Feature].01** | `Design / AC-1` | `UI/Func/Sec/Perf` | **[Positive/Negative/Edge]** [Tên mô tả kịch bản] | **1.** [Bước 1]<br>**2.** [Bước 2] | **GIVEN** [Context] **WHEN** [Action] **THEN** [Expected Result] / [Hoặc mô tả chi tiết] | [Blocker/High/Medium/Low] | [ ] |
| **TC-[Mã Feature].02** | `...` | `...` | **[...]** ... | **1.** ...<br>**2.** ... | ... | ... | [ ] |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)
_Mô tả kịch bản kiểm thử dựa trên hành vi tổng thể của [Đối tượng Người dùng]._

**Kịch bản E2E Cốt Lõi:** 
1. **[Tên Hành Trình 1]** [Mô tả chi tiết luồng đi qua các chức năng chính bước 1...]
2. **[Tên Hành Trình 2]** [Mô tả chi tiết luồng đi qua các chức năng chính bước 2...]

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes & Rules .Agent Trích Chọn) |
|---|---|---|
| **1. UI/UX Coverage** | [ ] Đã chạy 0/0 TC | `Locator Healer Agent` Định Giá Thang Giao DOM Test. Bảo Trì Touch Drag & Drop |
| **2. Logic & Functions** | [ ] Đã chạy 0/0 TC | Khắc Lõi Mở `BDD Cucumber Agent` Gắn Expected Theo Bền Chắc Đỡ Rung Khung |
| **3. Security & DB Validation** | [ ] Đã chạy 0/0 TC | Code Kháng Mạng Bypass Data Rác Lõi Database Payload Check `QC & Flaky Fixer Test` |
| **4. Performance SLA** | [ ] Not Run | Call Benchmark `Performance Load Tester Agent` SLA Cứng Đo API |
| **5. E2E UAT Approval** | [ ] Not Run | Chốt File P0/P1 Lệnh Hoàn Thành Cứng Cựa Cho Năng Lực Core |

> **Khuyến Nghị Release:** [Ghi chú nếu có khi chuẩn bị Release]

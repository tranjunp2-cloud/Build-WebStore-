# PrimeWeb V2 - E2E Test Automation (Playwright Java)

Dự án kiểm thử tự động E2E cho PrimeWeb v2, tuân thủ theo chuẩn QC `qc-ai-engineer` (Test Case Standardization & 10-Point Checklist).

## 🛠 Prerequisites (Yêu cầu)
1. Cài đặt **Java JDK 17** hoặc cao hơn.
2. Cài đặt **Apache Maven**.
3. Các trình duyệt tương thích: Chrome/Chromium, Firefox, WebKit (Safari).

## 📦 Project Structure (Cấu trúc Source Code)
```
qa-automation/
├── pom.xml
├── src/
│   ├── main/java/com/primeweb/pages/    -> Nơi chứa Page Object Model (POM) Locators & API Actions
│   └── test/java/com/primeweb/tests/    -> Nơi chứa các Test Classes mapping 1-1 với file QA .md
```

## 🚀 How to Run (Cách chạy Test)

### Chạy toàn bộ Test Cases
Mở Terminal tại thư mục `qa-automation` và gõ lệnh:
```bash
mvn test
```

### Chạy một Feature riêng biệt (VD: F09 Products)
```bash
mvn test -Dtest=ProductsCrudTest
```

### Tự động tải Trình duyệt (Chỉ cần chạy lần đầu)
Playwright sẽ tự động tải các Web Drivers (Chromium, Firefox, WebKit) ngay lần build/chạy Maven đầu tiên mà không cần bạn setup tay PATH.

## 📝 Quy ước Code Test
- Mỗi bộ Test phải extends `BaseTest` (để mượn Browser Context chung).
- Tuân thủ mapping Test Case ID với `@Test` annotation (e.g. `TC_09_01_AddNewProduct`).
- Dùng `assertThat()` (AssertJ) / `PlaywrightAssertions` thay vì `assertEquals` cũ của JUnit4 để code đọc tự nhiên nhất (End-User Empathy).

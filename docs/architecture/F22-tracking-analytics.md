# Architecture Design - F22: Tracking & Analytics Integration

## 1. Context & Scope
Tính năng F22 Tracking Integration cho phép Merchant chèn Tracking ID từ Dashboard CMS. Hệ thống PrimeWeb Storefront (Next.js) sẽ nhận Settings này và tự động chèn/render `<script>` Base tracking pixels tại Client-side. Tính năng này được xem là một extension (module thiết lập con) nằm trong Epic F19 (Store Configuration).

## 2. Component System Architecture

### 2.1 Admin Panel (Payload CMS / Backend Data)
- Settings Data Architecture cho Store Preferences sẽ được extend. Add thêm collection properties (Global configs):
```typescript
{
  tracking_settings: {
    ga4: {
      id: string,          // Ví dụ 'G-XVVXXX'
      is_enabled: boolean  // Toggle turn on GA tracking
    },
    fb_pixel: {
      id: string,          // Ví dụ '192931238'
      is_enabled: boolean
    },
    tiktok_pixel: {
      id: string,
      is_enabled: boolean
    }
  }
}
```
- Validate Regex tại Schema Mongoose / Payload CMS:
  - GA4 ID: `/^G-[A-Z0-9]+$/`
  - FB Pixel ID: `/^\d+$/`

### 2.2 PrimeWeb Storefront (Next.js 14+)
- **Data Fetching:** Storefront cần thông tin Tracking ở tầng Global (Root Layout) của từng Store để setup thẻ HEAD chung cho mọi Pages. 
  - Yêu cầu Next.js thực hiện fetch `Store Global Settings` theo Header `Host` (`store_domain`).
  - Request có thể tận dụng `React cache()` hoặc ISR caching của Next.js để không tốn I/O DB queries liên tục.

- **Script Injection Methodology (next/script):**
  - Trong `app/layout.tsx` (hoặc Global Layout Wrapper), tạo một `<TrackingManager storeSettings={settings} />` Client component.
  - Sử dụng module `next/script` hoặc `@next/third-parties/google`
```jsx
// GA4 example
import { GoogleAnalytics } from '@next/third-parties/google';
{tracking.ga4.is_enabled && tracking.ga4.id && (
   <GoogleAnalytics gaId={tracking.ga4.id} />
)}

// Facebook Pixel example
import Script from 'next/script';
{tracking.fb_pixel.is_enabled && tracking.fb_pixel.id && (
  <Script id="fb-pixel" strategy="afterInteractive">
    {`
      !function(f,b,e,v,n,t,s)
      ... fbq('init', '${tracking.fb_pixel.id}');
      fbq('track', 'PageView');
    `}
  </Script>
)}
```

## 3. Data Flow Overview
1.  **Merchant -> Admin CMS:** User cập nhật Tracking ID và bật Toggle -> Nhấn Save -> Gọi REST/GraphQL Mutation lưu vào `Store Configurations` Global Object.
2.  **Buyer -> Storefront Client:**
    - Khách hàng visit domain `shop.echprime.com`.
    - Next.js Server render (hoặc đọc cache) Store Configs trong đó có Tracking config.
    - Component TrackingManager đọc Config và xuất các thẻ `<script>` (third party library gtag.js, fbevents.js).
    - Client browser tải file JS bên thứ ba sau đó chạy tracking PageView.

## 4. Potential Risks & Mitigation
1. **Performance Bottlenecks:** Tracking scripts nổi tiếng với việc làm chậm TTFB / LCP do chèn nhiều tracking JS. 
   - *Mitigation:* Bắt buộc dùng chiến lược load script `afterInteractive` (hoặc `worker` / Partytown nếu hệ thống support) để không làm block frontend UI chính yếu.
2. **Security Injection (XSS):**
   - *Mitigation:* Không nhận custom script (raw code) từ phía DB config, mà build sẵn template script JS tại Frontend, chỉ replace `string` **ID** lấy từ backend vào vị trí an toàn trong chuỗi base tracking mặc định. Validator bắt buộc ID chỉ chứa characters an toàn (A-Z, 0-9, dấu gạch nối).

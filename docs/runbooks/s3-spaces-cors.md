# S3 / DigitalOcean Spaces — CORS cho direct upload

Ảnh/video trong Editor được trình duyệt `POST` **thẳng** lên bucket (presigned POST, xem `src/hooks/use-direct-upload.ts`). Trình duyệt gửi preflight `OPTIONS` tới bucket trước, nên **bucket phải có CORS rule cho origin của app**. CORS nằm ở hạ tầng (DO Spaces), không có trong repo.

## Triệu chứng khi thiếu CORS (GH-2203)

- Toast: `Could not reach storage (check CORS/network)`.
- Console: `Access to XMLHttpRequest at 'https://<region>.digitaloceanspaces.com/<bucket>' from origin '<app-origin>' has been blocked by CORS policy ... No 'Access-Control-Allow-Origin' header` và `net::ERR_FAILED`.
- Console app (`[media:direct-upload] Could not reach storage ...`) ghi `origin`, `storageHost` và `bucket` (đoạn đầu của path) để đối chiếu — thấy ngay nếu production trỏ nhầm bucket `-dev`; không ghi key/policy/signature.
- Không có request `POST` thật tới bucket và không có response XML → không có log `S3 POST failed`.

## CORS mẫu

Thay origin bằng origin thật của môi trường. **Không dùng `*` ở production.**

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://web-cms.ecommercehub.unifi.com.my"],
      "AllowedMethods": ["POST", "GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

Áp bằng DO Control Panel (Spaces → bucket → Settings → CORS Configurations) hoặc `aws s3api put-bucket-cors --bucket <bucket> --endpoint-url https://<region>.digitaloceanspaces.com --cors-configuration file://cors.json`. Cần quyền quản trị Spaces.

## Checklist go-live / đổi môi trường

- [ ] `S3_BUCKET`, `S3_ENDPOINT` (và `NEXT_PUBLIC_S3_ENDPOINT` nếu dùng) trên Vercel Dashboard đúng bucket của môi trường (production không trỏ bucket `-dev`; đối chiếu `.env.production.example`).
- [ ] Bucket đích có CORS rule với **origin cụ thể** của app (không `*`).
- [ ] Mọi origin chạy editor đều được liệt kê (domain app + custom domain tenant nếu editor chạy trên đó); thiếu origin nào thì lỗi lặp lại ở origin đó.
- [ ] Credentials cho phép ghi object với `acl: public-read` per-object (policy presign ép ACL này); không bật public policy toàn bucket.
- [ ] Kiểm tra bằng DevTools → Network: preflight `OPTIONS` tới bucket trả `Access-Control-Allow-Origin` = origin app; `POST` trả 2xx.
- [ ] Upload thử 1 ảnh và 1 video trong Editor; URL media trỏ đúng bucket; lưu trang và reload vẫn thấy media.
- [ ] Nếu đổi bucket: media cũ vẫn lưu URL bucket cũ — giữ bucket cũ đọc được hoặc migrate object + URL trước khi dừng bucket cũ.

Test liên quan: TC-F30-HMO-017 (E2E, cần CORS thật), TC-F30-HMO-020 (unit, thông báo lỗi).

# Phase 00 — Hạ tầng Firebase & env (không phải code)

## Overview
- Priority: P1 · Status: project test ✅, PW1 dev/prod ⬜
- Mapping: local → project test `pw2-c82c2` · staging → `primeweb-tm-development` · production → `prime-web-tm-production` · Vercel Preview (`qc-test`) → **không cấu hình** (client tự poll 60s)

## Checklist cho MỖI project PW1 (dev trước merge staging, prod trước lên main)
1. Project settings → Service accounts → Generate new private key → `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
2. Project settings → General → Your apps → Web app (tạo nếu chưa có) → `apiKey` → `FIREBASE_WEB_API_KEY`
3. Realtime Database → URL → `FIREBASE_DATABASE_URL`
4. Authentication → Get started (không bật provider)
5. Rules → **backup** → merge nhánh `pw2` (dưới) → Publish → verify PW1 export/chat-log vẫn chạy (AC-11)
6. Vercel Dashboard: 5 biến cho env tương ứng. `FIREBASE_PRIVATE_KEY` dán nguyên chuỗi có `\n`, không ngoặc kép
7. `node scripts/firebase-signal-smoke.mjs` (tạo ở phase 01) với env project đó → 8/8 OK
8. **Chỉ production:** xác nhận gói **Blaze** (Spark ~100 kết nối đồng thời, chia với PW1 → không đủ). Không lên `main` nếu chưa Blaze

## Rules nhánh pw2 (đã verify trên `pw2-c82c2`)
Nguồn: `firebase/pw2-database-rules.json` (phase 01)
```json
"pw2": {
  "$env": {
    "u": { "$userId": {
      ".read": "auth != null && auth.uid === 'pw2_' + $env + '_' + $userId",
      ".write": false } },
    "broadcast": {
      ".read": "auth != null && auth.uid.beginsWith('pw2_' + $env + '_')",
      ".write": false }
  }
}
```

## ⚠️ Rules cascade
RTDB: `.read: true` ở node cha thì con không thu hồi được. PW1/SSO đọc không cần auth → rules PW1 có thể là root `".read": true`.
| Rules PW1 hiện tại | Hành động |
|---|---|
| Grant theo từng nhánh (`chat_logs`, `{model}/exports`…) | Thêm key `"pw2"` cạnh các nhánh ✅ |
| Root `".read": true` | **Dừng, báo lại.** Phương án: (a) đổi root thành grant từng nhánh PW1 (phải liệt kê đủ path PW1 đọc — rủi ro hỏng PW1); (b) chấp nhận `pw2` đọc công khai (chỉ lộ thời điểm + userId có noti, không lộ nội dung) |

`.write` của PW1 dùng legacy secret → bypass rules, không ảnh hưởng.

## Success criteria
- Smoke script pass trên từng project; PW1 vẫn nhận noti sau khi publish rules; production đã Blaze

## Security
- Service account JSON không commit, không gửi chat; xoá file sau khi nhập env
- `apiKey` web là public by design (trả về client qua endpoint có auth)

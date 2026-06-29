# Phase 04 — Deferred (P2)

**Ưu tiên:** P2 — nice-to-have, làm sau khi P0/P1 ổn.

## 1. Diff badge "Synced from EasyParcel / Edited locally / Differs"

Cho merchant biết warehouse local có lệch với pickup_address bên EP không.
- Cần lưu snapshot EP pickup (thêm cột JSON `easy_parcel_integration_ep_pickup_snapshot` + migration) HOẶC re-pull mỗi lần load (chậm, rate-limited).
- So sánh warehouse local vs snapshot → badge.
- ROI thấp vì nút "Sync from EasyParcel" (P1) đã cho pull latest. Cân nhắc YAGNI.

## 2. Webhook thay cron polling

Hiện tracking dùng cron `sync-tracking` (poll). EP có 5 webhook topic:
- Shipment Status Update, Shipment AWB Update, Tracking Status Update, Shipment Created, On-Demand Order Status.
- Setup ở Developer Hub → Apps → Webhook.
- Cần route nhận webhook + verify signature/token. Xem `_webhooks.md` (2026-03).
- Lợi: real-time, giảm tải poll. Hại: cần endpoint public + verify bảo mật.

## 3. Multiple pickup addresses

EP hỗ trợ nhiều pickup address; ECH chỉ lưu 1 `warehouse`. Chỉ làm nếu có nhu cầu thật (YAGNI — v1 chắc 1 đủ).

## Lưu ý sandbox (từ research)

- Sandbox EP KHÔNG tự update shipment status (cố ý) → test tracking sẽ đứng yên.
- SMS/email/WhatsApp tracking không chạy ở sandbox.

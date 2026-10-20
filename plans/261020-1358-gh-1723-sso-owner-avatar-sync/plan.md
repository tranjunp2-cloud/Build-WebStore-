---
issue: 1723
status: in-progress
created: 2026-10-20
repos: [ech-prime-web-v2, sso-api]
---

# GH-1723 — Đồng bộ avatar Owner từ SSO sang PWv2 (implementation)

Plan chính, đặt ở PWv2. Repo SSO chỉ có plan ngắn trỏ về đây (tạo ở Phase 03).

## Bối cảnh
- Issue: https://github.com/primeproduction/ech-prime-web-v2/issues/1723 (đề xuất kỹ thuật + phân công: comment ngày 2026-10-20)
- Plan tài liệu của BA (giữ nguyên): `plans/260908-gh-1723-sso-owner-avatar/`
- Kết quả scout: `plans/reports/scout-261019-1754-sso-owner-avatar-implementation.md`
- **Contract API (nguồn duy nhất):** [`contract-sso-pw2-avatar-sync.md`](./contract-sso-pw2-avatar-sync.md)

## Hướng giải quyết (tóm tắt)
SSO đẩy trạng thái avatar sang `POST /api/v1/sso/sync-avatar` của PWv2 (Bearer super-admin, giống 9 route `/v1/sso/*`). PWv2 tải ảnh về Media, gán vào `users.avatar`. SSO gửi lại khi Owner mở PWv2 (bù lần đẩy bị lỡ). Backfill một lần bằng artisan command. Owner bị chặn tự đổi avatar ở PWv2. Staff giữ nguyên.

## Phases
| # | Phase | Repo | Phụ thuộc | Ước lượng | Trạng thái |
|---|---|---|---|---|---|
| 01 | [Chặn Owner tự đổi avatar](./phase-01-pw2-block-owner-avatar.md) | PWv2 | — | 0.5d | ✅ code + test |
| 02 | [Schema + endpoint sync-avatar](./phase-02-pw2-schema-sync-endpoint.md) | PWv2 | contract | 2d | ✅ code + test |
| 03 | [SSO: job đẩy avatar + gửi lại khi mở PWv2](./phase-03-sso-push-job-and-login-resync.md) | SSO | contract | 1–1.5d | ✅ code (php -l) |
| 04 | [Backfill + báo cáo map user](./phase-04-backfill-and-identity-report.md) | SSO + PWv2 | 02, 03 | 0.5–1d | 🟡 command xong, chờ chạy staging |
| 05 | [E2E staging + tài liệu](./phase-05-staging-e2e-and-docs.md) | PWv2 | 01–04 | 1d | 🟡 CHANGELOG/CODEBASE_SUMMARY/QA xong; chờ E2E + PRD (PO) |

Phase 02 và 03 làm song song được (cùng dựa trên contract).

## Branch / PR
| Repo | Branch | Base / PR vào |
|---|---|---|
| PWv2 | `feat/F23-1723-sso-owner-avatar-sync` | `staging`, `Relates to #1723` |
| SSO | `feat/gh-1723-pw2-avatar-sync` (checkout trong `~/data/sso-api`) | `origin/tm-dev-deploy` |

- Code SSO ban đầu làm trên worktree, đã chuyển về `~/data/sso-api` (2026-10-20).
- Không tự commit; user review diff trước.

## Thứ tự deploy / rollback
1. PWv2 (endpoint thụ động, chưa ai gọi → an toàn).
2. SSO (bắt đầu đẩy).
3. Chạy backfill (Phase 04), xem báo cáo ngoại lệ.

Rollback: revert/deploy lại SSO (không có công tắc env; job còn trong queue vẫn chạy tiếp, cần thì xóa queue `default`). PWv2 giữ avatar đang có.

## Quyết định còn chờ
- PO: đồng ý sửa BR-23-04 / FR-23-13 (bind lần đầu bằng email có điều kiện). Nếu không: tắt bước bind bằng email (`allowEmailBind=false` trong code PWv2), chỉ nhận `sso_user_id` đã gắn sẵn.
- Security: chấp nhận Bearer super-admin cho endpoint mới.

## Ràng buộc
- Không thêm test phía SSO (theo yêu cầu). SSO kiểm chứng qua E2E staging (Phase 05).
- PWv2 test bắt buộc có TC-ID `TC-F23-SSO-*` (`docs/qa/F23-personal-profile.md`).
- Migration mới → `scripts/db-setup.js` `MIGRATIONS` (CI `check-migrations.js` chặn nếu thiếu).

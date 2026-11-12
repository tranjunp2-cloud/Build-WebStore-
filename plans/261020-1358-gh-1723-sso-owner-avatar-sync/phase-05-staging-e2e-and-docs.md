# Phase 05 — E2E staging + tài liệu

**Repo:** PWv2 (docs) + kiểm thử 2 hệ thống · **Trạng thái:** ⬜ · **Phụ thuộc:** 01–04

## E2E staging (thủ công, ghi bằng chứng vào issue)
| TC | Kịch bản | Kỳ vọng |
|---|---|---|
| TC-F23-SSO-03 | Owner đổi avatar trên SSO | Header + Personal Profile PWv2 đổi trong ≤ 5 phút (thực tế vài giây) |
| TC-F23-SSO-04 | Tắt tạm job/queue SSO, đổi avatar, bật lại → Owner mở PWv2 từ SSO | avatar được cập nhật nhờ trigger `login`; login không bị chậm/chặn |
| TC-F23-SSO-06 | Gửi tay `avatar_url` trả 503/timeout (curl tới endpoint) | giữ avatar cũ, SSO log retry |
| TC-F23-SSO-10 | Owner gọi `POST /api/users/me/avatar` | 403; Staff upload vẫn OK |
| Regression | Staff đổi avatar, Owner/Staff xem Header | không đổi hành vi |

## Tài liệu PWv2
| File | Cập nhật |
|---|---|
| `docs/prd/F23-personal-profile.md` | BR-23-04, FR-23-13 → bind lần đầu bằng email có điều kiện (sau khi PO đồng ý) |
| `docs/stories/F23-personal-profile-stories.md` | US-F23-05 AC khớp contract (PRESENT/ABSENT/UNKNOWN thực tế: SSO không có delete) |
| `docs/decisions/decisions-log.md` | quyết định: mô hình SSO push + Bearer super-admin + bind email có điều kiện |
| `docs/qa/F23-personal-profile.md` | `TC-F23-SSO-*`: Planned → file test thực tế / manual |
| `docs/architecture/F23-*.md` (hoặc tạo `F23-sso-avatar-sync.md`) | sơ đồ luồng + link contract |
| `docs/CHANGELOG.md`, `docs/CODEBASE_SUMMARY.md` | endpoint mới, field users mới, `src/lib/sso/avatar-sync/` |

## SSO
Không sửa `document/api.md` (không có endpoint SSO mới). Mô tả PR SSO: link issue #1723 + PR PWv2 + contract.

## Hoàn thành khi
- [ ] Bằng chứng E2E đăng lên issue #1723
- [ ] Docs cập nhật, 2 PR link chéo; issue chuyển `qa:pending` sau khi deploy staging (không auto-close)

# Phase 01 — PWv2: chặn Owner tự đổi avatar

**Repo:** PWv2 · **Ưu tiên:** P0 · **Trạng thái:** ⬜ · **Phụ thuộc:** không (PD-F23-02 đã chốt)

## Vấn đề
- `src/app/api/users/me/avatar/route.ts:16` cố ý không chặn Owner.
- `src/collections/Users.ts:1141-1158`: self-update cho phép sửa mọi field, kể cả `avatar` (`PATCH /api/users/:id` hoặc GraphQL).
- UI Owner đã read-only (`owner-profile-view.tsx`) → chỉ sửa backend.

## Việc cần làm
1. `avatar/route.ts`: sau `getCurrentUser`, gọi `blockOwner(user)` (`src/lib/profile/role-guard.ts`) → 403. Xóa comment dòng 16. Cần đảm bảo `getCurrentUser` trả về `tenants` (kiểm tra; nếu không thì `findByID depth:0`).
2. `Users.ts` field `avatar`: thêm `access.update` — cho phép khi `req.user` là super-admin, hoặc khi `req.user` không phải Owner. Owner → false. Luồng sync (Phase 02) dùng Local API `overrideAccess: true` nên không bị chặn.
   - Lưu ý field access chỉ chặn ghi field, request vẫn 200 cho field khác → đúng mong muốn.
3. Không đổi UI.

## File
- Sửa: `src/app/api/users/me/avatar/route.ts`, `src/collections/Users.ts`
- Test: `src/__tests__/unit/profile/api-users-me-avatar.test.ts` (thêm case), test field access mới trong `src/__tests__/unit/profile/` (vd `users-avatar-field-access.test.ts`) — import access fn từ source, không viết lại logic.

## Test (TC-F23-SSO-10)
- Owner POST avatar → 403, không gọi `payload.create`.
- Staff POST avatar → luồng cũ chạy (`create` + `update` được gọi).
- Field access `avatar.update`: owner → false; staff → true; super-admin → true.

## Hoàn thành khi
- [ ] 2 thay đổi trên + test pass (`npm test -- profile`)
- [ ] `npx tsc --noEmit` sạch
- [ ] Staff upload thủ công trên local OK

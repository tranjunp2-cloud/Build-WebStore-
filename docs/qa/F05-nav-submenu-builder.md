# Quyết Định Kiểm Thử & Testcase: GH-1204 — Navigation Submenu Builder UX

> **Issue:** #1204 — rebuild navigation submenu builder UX (F05 editor)
> **PR:** #1261
> **Phạm vi test tự động:** `src/components/editor/navigation-tree-helpers.ts` (9 pure function, không cần mock).
> UI/DnD (3 click zone, drop indicator, toolbar hide rules) verify bằng E2E/manual.

## 1. Mục Tiêu

Khóa hành vi của các pure function dựng/biến đổi cây menu 2 cấp: nest, flatten khi vượt cấp, di chuyển cross-parent, indent/outdent, và đảm bảo **không thao tác nào tạo ra cấp 3** (invariant cốt lõi của menu 2-level).

## 2. Test Environment

| Thông số | Yêu cầu |
|---|---|
| Test runner | Vitest 3 (unit) |
| Module | `navigation-tree-helpers.ts` |
| Data | Cây menu dựng inline trong test (root + children), không dùng DB/mock. |

## 3. Test Cases

| ID | Ref | Loại | Tiêu đề | Kết quả mong đợi |
|:---|:---|:---|:---|:---|
| **TC-F05-NAV-01** | `US-1204/nest` | `Logic` | `nestAsChild` nest leaf vào parent | Active (leaf) bị gỡ khỏi vị trí cũ và thành child cuối của parent. |
| **TC-F05-NAV-02** | `US-1204/nest` | `Edge` | `nestAsChild` self-target → no-op | `activeId === parentId` → trả về cây nguyên trạng. |
| **TC-F05-NAV-03** | `US-1204/nest` | `Edge` | `nestAsChild` id không tồn tại → no-op | activeId không có trong cây → trả về cây nguyên trạng. |
| **TC-F05-NAV-04** | `US-1204/flatten` | `Logic` | `nestWithFlatten` đúng thứ tự | Kết quả children của parent = [children cũ của parent, active (đã strip con), …con cũ của active]. |
| **TC-F05-NAV-05** | `US-1204/depth` | `Logic` | `nestWithFlatten` không tạo cấp 3 | Sau flatten, độ sâu cây tối đa = 2 (active + con cũ của active đều nằm ở cấp 2). |
| **TC-F05-NAV-06** | `US-1204/move` | `Logic` | `moveAsSibling` cross-parent (after) | Active gỡ khỏi parent A, chèn ngay sau `over` trong children của parent B. |
| **TC-F05-NAV-07** | `US-1204/move` | `Logic` | `moveAsSibling` chèn before | Active chèn ngay trước `over`. |
| **TC-F05-NAV-08** | `US-1204/indent` | `Logic` | `indentLinkInTree` round-trip với `outdentLinkInTree` | indent rồi outdent trả về cấu trúc tương đương ban đầu (cùng thứ tự id ở root). |
| **TC-F05-NAV-09** | `US-1204/indent` | `Edge` | `indentLinkInTree` ở vị trí đầu → no-op | Item index 0 không có sibling trước → cây nguyên trạng. |
| **TC-F05-NAV-10** | `US-1204/outdent` | `Logic` | `outdentLinkInTree` promote child lên root | Child được gỡ khỏi parent và chèn ngay sau parent ở cấp root. |
| **TC-F05-NAV-11** | `US-1204/crud` | `Logic` | `deleteLinkInTree` xóa sâu | Xóa đúng node ở bất kỳ cấp, giữ nguyên phần còn lại. |
| **TC-F05-NAV-12** | `US-1204/crud` | `Logic` | `updateLinkInTree` / `addChildInTree` / `findLinkAndParent` | Update đúng node sâu; add child đúng parent; find trả về parentId + index đúng. |

# Quyết Định Kiểm Thử & Testcase: GH-1222 — Design System Table Standardization

> **Issue:** #1222 [Design System] Standardize base Table component, border tokens & in-table sub-components
> **Milestone:** v1.1 — Phase 2
> **Tổng TCs:** 29 (TC-DS1222-01-01 → TC-DS1222-07-04)
> **Component mẫu:** F33 Discount Codes (team Design)

## 1. Mục Tiêu

Đảm bảo 7 base component dùng chung (`Table`, `Switch`, `Badge`, `FilterChip`, `TablePagination`, `TableSearch`, `TableEmptyState`) render đúng hợp đồng cấu trúc + token, để mọi bảng dashboard đồng bộ và regression bị CI bắt (lấp Gap 3 trong QA review #1222).

## 2. Test Environment

| Thông số | Yêu cầu |
|---|---|
| Test runner | Vitest 3 (unit) + @testing-library/react |
| Môi trường | jsdom |
| Phạm vi | `src/components/ui/{table,switch,badge,filter-chip,table-pagination,table-search,table-empty-state}.tsx` |
| Lưu ý | Border line render qua `.dash-table` rule trong `globals.css` (jsdom không load CSS) → test xác nhận **hợp đồng cấu trúc**: class `.dash-table` được apply + token border inline trên wrapper. Màu light/dark verify bằng E2E visual. |

## 3. Test Cases

### NHÓM 01 — Table (base primitives)

| ID | Loại | Tiêu đề | Kết quả mong đợi |
|:---|:---|:---|:---|
| **TC-DS1222-01-01** | `[Positive]` | Table áp class `.dash-table` | `<table>` render có class `dash-table` (CSS rule vẽ border row bám vào class này). |
| **TC-DS1222-01-02** | `[Positive]` | Wrapper mang token border | Wrapper div có inline `border` dùng `var(--dash-border)` + nền `var(--dash-surface)`. |
| **TC-DS1222-01-03** | `[Positive]` | Footer slot render trong card | Truyền `footer` → nội dung footer hiển thị, có border-top token. |
| **TC-DS1222-01-04** | `[Positive]` | TableActionButton trung tính mặc định | Variant `default` không có class hover đỏ; variant `danger` có `hover:text-red-400`. |
| **TC-DS1222-01-05** | `[Positive]` | SortableHead đổi affordance theo cột active | Cột đang sort hiện chevron up/down; cột khác hiện icon mờ; click gọi `onSort(key)`. |
| **TC-DS1222-01-06** | `[Positive]` | TableHead render muted label band | `<th>` render đúng text + dùng token `var(--dash-text-muted)` cho màu nhãn header. |

### NHÓM 02 — Switch / Toggle

| ID | Loại | Tiêu đề | Kết quả mong đợi |
|:---|:---|:---|:---|
| **TC-DS1222-02-01** | `[Positive]` | Size cố định không stretch trong cell | Track có class `h-5 w-9 shrink-0` → không co giãn theo row height (bug gốc #1222). |
| **TC-DS1222-02-02** | `[Positive]` | Toggle gọi onCheckedChange với giá trị đảo | Click switch `checked=false` → `onCheckedChange(true)`. |
| **TC-DS1222-02-03** | `[Positive]` | aria-checked phản ánh state | `role="switch"`, `aria-checked` = giá trị `checked`. |
| **TC-DS1222-02-04** | `[Negative]` | Disabled không trigger change | `disabled` → click không gọi `onCheckedChange`, có class `cursor-not-allowed`. |

### NHÓM 03 — Badge

| ID | Loại | Tiêu đề | Kết quả mong đợi |
|:---|:---|:---|:---|
| **TC-DS1222-03-01** | `[Positive]` | Render đủ 6 variants | default/secondary/destructive/outline/success/warning đều render với class đặc trưng. |
| **TC-DS1222-03-02** | `[Positive]` | border-solid explicit (preflight off) | Class base chứa `border-solid` để outline thực sự vẽ. |
| **TC-DS1222-03-03** | `[Positive]` | Dot indicator | `dot` → render span dot `rounded-full` `aria-hidden`; không `dot` → không có span. |

### NHÓM 04 — FilterChip

| ID | Loại | Tiêu đề | Kết quả mong đợi |
|:---|:---|:---|:---|
| **TC-DS1222-04-01** | `[Positive]` | Hiển thị label + option đang chọn | Render `label :` + label của option khớp `value`. |
| **TC-DS1222-04-02** | `[Positive]` | Mở dropdown hiện danh sách option | Click pill → render đủ option. |
| **TC-DS1222-04-03** | `[Positive]` | Chọn option gọi onChange + đóng | Click option → `onChange(key)`; dropdown đóng. |
| **TC-DS1222-04-04** | `[Positive]` | Active highlight khi khác default | `value` ≠ option[0].key → pill style active (viền/nền xanh). |

### NHÓM 05 — TablePagination

| ID | Loại | Tiêu đề | Kết quả mong đợi |
|:---|:---|:---|:---|
| **TC-DS1222-05-01** | `[Positive]` | Hiển thị "Showing from–to of total" | total=50, page=1, limit=10 → "1–10" + "50". |
| **TC-DS1222-05-02** | `[Positive]` | Page range thu gọn bằng ellipsis | total nhiều trang → có ký tự `…`. |
| **TC-DS1222-05-03** | `[Negative]` | Prev disabled ở trang đầu / Next ở trang cuối | page=1 → prev disabled; page=cuối → next disabled. |
| **TC-DS1222-05-04** | `[Positive]` | Click số trang gọi onPageChange | Click trang 2 → `onPageChange(2)`. |
| **TC-DS1222-05-05** | `[Positive]` | Đổi rows-per-page gọi onLimitChange | Chọn select → `onLimitChange(n)`; ẩn select khi không truyền `onLimitChange`. |
| **TC-DS1222-05-06** | `[Edge]` | total=0 hiển thị 0–0 | from=0, to=0. |

### NHÓM 06 — TableSearch

| ID | Loại | Tiêu đề | Kết quả mong đợi |
|:---|:---|:---|:---|
| **TC-DS1222-06-01** | `[Positive]` | Debounce gọi onSearch sau delay | Gõ input → `onSearch` chỉ gọi sau `debounceMs`. |
| **TC-DS1222-06-02** | `[Negative]` | Không gọi onSearch lúc mount | Mount với value sẵn → không gọi `onSearch` (tránh clobber `?page=N`). |
| **TC-DS1222-06-03** | `[Positive]` | Re-sync input khi value đổi từ ngoài | Prop `value` đổi → input cập nhật theo. |

### NHÓM 07 — TableEmptyState

| ID | Loại | Tiêu đề | Kết quả mong đợi |
|:---|:---|:---|:---|
| **TC-DS1222-07-01** | `[Positive]` | Render title + subtitle | Hiển thị đúng title & subtitle. |
| **TC-DS1222-07-02** | `[Positive]` | Icon + action tùy chọn | Truyền `icon`/`action` → render; không truyền → không render. |
| **TC-DS1222-07-03** | `[Positive]` | Token surface + border | Wrapper có nền `var(--dash-surface)` + border `var(--dash-border)`. |
| **TC-DS1222-07-04** | `[Positive]` | compact đổi padding | `compact` → `py-12`; mặc định → `py-24`. |

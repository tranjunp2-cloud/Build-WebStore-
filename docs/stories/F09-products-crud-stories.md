# User Stories: Products CRUD (F09)

> **Feature:** F09 — Products CRUD (Dashboard)  
> **Wave:** 4 | **Priority:** P0 | **Ref PRD:** [F09-products-crud.md](../prd/F09-products-crud.md) (pending)

---

## US-007: Products — CRUD + AI Description

**Wave 4** | **P0** | **L** | Status: Draft

### Story
```
As a   site owner
I want thêm sản phẩm, AI viết description
So that sản phẩm có mô tả đẹp không mất thời gian
```

### Acceptance Criteria
```gherkin
GIVEN user ở /dashboard/products
WHEN  click "Thêm sản phẩm"
THEN  form: tên, giá (RM), category, mô tả, ảnh (max 5, max 5MB), stock

GIVEN user điền tên sản phẩm
WHEN  click "✨ AI Viết Description"
THEN  AI generate description dựa trên tên + ngành
AND   user Accept hoặc chỉnh sửa

GIVEN user delete sản phẩm
WHEN  confirm
THEN  soft delete, toast "Đã xóa. Hoàn tác?" 5s
```

### MY Market Notes
- Price format: `RM XX.XX`
- Support Halal cert upload per product (P2)
- Category suggestions should include MY-specific types (Baju Kurung, Kuih, etc.)

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Product appears on storefront after create
- [ ] AI description works in BM and EN

# Architecture: Products CRUD (F09)

> **Version:** 1.0 | **PRD:** [F09-products-crud.md](../prd/F09-products-crud.md)  
> **Tech:** Payload CMS 3 (Products collection) + OpenAI

---

## 1. Data Model (Payload CMS Collection)

```typescript
// collections/Products.ts
const Products: CollectionConfig = {
  slug: 'products',
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true },
    { name: 'price', type: 'number', required: true },
    { name: 'compareAtPrice', type: 'number' },
    { name: 'description', type: 'richText' },
    { name: 'descriptionBM', type: 'richText' },  // Bahasa Melayu
    { name: 'category', type: 'relationship', relationTo: 'categories' },
    { name: 'images', type: 'array', fields: [
      { name: 'image', type: 'upload', relationTo: 'media' }
    ], maxRows: 5 },
    { name: 'variants', type: 'array', fields: [
      { name: 'name', type: 'text' },
      { name: 'sku', type: 'text' },
      { name: 'price', type: 'number' },
      { name: 'stock', type: 'number' },
    ]},
    { name: 'stock', type: 'number', defaultValue: 0 },
    { name: 'status', type: 'select', options: ['draft', 'active', 'archived'] },
    { name: 'site', type: 'relationship', relationTo: 'sites', required: true },
  ],
  access: {
    read: ({ req }) => ({ site: { equals: req.user?.activeSite } }),
    create: ({ req }) => !!req.user,
  },
}
```

## 2. Component Tree

```
ProductsPage (/dashboard/products)
├── ProductsHeader
│   ├── Title + Count
│   ├── FilterBar (status, category, search)
│   └── AddProductButton
├── ProductsTable
│   ├── ProductRow × N
│   │   ├── Thumbnail + Name
│   │   ├── Price
│   │   ├── Stock (low-stock warning)
│   │   ├── Status badge
│   │   └── Actions (Edit, Delete, Duplicate)
│   └── BulkActions
│       └── "Generate All Descriptions" (AI)
└── ProductDetailModal (slide-over)
    ├── ProductForm (Zod validation)
    ├── ImageUploader (max 5, drag-drop)
    ├── VariantsEditor
    └── AIDescriptionButton
```

## 3. API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/products` | List products (paginated, filtered) |
| POST | `/api/products` | Create product |
| PATCH | `/api/products/[id]` | Update product |
| DELETE | `/api/products/[id]` | Soft delete |
| POST | `/api/products/generate-description` | AI generate description |

## 4. AI Description Flow

```
User clicks "Generate Description with AI"
       ↓
POST /api/products/generate-description
  body: { name, price, category, images }
       ↓
OpenAI streamText():
  - Generate BM description (primary)
  - Generate EN description (secondary)
  - Include: selling points, material info, sizing, care instructions
       ↓
Stream response to UI → editable textarea
       ↓
User edits → saves
```

## 5. Error Matrix

| Error | User Sees | Recovery |
|-------|-----------|----------|
| Image upload > 5MB | Inline error "Max 5MB" | Resize/compress |
| Duplicate SKU | Inline error on variant field | Change SKU |
| AI description fail | Toast + manual input | Retry button |
| Stock = 0 | Auto-hide from storefront | Restock to show |

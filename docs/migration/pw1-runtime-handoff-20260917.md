# PW1 runtime code handoff — 2026-09-17

Destination: `.` (importer worktree). Source: `<worktree-2>`.

## Moved

- `src/__tests__/unit/collections/products-hooks.test.ts`
- `src/app/(dashboard)/blog/actions.ts`
- `src/app/(dashboard)/products/[id]/page.tsx`
- `src/components/dashboard/ImageUploader.tsx`
- `src/components/dashboard/product-form/GeneralInfoSection.tsx`
- `src/components/dashboard/product-form/schema.ts`
- `src/components/storefront/ProductImageGallery.tsx`
- `src/i18n/locales/en.json`
- `src/i18n/locales/ms.json`
- `src/lib/ai/seed-blog-posts.ts`
- `src/scripts/seed-storefront.ts`
- `src/lib/products/description-edit.ts`
- `src/__tests__/unit/collections/tenant-slug.test.ts`
- `src/__tests__/unit/dashboard/product-description-edit.test.ts`
- `src/__tests__/unit/migration/pw1-product-content-limits.test.ts`
- `src/__tests__/unit/migration/pw1-product-gallery.test.tsx`
- `tests/f42-product-description-preservation.spec.ts`
- `playwright.f42-local.config.ts`
- `docs/runbooks/f42-local-browser-regression.md`

## Existing importer implementation retained

- `scripts/db-setup.js`
- `src/collections/Products.ts`
- `src/collections/Blogs.ts`
- `src/collections/BlogCategories.ts`
- `src/collections/Orders.ts`

Importer already has tenant-scoped collection indexes, uncapped Product description/images, optional historical Order product relation, and reviewed transactional schema migration in `scripts/pw1-content-schema.js` called by db-setup. These files were not overwritten. Product slug lookup also preserves the importer-specific `req` transaction context.

Reviewed paths: Product edit → descriptionEditPatch → saveProductAction → Payload update; blog action and AI/storefront seed slug checks; form/uploader/gallery image limits; importer runtime hook guards, writer and target-schema preflight. Core pw1-json importer code was not changed by this transfer.

## Verification

- 237 tests passed: 161 runtime/importer tests plus 76 blog/seed/uploader tests.
- TypeScript passed; git diff --check passed.
- Playwright --list discovers one real browser test. Browser execution was not repeated in this transfer; requires the isolated local DB/server in the transferred runbook. Its historical successful run remains historical evidence, not a new run.
- No database writes, migration apply, commit or push performed in this transfer.

## Source cleanup and recovery

Restored the 16 transferred/superseded tracked runtime files to source HEAD; removed the eight transferred new files from the exporter worktree after byte comparison and tests. Source CSVs, artifacts and research documents were not removed. Exporter commit 15eb24f68 remains unchanged.

Private recovery copy and exact file hashes: exporter `.migration/handoff/pw2-runtime-20260917/` (all-source-changes.patch, runtime.patch, source files, manifest.json). Research plans/journals/gap reports remain with exporter; this handoff is the cross-worktree reference.

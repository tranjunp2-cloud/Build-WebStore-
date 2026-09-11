# Phase 02 — Adapter Payload/Postgres thật và renderer registry

## Mục tiêu

Đọc `pages.layout` thật của site PW2 đã được mapping, compare canonical evidence, sau đó kiểm tra renderer trên block thật bằng registry/runtime policy.

## File targets

- **New:** `src/lib/admin/qa/pw2-payload-render-evidence.ts` — server-side Payload reader and canonical field compare.
- **Modify:** `src/lib/admin/qa/pw1-mysql-connector.ts` — expose minimal sanitized PW1 block identity/data adapter; retain existing connector compatibility, do not use generated previews as evidence.
- **Modify:** `src/lib/admin/qa/migration-render-evidence.ts` — connect mapping + PW1 + PW2 evidence.
- **Use, do not duplicate:** `src/blocks/registry.ts`, `src/lib/admin/block-registry-reader.ts`, `src/components/site-renderer/SiteRenderer.tsx`.
- **Optional only if renderer marker contract approved:** `src/components/site-renderer/SiteRenderer.tsx` to attach a non-secret opaque `data-qa-block-id` marker to rendered block wrappers.

## Implementation steps

1. Resolve site/page/block only through exact mapping row, then fetch PW2 `pages` with a bounded `where` and minimal selected data. Verify mapped layout `id` and `blockType` still exist; do not use first same-position/type fallback.
2. Canonicalize only approved comparable fields (strip volatile IDs/timestamps, normalize rich-text structural form under an explicit policy). Return `migrated`, `missing`, `mismatch` plus safe reason/evidence.
3. Call `blockRegistry.has(actualPw2Block.blockType)` only after data evidence identifies the real block. If template has a per-site allow-list, also require that allow-list; otherwise report `unverified` until its contract arrives.
4. Never mark data failed merely because registry lacks renderer. Renderer missing maps to `component: unsupported` with data status retained.
5. Keep every query tenant/site-scoped and batched per page; never issue a query per block. Explicitly handle removed/malformed layout blocks and payload errors as `unverified` with reason code, not `missing`.

## Acceptance / test mapping

- TC-F40-13-01: exact legacy mapping success, missing and stale mapping paths.
- TC-F40-13-03 (Unit, Critical): existing PW2 block with registered renderer is `supported`; existing block with no registry entry is `unsupported`; no actual PW2 block gives `unverified`, not unsupported.
- TC-F40-13-05 (Unit, High): mismatch comparison remains data mismatch even when component is supported.

## Exit criteria

- A live/staging-safe fixture proves data evidence originates from Payload result, not `pw2Preview`.
- Query and registry failures are observable reason codes but never converted to a pass.

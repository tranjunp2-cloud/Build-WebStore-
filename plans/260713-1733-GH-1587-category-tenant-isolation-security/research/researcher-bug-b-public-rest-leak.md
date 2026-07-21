# Research: Payload Public REST API Tenant Isolation Gap

**Status:** DONE
**Scope:** Cross-tenant data leak via unscoped anonymous reads in Payload REST API
**Severity:** CRITICAL (systemic, affects 4+ collections)

---

## 1. Established Pattern: Storefront Public Reads

**Finding:** Storefront API routes are safely scoped; collection access control is not.

- **Current safe pattern** (`/api/storefront/*`):
  - Uses `overrideAccess: true` to bypass collection-level access
  - Manually adds site/tenant filter in the `where` clause
  - Strips sensitive fields from response (e.g., tenant/site relationships)
  - Examples: `/api/storefront/products` (filters by `site` ID) + `/api/storefront/blogs` (filters by `tenant` ID)

- **Why collection-level access insufficient:** Access functions only receive `{ req }` (user context), not query params. Cannot dynamically enforce "require site=X query param" at access layer — must happen in a route wrapper instead.

---

## 2. Live Consumer Analysis

**Finding:** NO legitimate public consumer exists for unscoped collection endpoints.

| Feature | Route | Status | Uses Raw REST API? |
|---------|-------|--------|-------------------|
| Product storefront | `/sites/[slug]/products/_page.disabled.tsx` | **DISABLED** | NO (would use `/api/storefront/products` if enabled) |
| Category storefront | `/sites/[slug]/categories/**` | **NEVER IMPLEMENTED** | N/A |
| Blog storefront | `/sites/[slug]/blog/**` | **UNKNOWN** | NO (uses `/api/storefront/blogs` custom route) |

**Conclusion:** All real storefront features use custom `/api/storefront/*` routes, not Payload's raw `/api/[...slug]` REST endpoints. The generic REST API reads are **pure attack surface with zero legitimate use.**

---

## 3. Systemic Scope: All Affected Collections

**CRITICAL:** Not just Categories — affects 4 collections with unscoped anonymous reads:

| Collection | Anonymous Read Returns | Missing Scope? | Severity |
|------------|----------------------|---|---|
| **BlogCategories** | `return true` (line 12) | YES — returns ALL docs | **HIGHEST** |
| **Products** | `{ status: 'active', deletedAt: false }` (lines 255–259) | YES — all active products from all tenants | HIGH |
| **Blogs** | `{ status: 'published' }` (line 36) | YES — all published blogs from all tenants | HIGH |
| **Categories** | `{ deletedAt: false }` (line 29) | YES — all categories from all tenants | HIGH |
| Sites | `return false` | NO — blocks anonymous | SAFE |
| Orders, Customers, Discounts | `return false` | NO — blocks anonymous | SAFE |

**Leaked data risk:** BlogCategories (all tenant names + descriptions), Products (pricing, SKUs, inventory across tenants), Blogs (published content cross-tenant), Categories (category hierarchies + metadata).

---

## 4. Safe Minimal Fix Options (Ranked)

### **Option A (RECOMMENDED) — Block Anonymous Entirely**
```typescript
// Categories.ts, Products.ts, Blogs.ts, BlogCategories.ts
read: ({ req }) => {
    if (!req.user) return false  // ← NEW: block instead of unscoped allow
    // ... rest of logic
}
```
- **Why:** No live consumer needs these endpoints public. Storefront features use custom routes.
- **Tradeoff:** Slightly inconvenient if external systems query raw REST API, but:
  - No external consumers documented
  - Storefront feature (GH-1588 PR-2) will implement proper scoped public endpoint when ready
  - Aligns with principle: deny-by-default for sensitive data, add access only when needed
- **Implementation:** 4 lines × 4 files (16 LOC total)
- **Risk:** Negligible — GH-1588 will re-add public read via custom `/api/storefront/categories` route with explicit site/tenant scoping
- **Timeline:** Can ship now; GH-1588 implements proper replacement

### **Option B — Scope via Hardcoded Fallback (Complex, Not Recommended)**
Return a synthetic filter that blocks without explicit scope:
```typescript
read: ({ req }) => {
    if (!req.user) return { id: { equals: 'nonexistent-id' } }  // ← always empty
    // ...
}
```
- **Why not:** Misleading — appears to allow public reads but returns nothing. Confusing for future maintainers.

### **Option C — Query Param Inspection (NOT FEASIBLE)**
Attempt to inspect `req.query` in access function:
- **Technical blocker:** Payload access control functions receive only `{ req }` with user context, NOT Express request object. Cannot inspect URL query params at this layer (design pattern difference vs. middleware).
- **Workaround required:** Wrap the generic Payload REST route with middleware that pre-validates query params — but that's as much work as Option A + adds middleware complexity.

---

## 5. Recommendation

**Fix:** Implement Option A immediately (block all 4 collections' anonymous reads).

**Rationale:**
1. **Security:** Closes CRITICAL data leak with zero regression risk (no live consumers).
2. **Simplicity:** 4 one-line changes; ships with GH-1587 Phase 01.
3. **Staging:** GH-1588 (PR-2, storefront category filter) already planned; will implement safe public endpoint using proven pattern (like Products/Blogs do).
4. **Alignment:** Matches deny-by-default security posture; public reads only via explicit custom routes.

**Next:** GH-1588 will add `/api/storefront/categories` route with manual site/tenant filtering + response field stripping (matching Products/Blogs pattern).

---

## Unresolved Questions

1. Are there any undocumented external API consumers (e.g., mobile apps, third-party integrations) expecting `/api/categories`, `/api/products`, `/api/blogs` to be publicly readable? (Likely no — storefront uses custom routes. Recommend security audit log check.)
2. Should BlogCategories get the same stricter response field stripping as Products (remove tenant/site expansion)? (Yes, for consistency — but secondary to the access control fix.)

**Status:** DONE
**Summary:** Systemic unscoped anonymous reads affect 4 collections. Option A (block anonymous entirely) is safest, simplest, has zero regression risk since no live consumer exists.

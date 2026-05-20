# Researcher-04: Plan / Subscription Tier Naming Audit

**Date:** 2026-04-15
**Scope:** Discrepancies between documentation plan names and source-code plan names across ECH Prime Web v2.

---

## 1. Summary Finding

**There IS a mismatch.** Documentation (PRDs and User Stories) uses a 4-tier naming scheme of **Freemium / Starter / Standard / Professional**, while the source code uses a completely different 4-tier scheme of **free / starter / pro / business**. The tiers do not map 1:1 (specifically: "Standard" and "Professional" in docs have no code equivalents named "standard" or "professional"; and "pro" and "business" in code have no doc equivalents with those exact names).

---

## 2. File-by-File Inventory

### 2a. Documentation — plan names used

| File | Plan names mentioned | Context |
|------|---------------------|---------|
| `docs/prd/F01-ai-builder.md` line 268 | `Free`, `Starter`, `Pro`, `Business` | Rate limit table in API spec: `Free=1 total, Starter=5/mo, Pro=20/mo, Business=unlimited` |
| `docs/prd/F02-auth.md` lines 46, 73, 98, 157, 176–177 | `pack_code` → values shown as `"STARTER"` | SSO payload field; maps to `tenants.packCode`; PRD says it "decides feature limits" but does NOT specify the full set of valid pack_code values |
| `docs/prd/F15-admin-management.md` lines 34, 58, 61–62, 68 | `Freemium`, `Starter`, `Standard`, `Professional` | Core business context: "4 gói cước (Freemium, Starter, Standard, Professional)"; KPIs; note that "tất cả gói hiện tại giới hạn giống nhau" (all plans currently have same limits) |
| `docs/prd/F22-tracking-analytics.md` line 50 | `Miễn phí` (Free in Vietnamese), upgrade plan | Question about whether to gate pixel import behind paid plan |
| `docs/prd/F30-sprint4-polish.md` lines 21, 52, 303, 436 | `free tier`, `Free plan`, `Pro` | Error message spec for 402 response: "You've used your free AI generation. Upgrade to Pro for unlimited creations." — uses code names (free/Pro), NOT doc names |
| `docs/prd/F31-block-variant-audit.md` line 779 | `Starter`, `Pro`, `Enterprise` | Example pricing table column names in a block variant — not subscription tiers |
| `docs/stories/F15-admin-management-stories.md` lines 10, 46, 55, 84, 118–119, 131 | `Freemium`, `Starter`, `Standard`, `Professional`, `Pro` | **INCONSISTENT WITHIN FILE**: line 55 and 131 use `Pro` (code name); lines 10, 84, 118 use `Professional` (doc name); US-F15-04 AC mentions editing `Freemium, Starter, Standard, Professional` but also "coupon for gói Pro" |
| `docs/stories/user-stories-p0.md` line 81 | No tier names, just references F15-admin-management-stories.md | Story index only |
| `docs/stories/F01-ai-builder-stories.md` line 95 | `Professional` (lowercase, context: service category name, NOT a subscription tier) | Not relevant to plan tiers |
| `docs/stories/F16-notification-center-stories.md` line 239 | `trial`, `gói thấp` (low-tier plan) | Vague, not specific tier names |
| `docs/stories/F02-auth-stories.md` line 28 | `pack_code` field name only | Field listed as required in SSO payload |

### 2b. Source code — plan names used

| File | Plan names used | Context |
|------|----------------|---------|
| `src/collections/Tenants.ts` lines 100–109 | `free`, `starter`, `pro`, `business` | Payload CMS `plan` field select options — this is the authoritative DB enum |
| `src/collections/Tenants.ts` lines 131–136 | `packCode` field stores raw SSO value e.g. `STARTER`, `PRO` | Stored as-is from SSO before mapping |
| `src/app/api/v1/sso/provision/route.ts` lines 93–100 | Input: `BUSINESS`/`PRO`/`STARTER`/anything → Output: `business`/`pro`/`starter`/`free` | `mapPlan()` function: fuzzy lowercase match — `includes('business')→'business'`, `includes('pro')→'pro'`, `includes('starter')→'starter'`, else `→'free'` |
| `src/lib/ai/config.ts` lines 121–167 | `free`, `starter`, `pro`, `business` | `SubscriptionPlan` TypeScript type + `RATE_LIMITS` table with numeric quotas per task |
| `src/__tests__/unit/auth/sso-provision.test.ts` lines 103, 127 | `pack_code: 'STARTER'`, `pack_code: 'BUSINESS'` | Test fixtures confirming expected SSO input values |

---

## 3. The Mismatch Matrix

| Doc name | Code name | Equivalent? | Notes |
|----------|-----------|-------------|-------|
| Freemium | `free` | Likely yes | "Freemium" = free tier; code uses `free` |
| Starter | `starter` | Yes — exact match (case-insensitive) | `mapPlan` maps `STARTER` → `starter` |
| Standard | *(none)* | **NO MATCH** | "Standard" appears in F15 PRD and stories but has zero presence in code |
| Professional | `pro` | Partial — different word | F15 stories inconsistently use both `Professional` (line 118) and `Pro` (line 131, 55) |
| *(none)* | `business` | **NO DOC EQUIVALENT** | "Business" tier exists in code and F01 PRD but is absent from F15 PRD/stories which list only 4 tiers ending with "Professional" |

**Net result:** The doc world has `{Freemium, Starter, Standard, Professional}` while the code world has `{free, starter, pro, business}`. Two tiers are simply named differently ("Standard" vs "pro", "Professional" vs "business") and not documented as such anywhere.

---

## 4. Specific Inconsistencies Flagged

### INC-01: F15 PRD uses "Standard" — does not exist in code
- **File:** `docs/prd/F15-admin-management.md` line 34, 58, 62
- **Quote:** "4 gói cước (Freemium, Starter, Standard, Professional)"
- **Code reality:** There is no `standard` value in `Tenants.ts plan` field or `SubscriptionPlan` type. There is `pro`.
- **Impact:** Any F15 implementation built against the PRD naming will be wrong. DB enum will reject `standard`.

### INC-02: F15 stories mixes "Professional" and "Pro" in same document
- **File:** `docs/stories/F15-admin-management-stories.md`
  - Line 10: `Freemium, Starter, Standard, Professional`
  - Line 55: `Freemium, Starter, Standard, Pro` (uses "Pro")
  - Line 84: `Freemium, Starter, Standard, Pro` (uses "Pro")
  - Line 118: `Freemium, Starter, Standard, Professional` (back to "Professional")
  - Line 131: `coupon for gói Pro` (uses "Pro")
- **Impact:** Internal inconsistency in the story document itself. Unclear if Standard and Professional are the same tier or separate tiers.

### INC-03: "Business" tier absent from F15 PRD and stories
- **File:** `docs/prd/F15-admin-management.md`, `docs/stories/F15-admin-management-stories.md`
- **Code reality:** `business` is a valid plan in Tenants.ts and has unlimited quotas in `RATE_LIMITS`. It is also described in `docs/prd/F01-ai-builder.md` line 268 (`Business=unlimited`).
- **Impact:** F15 admin panel (subscription config UI, US-F15-04) lists only 4 tiers ending with "Professional" but the code has a 4th tier called "business", not "professional". The admin UI will be missing configuration for the `business` plan if built from F15 doc naming.

### INC-04: F01 PRD uses code names; F15 PRD uses different names
- **File:** `docs/prd/F01-ai-builder.md` line 268 vs `docs/prd/F15-admin-management.md` line 34
- **F01 says:** `Free=1 total, Starter=5/mo, Pro=20/mo, Business=unlimited`
- **F15 says:** 4 tiers are `Freemium, Starter, Standard, Professional`
- **Impact:** F01 and F15 are describing the same subscription system with completely different names. A developer reading only F15 would build UI for "Standard" and "Professional" but the rate limit engine enforces "pro" and "business".

### INC-05: mapPlan() has no mapping for "STANDARD" or "PROFESSIONAL"
- **File:** `src/app/api/v1/sso/provision/route.ts` lines 94–100
- **Logic:**
  ```typescript
  if (c.includes('business')) return 'business'
  if (c.includes('pro')) return 'pro'      // NOTE: 'professional'.includes('pro') = true → maps correctly
  if (c.includes('starter')) return 'starter'
  return 'free'                             // default fallback
  ```
- **Partial mitigation:** If SSO sends `pack_code: "PROFESSIONAL"`, `includes('pro')` is `true` so it would map to `pro`. This is accidental correctness.
- **Risk:** If SSO sends `pack_code: "STANDARD"`, none of the conditions match and it falls through to `return 'free'` — a **silent downgrade**. A tenant with "Standard" pack_code would be treated as Free tier.
- **Impact:** HIGH — if the SSO system ever sends `STANDARD` as a pack_code value (which F15 PRD implies is a valid tier), the tenant will silently get `free` plan with 1 AI generation total instead of the Standard quota.

### INC-06: F30-sprint4-polish uses code names ("free", "Pro") in UX copy
- **File:** `docs/prd/F30-sprint4-polish.md` line 303
- **Quote:** `"You've used your free AI generation. Upgrade to Pro for unlimited creations."`
- **Observation:** This user-facing copy uses "free" and "Pro" (code names), not "Freemium" or "Professional" (F15 doc names). Minor UX consistency issue if marketing uses "Professional" as the product name.

---

## 5. Root Cause Assessment

The discrepancy appears to have originated from two separate tracks:

1. **Product/Marketing track** (F15 PRD, stories): Named the tiers using SaaS-standard terminology: Freemium → Starter → Standard → Professional. "Standard" and "Professional" are common plan names for mid and top tiers.

2. **Engineering track** (Tenants.ts, config.ts, F01 PRD): Named the tiers using developer-friendly shorthand: free → starter → pro → business. "Pro" and "Business" are common code-level plan identifiers.

Neither track references the other's naming convention, and there is no single source-of-truth glossary that defines the canonical tier names.

---

## 6. Recommended Resolutions

| Priority | Action | Files to update |
|----------|--------|----------------|
| P0 | Decide canonical names — either align docs to code (`free/starter/pro/business`) OR update code to match docs (`freemium/starter/standard/professional`) | Decision needed before any F15 implementation |
| P0 | Fix `mapPlan()` to explicitly handle all expected SSO pack_code values including `STANDARD` if it is a valid SSO value | `src/app/api/v1/sso/provision/route.ts` |
| P1 | Update F15 PRD and stories to use consistent tier names matching code | `docs/prd/F15-admin-management.md`, `docs/stories/F15-admin-management-stories.md` |
| P1 | Add a glossary/reference section to F15 PRD mapping SSO pack_code values to internal plan enum values | `docs/prd/F15-admin-management.md` |
| P2 | Align F30 UX copy tier names with whatever canonical names are decided | `docs/prd/F30-sprint4-polish.md` |

---

## 7. Code Source of Truth (as-implemented)

The definitive plan name set in code is:

```
free | starter | pro | business
```

Defined in:
- `src/collections/Tenants.ts` — DB enum (Payload CMS `plan` field)
- `src/lib/ai/config.ts` — `SubscriptionPlan` TypeScript type + `RATE_LIMITS`
- `src/app/api/v1/sso/provision/route.ts` — `mapPlan()` ingestion function

SSO inbound pack_code values handled (as of current code): `BUSINESS`, `PRO`/`PROFESSIONAL` (accidental match via `includes`), `STARTER`, and anything else → `free`.

SSO pack_code value NOT handled safely: `STANDARD` → silently falls to `free`.

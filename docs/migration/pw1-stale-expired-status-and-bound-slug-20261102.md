# PW1 export addendum: stale expired Store status and bound-domain slug (2026-11-02)

Issue: #2179 (items 1-3 and 7). Approved by PM/BA on 2026-11-02. Decision log: PD-026.

## Why an addendum and not an edit of the master contract

`docs/migration/pw1-pw2-master-field-mapping.md` is hash-pinned (its sha256 is the master contract hash used as artifact `mappingHash`/`contractSha256` and in diagnostics, classification and credentials allowlists; proven by `src/__tests__/integration/pw1-reconciliation-artifact.test.ts`). Any byte change breaks import/delta of existing artifacts. These two rules therefore live here; a future contract version bump MUST fold them into the master document.

Both rules apply only when `migrationPolicy.gracefulTenantResolution === true` (all profiles in `configs/migration/`). Strict mode behavior is unchanged.

## Rule A - stale expired Store status (overrides one matrix row)

Overrides the master lifecycle matrix row "Store/owner khac trang thai (ke ca Store=2, owner=1)" only for the branch below.

PW1 renew API (`prime-web-api` `UserController.php:496-500`) extends owner `expired_at` and the main subscription but never resets `stores.status`, so a renewed Store stays `2`. In CSV snapshot 281026, 96/96 Stores with `status=2` have owner `status=1`, explicit `expired_at > asOf` and an active main subscription.

A Store with `status=2` is NOT a lifecycle conflict when ALL hold:

- owner `status = 1`, `banned_at` empty
- owner `expired_at` present and strictly `> asOf` (missing `expired_at` is not proof of renewal)
- owner membership resolves to `active`
- main subscription is `active` at `asOf`

Result: tenant `status = active`; COD follows source (`tenants[].payments.payment_cod`, `sites[].paymentConfig.enableCod`). Warning `TENANT_STALE_EXPIRED_STATUS` (table `stores`, field `status`, reason `OWNER_RENEWED_ACTIVE`), disposition `APPROVED_POLICY` under graceful policy. Every other matrix row is unchanged (owner without `expired_at`, past `expired_at`, ended subscription, banned owner still yield `TENANT_LIFECYCLE_CONFLICT` and a suspended tenant; Store 0/3 and staff bans unchanged).

## Rule B - slug from the source-bound domain (overrides 1.10.5 sentence)

Overrides the contract 1.10.5 statement that a source domain binding does not change the slug fallback of a Store with several default domains.

A Store with a number of live default domains other than 1 and a valid `sourceDomainBindings` row (live, `is_default=1`, already enforced) now derives `tenants[].slug` from the bound row: strip `.<sourcePlatformSuffix>`, then the same `validateSlugFormat`/`isReservedSlug` + `-store-<id>` / `store-<id>` fallback as single-default Stores. Slug = the domain without the `-2` number.

- Warning `DEFAULT_DOMAIN_AMBIGUOUS` (table `stores`, sourceId = StoreID) reason `SOURCE_DOMAIN_BINDING_APPLIED` replaces `PLATFORM_DOMAIN_FALLBACK`; disposition `APPROVED_POLICY` under graceful policy.
- Slug provenance contribution: `store_domains` bound row, fields `domain,is_default,deleted_at`, target `tenants[].slug`, rule `MASTER-3.1-DOMAIN`.
- Platform-suffix hosts are never custom domains (unchanged), so the `-2` domain is not kept.
- Legacy `PLATFORM_DOMAIN_FALLBACK` allowlist entries are retained for old artifacts.

Evidence: Store 1329 (rows 1182 `de-lettuce-bear-berhad` / 1347 `-2`) -> slug `de-lettuce-bear-berhad`; Store 1327 (rows 1282 `westwell-technology-malaysia-sdn-bhd` / 1345 `-2`) -> slug `westwell-technology-malaysia-sdn-bhd`. Previously both were `store-<id>`. No redirect for old `store-1329`/`store-1327`: never shared; export schema forbids `previousSlugs`.

## Traceability

Code: `src/lib/migration/pw1-export/mappers/identity-site.ts`, `tenant-slug-from-domain.ts`, `src/lib/migration/pw1-json/diagnostics.ts`. Tests: TC-F42-EXP-115 (Rule A), TC-F42-EXP-116 (Rule B), `pw1-identity.test.ts`. QA: `docs/qa/F42-pw1-master-json-export.md`.

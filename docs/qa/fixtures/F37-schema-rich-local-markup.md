# F37 Schema-Rich Local Markup acceptance fixture

**Owner:** `@aryhibye`
**Status:** Pending live staging execution
**Lifecycle:** The dedicated E2E account's sole tenant-owned site; retain until US-F37-02 is released and its regression is replaced or retired.

## Implementation verification

- Phase 00–02 code and automation are complete: TC-F37-02-29..44/46 are `[BUILT]`.
- The current focused run reports 10 passing files/219 passing tests; 3 DB-backed schema-drift checks are environment-blocked because PostgreSQL is not running. Typecheck, lint, and diff checks pass.
- The full repository suite reports 11,401 passing tests, 3 skipped tests, and 4 environment-only PostgreSQL connection failures.
- TC-F37-02-45 discovers the account's sole site at runtime; no site-ID environment variable is used.

## Provisioning contract

- The existing E2E account must own exactly one published site.
- The existing ensure-test-user workflow endpoint provisions the tenant and user only; the sole F37 site and its immutable data must already be provisioned for staging.
- Use the existing `TEST_EMAIL`, `TEST_PASSWORD`, `E2E_TEST_OTP_CODE`, and `BASE_URL` execution configuration. Do not add a site-ID environment key.
- Discover the site through authenticated Editor data and derive the public `/sites/{tenantSlug}` route.
- The browser test must not mutate the fixture.

**Site discovery:** Authenticated account → exactly one Editor site
**Public URL:** Derived at runtime from `tenantSlug`

## Immutable expected values

- Non-empty site name and phone.
- Complete structured address: street, city, postcode, country.
- `businessCategory=foodEstablishment`.
- `schemaSubtype=Restaurant`.
- At least one complete, non-closed opening-hours row.
- Finite latitude and longitude.
- Canonical HTTP(S) URL derived from the tenant route and an explicit or derived price range.
- Both `LocalBusiness.url` and `Organization.url` must be non-empty and equal the derived canonical storefront URL.
- Published homepage with one strict LocalBusiness and one Organization node.
- At least one published subpage for duplicate-node regression.
- Raw response HTML contains no unescaped JSON-LD breakout. The malicious tenant sentinel matrix remains deterministic coverage in TC-F37-02-43.

## Verification and failure policy

```bash
npx playwright test --project=f37-storefront-regression tests/f37-schema-rich-local-markup.spec.ts
```

- Local runs may skip with an explicit message when account credentials are absent.
- CI/staging preflight fails clearly when credentials, the sole site, expected data, publication state, or derived public route are missing.
- TC-F37-02-09 remains manual until Google Rich Results evidence is recorded against the derived public URL.
- Phase 03 and story completion remain pending until live Playwright and Google Rich Results evidence pass. PR #1708 is reconciled only if it lands first.

# Vercel Multi-Tenant Domain Pattern Research
> Date: 2026-04-13

Sources:
- https://vercel.com/docs/multi-tenant
- https://vercel.com/docs/multi-tenant/domain-management
- https://vercel.com/docs/multi-tenant/limits
- https://vercel.com/docs/domains/working-with-domains

## 1. Host header behavior

Vercel **requires each custom domain to be explicitly added to a project** before it will route traffic for it. There is no documented "catch-all by host header" mode — the project's domain list is the routing key.

- Adding a domain is done via dashboard or `projectsAddProjectDomain` (Vercel SDK / REST API). Until the domain is added + verified, Vercel cannot issue an SSL cert for it, and the request will not resolve to your project.
- An unregistered host header pointed at Vercel's anycast IPs will hit Vercel's edge but fail to match a project — the request returns Vercel's generic error page (no project found / DEPLOYMENT_NOT_FOUND-style), not your app.
- Implication: you cannot just sniff `req.headers.host` in middleware to onboard tenants — the request never reaches your function unless the domain is registered.

(Source: `/docs/multi-tenant/domain-management`, `/docs/domains/working-with-domains`)

## 2. Wildcard semantics

Wildcard domains are supported on **all plans**, but with strict scope:

- `*.acme.com` covers **only one DNS label deep** under `acme.com` (`tenant1.acme.com`, `tenant2.acme.com`). Per the docs example it can also resolve deeper labels (`docs.tenant1.acme.com`) via on-the-fly cert issuance, but always under the wildcard root you control.
- A wildcard does **not** cover the apex `acme.com` — you must add the apex separately.
- Wildcards **only work for subdomains under a root you control**. They cannot match arbitrary tenant apex domains (e.g., `mystore.com`, `othertenant.io`) — different DNS roots, different ownership, no shared cert.
- Hard requirement: wildcard domains must use **Vercel nameservers** (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`) so Vercel can answer the ACME DNS-01 challenge and issue the wildcard cert.

So Pattern B (wildcard host-routing) only works for `*.platform.com` style subdomains, **not** for tenant-supplied apex domains.

(Source: `/docs/domains/working-with-domains#wildcard-domain`, `/docs/multi-tenant/domain-management#using-wildcard-domains`)

## 3. SSL provisioning

- After `projectsAddProjectDomain`, Vercel **automatically attempts to issue an SSL certificate** (Let's Encrypt under the hood, managed by Vercel).
- Issuance requires the domain to either (a) point at Vercel via the documented A/CNAME records or Vercel nameservers, and (b) pass verification.
- **Verification states** — exposed via `projectsGetProjectDomain` + `projectsVerifyProjectDomain`. Response includes a `verified` boolean and a `verification` array (TXT record name/value the tenant must add) when the domain is already in use elsewhere on Vercel or otherwise needs proof of ownership.
- If DNS is correctly pointed and no conflict exists, the domain is auto-verified and SSL is issued shortly after (no manual TXT step needed). When a TXT challenge is required, SSL only issues *after* the TXT record propagates and a verify call succeeds.
- Docs do not publish a hard SLA for cert issuance — typically minutes once DNS resolves, but DNS propagation itself is called out as 24–48h worst case.
- There is **no `phase=ACTIVE` equivalent** field surfaced — instead the polling pattern is: `getProjectDomain` → check `verified` and `verification`; once verified, the domain is live and SSL is auto-managed. Misconfiguration shows up via the dashboard "Invalid Configuration" state and the `verification` payload in the API.

(Source: `/docs/multi-tenant/domain-management#verifying-domain-ownership`)

## 4. Vercel for Platforms

"Vercel for Platforms" is the **product name / feature bundle** for multi-tenant SaaS use cases — it is NOT a separate paid SKU you must purchase. The underlying APIs are the standard project-domains REST/SDK endpoints (`projectsAddProjectDomain`, `projectsGetProjectDomain`, `projectsVerifyProjectDomain`, `projectsRemoveProjectDomain`, `domainsDeleteDomain`). Any Pro account can use them.

- It is positioned as a documentation/template umbrella over normal project-domain APIs + the Next.js Platforms Starter Kit (uses middleware + Redis to map host → tenant).
- **Enterprise-only extras** within "Vercel for Platforms":
  - Multi-tenant preview URLs (per-tenant preview deploys like `tenant1---branch.yourdomain.dev`)
  - Custom (BYO) SSL certificates upload
- Everything we need (programmatic add/verify/remove, auto Let's Encrypt SSL, wildcard subdomains, BYO apex domains) is available on **Pro** with the standard project domains API. No separate enrollment required.

(Source: `/docs/multi-tenant`, `/docs/multi-tenant/limits`)

## 5. Limits

From `/docs/multi-tenant/limits`:

| Plan | Custom domains per project | Notes |
|---|---|---|
| Hobby | 50 | Hard cap |
| Pro | "Unlimited" — soft cap **100,000** | Increase by support request |
| Enterprise | "Unlimited" — soft cap **1,000,000** | Increase by support request |

Wildcards: all plans. Custom uploaded SSL: Enterprise only. Multi-tenant preview URLs: Enterprise only.

**API rate limits** (per team):
- Add domain: 100/hour
- Verify domain: 50/hour
- Remove domain: 100/hour

These rate limits matter for our migration backfill — if we have >100 tenant domains, the initial backfill must be throttled or batched across hours. Steady-state onboarding is fine.

## 6. Recommendation

**Pattern: A** — register each tenant apex domain individually to the Vercel project via `projectsAddProjectDomain`, mirroring the DigitalOcean model.

**Rationale:**

1. **Pattern B is impossible for tenant apex domains.** Wildcards on Vercel only cover one root you control (`*.platform.com`). Tenants bringing `mystore.com`, `othertenant.io`, etc., are different DNS roots — no wildcard cert can cover them. There is no host-header catch-all on Vercel; unregistered hosts simply do not route to your project.
2. **Pattern A is officially documented as the multi-tenant pattern.** The `/docs/multi-tenant/domain-management` page literally walks through `projectsAddProjectDomain` + `projectsVerifyProjectDomain` for "Offering custom domains" — this is the supported, on-rails approach.
3. **SSL is fully automatic** once the domain is added and DNS resolves — no manual cert work, matches what we had on DO.
4. **Limits are not a concern.** Pro soft-cap is 100k domains/project; we're orders of magnitude below that.
5. **Migration story is 1:1 with DO.** Replace DO app-spec calls with `projectsAddProjectDomain`, replace `phase=ACTIVE` polling with `projectsGetProjectDomain` checking `verified` + absence of `verification` TXT challenges. The verify step is more explicit than DO (must call `projectsVerifyProjectDomain` when TXT is required) but the state machine maps cleanly.

For our own platform subdomains (e.g., `*.prime-web.app` if we offer `tenant.prime-web.app`), use a **wildcard domain** on top of the per-apex registrations — that gets us free per-tenant subdomain provisioning without API calls (subject to Vercel-nameserver requirement on the wildcard root).

## Open questions

- Exact polling cadence Vercel recommends for `getProjectDomain` after `addProjectDomain` — docs don't specify; we should pick a backoff that respects the 50/hour verify rate limit per team.
- Whether `verified: true` is sufficient to guarantee SSL is issued, or if there's a separate cert-status field we should also poll. Source code in `node_modules/@vercel/sdk` may expose more on the response shape — worth checking during implementation.
- Behavior when a tenant's DNS later breaks (e.g., they re-point away). Does Vercel auto-mark the domain "misconfigured", and is there a webhook for that, or do we need to poll? The docs reference an "Invalid Configuration" dashboard state but no webhook is documented on the multi-tenant pages.
- Backfill rate-limit strategy for migrating existing DO tenants — confirm the 100/hour add limit is per team (not per project) and whether Enterprise raises it.

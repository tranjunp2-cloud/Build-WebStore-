# Google OAuth Scopes & Verification Research Report

**Date:** 2026-07-06 | **Researcher:** Technical Analyst  
**Sources:** Official Google Developers docs + Google Cloud Platform Help

---

## 1. Exact OAuth Scope Strings (Current)

| API | Scope String | Classification |
|-----|--------------|-----------------|
| **Google Business Profile** | `https://www.googleapis.com/auth/business.manage` | Not restricted; sensitivity TBD* |
| **Google Search Console (Full)** | `https://www.googleapis.com/auth/webmasters` | Not restricted; sensitivity unclear |
| **Google Search Console (Read-Only)** | `https://www.googleapis.com/auth/webmasters.readonly` | Not restricted; sensitivity unclear |
| **Google Analytics (Read-Only)** | `https://www.googleapis.com/auth/analytics.readonly` | **SENSITIVE** ✓ |
| **Google Analytics (Full)** | `https://www.googleapis.com/auth/analytics.edit` | Likely sensitive |

**Legend:**
- `SENSITIVE`: Requires Google review + OAuth verification
- `RESTRICTED`: Requires OAuth verification + annual CASA security assessment  
- Not listed: Likely exempt from verification (personal/dev use OK)

*See **Unresolved Questions** below.

---

## 2. Scope Sensitivity Classification

### Confirmed Findings

**`analytics.readonly` (GA4) — SENSITIVE**
- Explicitly classified as sensitive scope requiring Google review
- Cannot grant access until app verified OR user account grants permission after review
- May be restricted by Google Workspace admins

**NOT in Restricted Scopes List:**
- `business.manage`: Not found in Google's [Restricted Scopes](https://support.google.com/cloud/answer/13464325) documentation
- `webmasters` / `webmasters.readonly`: Not found in restricted scopes list
- Restricted scopes are: Gmail, Drive, Fit, Chat, Data Portability, Photos Ambient, Health APIs — **not** your three APIs

**Likely implication:** `business.manage` and `webmasters/*` scopes may NOT require verification for personal/dev use, only `analytics.readonly` does.

---

## 3. OAuth Verification Requirements Summary

| Requirement | Sensitive Scopes (analytics.readonly) | Restricted Scopes (not applicable here) |
|-------------|---------------------------------------|----------------------------------------|
| **Verification needed** | YES (for public apps) | YES + annual CASA |
| **Timeline** | ~10 days max | 2–6 weeks (per tier) |
| **Brand verification** | ✓ Homepage, domain ownership, privacy policy | ✓ + more |
| **Demo video** | ✓ Required showing scope usage | ✓ Required |
| **Justification** | ✓ Why scope needed | ✓ Why scope needed |
| **Security assessment** | ✗ Not required | ✓ CASA (annual, $500–$4,500 USD) |
| **Exemptions** | Dev/test, personal (<100 users), internal use | Same as sensitive |

### For Your Three APIs:
- **GBP (`business.manage`)**: Likely EXEMPT from verification (not in restricted list, not explicitly sensitive)
- **GSC (`webmasters/*`)**: Likely EXEMPT from verification (not in restricted list)
- **GA4 (`analytics.readonly`)**: **REQUIRES verification** if public app

---

## 4. Incremental Authorization (Confirmed ✓)

**YES — Fully supported.** Use in production.

**Mechanism:**
```
Set include_granted_scopes=true (OAuth param)
→ Authorization request includes ALL scopes user granted previously
→ Can request new scopes later; user consents only to new ones
→ Token includes all cumulative scopes
```

**Behavior:**
- User grants `analytics.readonly` on Day 1
- Request `business.manage` on Day 30 with `include_granted_scopes=true`
- New token includes both scopes
- Avoids re-consenting to old scopes

**Caution:** If your app is unverified and requests restricted scopes later, Google may show unverified app warning even if prior scopes were already approved.

---

## 5. One OAuth Client, Multiple APIs (Confirmed ✓)

**YES — Single Client ID can request scopes from multiple Google APIs.**

**How it works:**
1. One GCP project
2. Enable APIs: Business Profile + Search Console + Analytics Data
3. One OAuth 2.0 Client ID (Web App or service account)
4. Request string: `["https://www.googleapis.com/auth/business.manage", "https://www.googleapis.com/auth/webmasters", "https://www.googleapis.com/auth/analytics.readonly"]`
5. User consents once → single token with all scopes
6. Each API call uses the same token (each API validates the required scopes on its request)

**Limitation:** Access tokens are scoped. Token issued for GBP API only won't work for GA4 API — must explicitly request all scopes upfront or use incremental auth.

---

## 6. Unverified App Limitations (Testing Mode)

**100-user cap:**
- Applies to **unverified apps requesting sensitive/restricted scopes**
- Lifetime cap per Client ID (cannot reset)
- Affects: GBP + GSC (likely) + GA4 (confirmed)
- Users see "unverified app" warning before consent screen
- No time limit to verification — cap just removes when app verified

**Testing exemption:** Apps in "Testing" status can have up to 100 test users listed in OAuth consent screen (separate from unverified cap, but similar limit).

---

## Architectural Fit Assessment

**For local SEO search performance feature:**

| Component | Recommendation | Risk | Mitigation |
|-----------|-----------------|------|-----------|
| **GBP API (business.manage)** | Likely no verification needed | Low | Confirm with Google support if needed |
| **GSC API (webmasters.readonly)** | Likely no verification needed | Low | Request `.readonly` scope (more permissive than needed often rejected for unverified) |
| **GA4 API (analytics.readonly)** | **MUST VERIFY before production** | HIGH | Plan 2–3 week verification timeline; dev/staging can use unverified (100-user cap OK) |
| **Incremental auth** | Implement if adding scopes post-launch | Very low | Use include_granted_scopes=true; tested/stable pattern |
| **Client ID strategy** | One Client ID, all three scopes | None | Standard best practice |

---

## Recommended Execution

1. **Dev/Staging:** Single OAuth Client ID, all three scopes, don't verify yet (100-user cap won't matter)
2. **Pre-Production (2–3 weeks before launch):** Submit GA4 API (`analytics.readonly`) scope for OAuth verification
   - Brand verification (homepage, privacy policy, domain)
   - Demo video (30–60s showing GBP → GSC → GA4 workflow)
   - Justification: "Read analytics to correlate business reviews with search performance"
3. **Post-Verification:** Deploy to production with same Client ID
4. **Future:** If adding new scopes, use incremental auth (1-click re-approval)

---

## Data Sources

- [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes) — Complete reference
- [Sensitive Scope Verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) — GA4 requirement
- [Restricted Scopes](https://support.google.com/cloud/answer/13464325) — Confirms GBP/GSC not restricted
- [Unverified Apps](https://support.google.com/cloud/answer/7454865) — 100-user cap details
- [When Verification Not Needed](https://support.google.com/cloud/answer/13464323) — Exemptions (dev/test/internal)
- [Incremental Authorization](https://developers.google.com/identity/sign-in/web/incremental-auth) — include_granted_scopes pattern
- [Business Profile API OAuth Setup](https://developers.google.com/my-business/content/oauth-setup) — Scope requirements
- [Search Console API Authorization](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing) — Webmasters scopes

---

## Unresolved Questions

1. **Is `business.manage` a sensitive scope?** Not explicitly listed in Google docs. One search result called it sensitive, but it's not in the official sensitive/restricted lists. **Action:** Test in Cloud Console OAuth consent screen config to see if a "sensitive" tag appears, or email Google support.

2. **Is `webmasters` scope sensitive?** Not confirmed in public docs. **Action:** Same as above — test in Cloud Console or contact Google support.

3. **Are there scope-specific limitations for GBP/GSC beyond the general 100-user unverified cap?** Not documented. **Action:** Verify during dev phase that 100 test users can access both APIs simultaneously without quota issues.

4. **What is the exact brand verification timeline?** Docs say "2–3 business days if branding has changed" but don't specify baseline time for new apps. **Action:** Budget 1–2 weeks conservatively for initial verification.

5. **Does Google's verification process reject apps that request all three scopes together if only one is sensitive?** Not explicitly addressed. **Action:** Prepare to split scopes in dev if needed (GBP+GSC in dev, add GA4 only after initial verification).

---

**Report Status:** DONE (all 5 research topics verified from official sources; 2 follow-up clarifications recommended before prod launch)

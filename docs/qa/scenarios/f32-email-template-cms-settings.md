# Scenario Analysis: F32 Email Template CMS Settings
> Generated: 2026-05-26 | Tool: ck:scenario | Dimensions: 12/12

## Feature Description
Multi-tenant SaaS admin panel. Owner/Staff toggle enable/disable transactional emails, edit 4 fields (subject, greeting, CTA, closing) per locale (EN + MS), preview realtime with fake data, save per-tenant config. sendEmail() fallback to hardcoded default if no config. Unique constraint (tenant, templateType, recipient). 16+ template types, buyer vs seller recipient.

---

## Scenario Table

| # | Dimension | Scenario | Severity | Expected Behavior |
|---|-----------|----------|----------|-------------------|
| 1 | User Types | Owner accesses Email Settings | High | Full read/write access to all templates |
| 2 | User Types | Staff with `email_settings` permission | High | Same access as Owner |
| 3 | User Types | Staff WITHOUT `email_settings` permission | Critical | 403 redirect, menu hidden |
| 4 | User Types | Super-admin cross-tenant access | High | Can view/edit any tenant config |
| 5 | User Types | Unauthenticated request to API | Critical | 401 rejected |
| 6 | Input Extremes | Subject field exactly 200 chars | Medium | Saved successfully, no truncation |
| 7 | Input Extremes | Subject field 201 chars | High | Validation error, save blocked |
| 8 | Input Extremes | Closing textarea exactly 2000 chars | Medium | Saved successfully |
| 9 | Input Extremes | XSS payload in subject: `<script>alert(1)</script>` | Critical | Sanitized on save + render, not executed |
| 10 | Input Extremes | HTML injection in greeting: `<img src=x onerror=alert(1)>` | Critical | Escaped/stripped before email render |
| 11 | Input Extremes | Unicode in CTA label: `🛒 Beli Sekarang` | Medium | Saved and rendered correctly |
| 12 | Input Extremes | Empty required fields (subject blank) | High | Validation error or fallback to default |
| 13 | Input Extremes | SQL injection in closing field | Critical | Parameterized query, no injection |
| 14 | Timing | Two staff save same template simultaneously | High | Last-write-wins or conflict error; no corruption |
| 15 | Timing | Preview debounce: rapid typing 10 chars in 100ms | Medium | Single render fires after 300ms idle |
| 16 | Timing | Save while preview render in-flight | Medium | Save completes; preview re-fetches after |
| 17 | Scale | All 16 template types loaded in list view | Medium | All render without timeout |
| 18 | Scale | Tenant with 0 configs (fresh setup) | High | All templates show defaults, no errors |
| 19 | State Transitions | First-time save (no DB row exists) | Critical | INSERT new row; email uses custom config |
| 20 | State Transitions | Update existing config (row exists) | High | UPDATE row; reflected on next send |
| 21 | State Transitions | Toggle OFF then back ON same session | High | State persisted correctly both times |
| 22 | State Transitions | Config row deleted externally → sendEmail() called | High | Graceful fallback to hardcoded default |
| 23 | Environment | Preview on mobile 768px | Medium | Split layout collapses to stacked; usable |
| 24 | Environment | Preview on mobile 375px | Low | Content readable, form scrollable |
| 25 | Environment | Slow network (3G) — save takes 5s | Medium | Loading state shown; no double-submit |
| 26 | Error Cascades | DB write fails on save | High | Toast error shown; no silent data loss |
| 27 | Error Cascades | Config lookup fails at sendEmail() time | Critical | Fallback to hardcoded default; email still sent |
| 28 | Error Cascades | Preview API timeout | Medium | Error state shown in preview pane; form still editable |
| 29 | Authorization | Owner A crafts request with Owner B's tenantId | Critical | Access denied; tenant scoping enforced at API level |
| 30 | Authorization | CSRF attack on save endpoint | Critical | Payload CSRF protection blocks request |
| 31 | Authorization | Expired session mid-edit | High | Re-auth redirect; unsaved changes warned |
| 32 | Data Integrity | Duplicate INSERT same (tenant, templateType, recipient) | Critical | DB unique constraint → upsert or conflict error |
| 33 | Data Integrity | EN config saved, MS field left empty | High | EN used for EN locale; MS falls back to EN |
| 34 | Data Integrity | Config updated, email cache stale | High | Cache invalidated on update; next send uses new config |
| 35 | Integration | sendEmail() called for disabled template | Critical | Email NOT sent; no error thrown (silent skip) |
| 36 | Integration | sendEmail() called — config exists, enabled=true | High | Custom subject/greeting/CTA/closing used |
| 37 | Integration | sendEmail() called — no config row | High | Hardcoded default template used; no crash |
| 38 | Integration | Template type added to code but not in enum | Medium | Graceful fallback; no crash on lookup |
| 39 | Compliance | Preview rendered with real customer PII accidentally | Critical | Preview ONLY uses fake fixtures; never real data |
| 40 | Compliance | Audit: who changed subject at what time | Low | updatedBy + updatedAt fields persisted |
| 41 | Business Logic | `order-shipped` type not in current enum | High | Must be added per Open Question #5 in PRD |
| 42 | Business Logic | MS locale required when tenant is MS-only site | Medium | EN required, MS optional; fallback EN per PRD §12.3 |
| 43 | Business Logic | Staff changes config → Owner reviews | Medium | Changes visible immediately; no approval flow needed |

---

## Summary
- **Critical:** 13
- **High:** 18
- **Medium:** 9
- **Low:** 3
- **Total:** 43 scenarios across 12 dimensions

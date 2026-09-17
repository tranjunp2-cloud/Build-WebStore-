# Phase 03 — Protected API và live probe on-demand

## Mục tiêu

Expose a safe server-owned snapshot to Studio and add an on-demand live-check integration without turning a page load/HTTP response into render proof.

## File targets

- **New:** `src/app/api/qa/migration-render-evidence/route.ts` — read snapshot.
- **New:** `src/app/api/qa/migration-render-evidence/live-check/route.ts` — action endpoint, only after runner integration exists.
- **New:** `src/lib/admin/qa/migration-live-render-provider.ts` — interface/unavailable adapter; concrete QA runner client is supplied by platform owner.
- **Modify:** `src/lib/admin/qa/migration-render-evidence.ts` — merge cached/latest live evidence into the response DTO.
- **New:** `src/__tests__/api/f40-migration-render-evidence.test.ts`.

## Implementation steps

1. Protect both routes with `withSuperAdmin`; schema-validate query/body with Zod (opaque IDs, enum, length limits, no unknown action fields). Return 400 for malformed input and 401/403 through existing guard.
2. Read endpoint calls a single evidence service; sanitize at the server boundary before `NextResponse.json`. Do not return raw Payload config, credentials, connection errors or raw SQL/HTML.
3. Live-check route delegates only mapping-resolved `site/page/layoutBlock` IDs to a service-held runner config. It returns `unverified` with a safe code if no runner/evidence exists. It cannot accept arbitrary network target, selector or command.
4. Require runner response `outcome`, `checkedAt`, compatible renderer/mapping revision, and safe evidence reference. Treat expiry/unknown revision as unverified. Do not store screenshot blobs/traces/cookies in Payload.
5. Keep `dynamic = "force-dynamic"`, `maxDuration <= 60`, nonblocking error handling and request correlation/audit metadata safe for Super Admin review.

## Acceptance / test mapping

- TC-F40-13-07 (API, Critical): unauthenticated/malformed requests fail; sensitive keys are not serialized.
- TC-F40-13-08 (API/Unit, Critical): runner success maps to rendered with timestamp/ref; timeout/unavailable has unverified only.

## Exit criteria

- API contract has real auth/validation tests and no secret or arbitrary outbound request path.
- Live integration remains disabled/unverified until QA runner owner supplies the authoritative backend.

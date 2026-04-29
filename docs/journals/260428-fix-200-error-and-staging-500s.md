# Fix: API 200 Error Display + Known Staging 500s

**Date**: 2026-04-28  
**Severity**: Medium  
**Components**: AI Generator SSE stream (`src/lib/ai/openai-generator.ts`), Vercel staging deployment  
**Status**: Phase 1 fixed + shipped. Phase 2-3 are config/ops (no code).

## What Was Wrong

**Symptom**: User thấy "API status 200 nhưng frontend show lỗi" và 500 errors trong Vercel staging logs.

### Bug 1 — False error UI on fallback (HTTP 200 + error toast)

`openai-generator.ts:615` (old):
```ts
events.push({ event: 'error', data: { code: 'ai_fallback', message: 'Using smart templates', retryable: false } })
```

Khi OpenAI fail và fallback sang smart templates (site vẫn được tạo thành công), code push `event: 'error'` vào SSE stream. HTTP response là 200 (stream đã mở). Frontend nhận event → `case 'error': setError(data)` → show error toast dù site đã tạo xong.

### Bug 2.1 — JWT signature fail at `/api/v1/sso/provision`

`getCurrentUser error: signature verification failed` — pure env var mismatch. Code ở `src/lib/auth.ts:57-85` đã implement dual-secret fallback đúng. `SSO_SHARED_SECRET` chưa được set trên Vercel staging `ech-prime-web-v2`.

### Bug 2.2 — client-logos missing library content

`[Structure Enforcer] no library content for required "client-logos"` — đã fix ở commit `e0732120` (2026-04-19) nhưng staging deployment (`be99d034`, 2026-04-13) chưa có commit này.

## Root Causes

1. SSE streaming: HTTP 200 set ngay khi stream mở, error events sau đó vẫn được đọc bởi frontend dù HTTP status không thay đổi.
2. Thiếu `SSO_SHARED_SECRET` env var trên Vercel staging scope.
3. Staging deployment outdated (10+ commits behind fix).

## Fixes Applied

### Phase 1 (code, shipped)

`src/lib/ai/openai-generator.ts:615`:
- **Removed** `events.push({event: 'error', ...ai_fallback...})`
- **Added** `console.warn('[AI Generator] Falling back to smart templates ...')`
- Rule: error events in SSE stream should only be emitted for FATAL failures. Successful fallback = ops-only log.

Test updated: `src/__tests__/unit/lib/ai/openai-generator.test.ts`
- TC-F01-AI-FALLBACK-SILENT-01: OpenAI throws → fallback succeeds → `error` event NOT emitted

### Phase 2 (Vercel Dashboard, no code)

Set trên `ech-prime-web-v2` → Settings → Environment Variables → `staging` scope:
- `SSO_SHARED_SECRET` = `web-cms-v2`'s `PAYLOAD_SECRET` value

Sau đó trigger redeploy staging để pick up env var mới.

### Phase 3 (ops redeploy, no code)

Push hoặc trigger manual redeploy staging từ commit hiện tại (bất kỳ commit sau `e0732120`) để staging nhận fix client-logos + OpenAI JSON sanitize + SSO fallback code.

## Lessons

1. **SSE streaming error semantics**: `event: 'error'` phải reserved cho failures USER không thể recover từ (fatal). Operational fallbacks không nên show error tới user nếu outcome vẫn successful.
2. **Staging deploy lag**: Staging deployment SHA phải verified sau mỗi major fix push. `gh api repos/{org}/{repo}/deployments` cho phép check nhanh.
3. **Env var isolation**: Cross-service JWT verification cần `SSO_SHARED_SECRET` pattern, không phải share `PAYLOAD_SECRET` (security isolation per project).

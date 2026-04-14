---
phase: 1
title: "Adapter Framework + Vercel Adapter"
status: pending
priority: P1
effort: 1.5h
---

# Phase 1 — Adapter Framework + Vercel Adapter

**Parent:** [plan.md](plan.md)
**Repo:** `prime-bot-assistant`

## Overview

Tạo adapter pattern trong Bot để detect source từ headers/payload và normalize về `CINotifyPayload`.

## Key Insights

- Bot đã có `normalizePayload()` trong route.ts — chỉ handle flat→nested cho GitHub Actions
- Vercel payload format hoàn toàn khác (nested `payload.payload.deployment`)
- Cần HMAC-SHA1 verification cho Vercel (khác với HMAC-SHA256 của Lark)
- `crypto.ts` đã có `verifyEventSignature()` cho Lark — pattern tương tự

## Architecture

```typescript
// src/lib/ci-adapters/types.ts
interface CISourceAdapter {
  name: string
  detect(req: Request, body: unknown): boolean
  verify(req: Request, rawBody: string): Promise<boolean>
  normalize(body: unknown): CINotifyPayload | null  // null = skip event
}

// src/lib/ci-adapters/index.ts
export const adapters: CISourceAdapter[] = [
  vercelAdapter,
  githubActionsAdapter,  // existing smart-notify format
  genericAdapter,        // fallback — accepts CINotifyPayload directly
]
```

## Related Files

| File | Purpose |
|------|---------|
| `src/app/api/ci/notify/route.ts` | Current endpoint — will be updated in Phase 2 |
| `src/lib/lark/ci-notify-service.ts` | Card builder — unchanged |
| `src/lib/lark/crypto.ts` | HMAC utils — reference for verify pattern |
| `ech-prime-web-v2/src/app/api/webhooks/vercel/route.ts` | Existing Vercel adapter to port |

## Implementation Steps

### 1. Create adapter types (`src/lib/ci-adapters/types.ts`)

```typescript
import type { CINotifyPayload } from '@/lib/lark/ci-notify-service'

export interface CISourceAdapter {
  name: string
  /** Check if this request came from this source */
  detect(headers: Headers, body: Record<string, unknown>): boolean
  /** Verify request authenticity (signature check). Return true if valid or no verification needed. */
  verify(headers: Headers, rawBody: string): Promise<boolean>
  /** Convert source payload → CINotifyPayload. Return null to skip (irrelevant event). */
  normalize(body: Record<string, unknown>): CINotifyPayload | null
}
```

### 2. Create Vercel adapter (`src/lib/ci-adapters/vercel.ts`)

Detection:
- Header `x-vercel-signature` present → Vercel source

Verification:
- HMAC-SHA1 of raw body with `VERCEL_WEBHOOK_SECRET`
- `crypto.createHmac('sha1', secret).update(rawBody).digest('hex')` === signature
- **If no secret configured → REJECT 401** (buộc config đúng, không skip)

Normalization (port from `ech-prime-web-v2/src/app/api/webhooks/vercel/route.ts` lines 38-71):
```typescript
// Only handle deployment.ready and deployment.error
// Skip other events (deployment.created, deployment.canceled) → return null
const deployment = payload.payload?.deployment || payload.payload || {}
const meta = deployment.meta || {}

// Multi-project: extract project name from Vercel payload
// payload.payload.project.name or payload.payload.name
return {
  event: isSuccess ? 'deploy_success' : 'deploy_fail',
  project: projectName,  // dynamic from Vercel payload, not hardcoded
  branch: meta.githubCommitRef || meta.gitBranch || 'unknown',
  environment: deployment.target || 'preview',
  author: meta.githubCommitAuthorLogin || meta.githubCommitAuthorName || 'unknown',
  commit: {
    sha: (meta.githubCommitSha || '').slice(0, 7),
    message: (meta.githubCommitMessage || '').slice(0, 80),
  },
  deploy: {
    url: deployment.url ? `https://${deployment.url}` : undefined,
    logs_url: deployment.inspectorUrl || undefined,
  },
}
```

### 3. Create GitHub Actions adapter (`src/lib/ci-adapters/github-actions.ts`)

Detection:
- Header `authorization` starts with `Bearer ` AND body has `event` field matching known events
- No `x-vercel-signature` header (Vercel takes priority)

Verification:
- Bearer token check against `CRON_SECRET` (existing logic)

Normalization:
- Reuse existing `normalizePayload()` from route.ts (move here)

### 4. Create generic adapter (`src/lib/ci-adapters/generic.ts`)

Detection:
- Fallback — returns true if body has `event` field AND no Vercel/GitHub-specific headers
- Lowest priority (last in chain)

Verification:
- **BẮT BUỘC Bearer token** (CRON_SECRET) — KHÔNG accept unauthenticated requests
- Dùng cho curl test, CI khác, hoặc future integrations

Normalization:
- Pass through as-is (expects CINotifyPayload format)

### 5. Create adapter registry (`src/lib/ci-adapters/index.ts`)

```typescript
import { vercelAdapter } from './vercel'
import { githubActionsAdapter } from './github-actions'
import { genericAdapter } from './generic'
import type { CISourceAdapter } from './types'

// Order matters — first match wins
export const adapters: CISourceAdapter[] = [
  vercelAdapter,
  githubActionsAdapter,
  genericAdapter,
]

export function detectSource(headers: Headers, body: Record<string, unknown>): CISourceAdapter {
  return adapters.find(a => a.detect(headers, body)) || genericAdapter
}
```

## Todo

- [ ] Create `src/lib/ci-adapters/types.ts`
- [ ] Create `src/lib/ci-adapters/vercel.ts` — port logic from prime-web-v2
- [ ] Create `src/lib/ci-adapters/github-actions.ts` — extract from route.ts
- [ ] Create `src/lib/ci-adapters/generic.ts`
- [ ] Create `src/lib/ci-adapters/index.ts` — registry
- [ ] Add `VERCEL_WEBHOOK_SECRET` env var to Bot

## Success Criteria

- [ ] `vercelAdapter.detect()` correctly identifies Vercel webhooks
- [ ] `vercelAdapter.verify()` validates HMAC-SHA1 signature
- [ ] `vercelAdapter.normalize()` converts deployment.ready → deploy_success payload
- [ ] `githubActionsAdapter` produces identical output to current normalizePayload()
- [ ] Adapter chain: Vercel → GitHub Actions → generic (priority order)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Vercel signature format khác expected | Port exact logic from working prime-web-v2 handler |
| Breaking existing GitHub Actions flow | GitHub Actions adapter = exact same logic, just moved |
| Missing env var on Vercel | Reject 401 — force correct config before accepting webhooks |

## Security Considerations

- HMAC-SHA1 for Vercel (their standard, can't change)
- Bearer token for GitHub Actions (existing)
- Constant-time comparison for signature checks
- Never log secrets or raw tokens

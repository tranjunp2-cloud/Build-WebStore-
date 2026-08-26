---
title: "Phase 02 — SSO Client + Triggers"
effort: 2.5h
status: pending
dependsOn: [phase-01]
blocks: []
---

# Phase 02 — SSO Client + Triggers

## Overview

1. Create `src/lib/sso/sso-api-client.ts` — encrypt/decrypt + SSO login + step notify
2. Update provision route to store `keyString` instead of discarding password
3. Add 3 step-complete triggers (apply-template, shipping-config, Products afterChange)

## Files to Modify/Create

| File | Change |
|------|--------|
| `src/lib/sso/sso-api-client.ts` | **NEW** — core SSO outbound client |
| `src/app/api/v1/sso/provision/route.ts` | Store `keyString` at line 144–162 |
| `src/app/api/ai/apply-template/route.ts` | Add step 1 trigger after site creation |
| `src/app/api/sites/[siteId]/shipping-config/route.ts` | Add step 2 trigger before success response |
| `src/collections/Products.ts` | Add step 3 trigger in `afterChangeHook` |

---

## 1. `src/lib/sso/sso-api-client.ts` (NEW)

```typescript
import crypto from 'crypto'
import { BasePayload } from 'payload'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

function getEncryptionKey(): Buffer {
    const key = process.env.SSO_ENCRYPTION_KEY
    if (!key) throw new Error('SSO_ENCRYPTION_KEY env var missing')
    return Buffer.from(key, 'hex')
}

export function encryptPassword(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptPassword(ciphertext: string): string {
    const [ivHex, encHex] = ciphertext.split(':')
    if (!ivHex || !encHex) throw new Error('Invalid keyString format')
    const iv = Buffer.from(ivHex, 'hex')
    const encrypted = Buffer.from(encHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

async function getSSOToken(email: string, keyString: string): Promise<string> {
    const password = decryptPassword(keyString)
    const base = (process.env.NEXT_PUBLIC_SSO_BASE_URL ?? '').replace(/\/$/, '')
    const res = await fetch(`${base}/api/v1/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        // SSO API: `username` field = email, `is_system: 1` bypasses MFA OTP check
        body: JSON.stringify({ username: email, password, is_system: 1 }),
    })
    if (!res.ok) throw new Error(`SSO login failed: ${res.status}`)
    const data = await res.json()
    const token = data?.access_token ?? data?.token
    if (!token) throw new Error('SSO login: no access_token in response')
    return token as string
}

/** Persist failed event to sso_step_events for cron retry */
async function persistStepEvent(payload: BasePayload, userId: number | string, step: 1 | 2 | 3, error: string): Promise<void> {
    const db = payload.db?.drizzle
    if (!db) return
    const { sql } = await import('drizzle-orm')
    await db.execute(sql`
        INSERT INTO sso_step_events (user_id, step, status, last_error)
        VALUES (${Number(userId)}, ${step}, 'pending', ${error})
    `)
}

/**
 * Notify SSO API that user completed an onboarding step.
 * Fire-and-forget: on failure, persists event to sso_step_events for cron retry.
 *
 * @param payload - Payload instance (for DB access on failure)
 * @param userId - PWv2 user ID
 * @param step - 1 (Pick Template) | 2 (Setup Shipping) | 3 (Add Product)
 */
export async function notifyStepComplete(
    payload: BasePayload,
    userId: number | string,
    step: 1 | 2 | 3,
): Promise<void> {
    try {
        const user = await payload.findByID({
            collection: 'users',
            id: userId,
            depth: 0,
        })

        if (!user?.keyString) {
            // User provisioned before keyString was introduced — skip silently
            console.warn(`[SSO Step] User ${userId} has no keyString — step ${step} not notified`)
            return
        }

        const token = await getSSOToken(user.email as string, user.keyString as string)

        const base = (process.env.NEXT_PUBLIC_SSO_BASE_URL ?? '').replace(/\/$/, '')
        const res = await fetch(`${base}/api/v1/product/8/step-status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ [`step${step}_status`]: 1 }),
        })

        if (!res.ok) {
            throw new Error(`step-status PATCH failed: ${res.status}`)
        }
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[SSO Step] notifyStepComplete failed for user ${userId} step ${step}:`, errMsg)
        // Persist for cron retry — non-blocking
        persistStepEvent(payload, userId, step, errMsg).catch((e) =>
            console.error('[SSO Step] Failed to persist step event:', e),
        )
    }
}
```

---

## 2. `src/app/api/v1/sso/provision/route.ts` — store keyString

At line 120, the password is extracted from `rawPayload`. **After** line 120, before `payload.create({ collection: 'users' })`, add encryption.

**Change at line 120 area:**

```typescript
// existing line 120:
const { password: _ssoPassword, ...safeMetaData } = rawPayload

// ADD after line 120:
let keyString: string | undefined
try {
    const { encryptPassword } = await import('@/lib/sso/sso-api-client')
    keyString = encryptPassword(password)
} catch (err) {
    // Non-blocking — provision succeeds even if encryption fails
    console.error('[SSO Provisioning] keyString encryption failed:', err)
}
```

**Then in the `payload.create({ collection: 'users' })` data block (line ~143):**

```typescript
data: {
    email,
    password,
    // ... existing fields ...
    ...(keyString && { keyString }),  // ADD this line
},
```

---

## 3. `src/app/api/ai/apply-template/route.ts` — Step 1 (Pick Template)

After the `site = await payload.create(...)` call (around line 569), add **before** the function returns:

```typescript
// Notify SSO Hub: user picked a template (step 1)
if (req?.user?.id) {
    import('@/lib/sso/sso-api-client')
        .then(({ notifyStepComplete }) => notifyStepComplete(payload, req.user!.id, 1))
        .catch(() => {/* logged inside notifyStepComplete */})
}
```

> **Note:** Also check the "apply to existing site" branch around line 286–553. If that path also counts as "Pick Template", add trigger there too. Confirm with PM.

---

## 4. `src/app/api/sites/[siteId]/shipping-config/route.ts` — Step 2 (Setup Shipping)

After `const updated = await payload.update(...)`, **before** `return NextResponse.json({ success: true, ... })`:

```typescript
// Notify SSO Hub: user configured shipping (step 2)
if (req?.user?.id) {
    import('@/lib/sso/sso-api-client')
        .then(({ notifyStepComplete }) => notifyStepComplete(payload, req.user!.id, 2))
        .catch(() => {/* logged inside notifyStepComplete */})
}
```

> **Note:** Check how `req.user` is obtained in this route — may need to call `getCurrentUser(req)`.

---

## 5. `src/collections/Products.ts` — Step 3 (Add Product)

In `afterChangeHook` (line ~53), add step 3 trigger for new active products:

```typescript
const afterChangeHook: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
    // === existing SEO hook logic ===
    const isPublishingUpdate = operation === 'update' && doc.status === 'active' && previousDoc?.status !== 'active'
    const isActiveCreate = operation === 'create' && doc.status === 'active'

    if ((isPublishingUpdate || isActiveCreate) && !doc.seo?.title) {
        // ... existing SEO code ...
    }

    // === ADD: SSO step 3 notification (first active product creation only) ===
    if (isActiveCreate && req?.user?.id) {
        import('@/lib/sso/sso-api-client')
            .then(({ notifyStepComplete }) => notifyStepComplete(req.payload, req.user!.id, 3))
            .catch(() => {/* logged inside notifyStepComplete */})
    }
}
```

> **Note:** SSO API is idempotent — calling step3_status=1 multiple times is safe (won't double-count).

---

## Verification

```bash
# TypeScript compile check
npx tsc --noEmit

# Test: does NEXT_PUBLIC_SSO_BASE_URL/api/v1/login respond?
curl -X POST https://sso.dev.ecommercehub.my/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}' | head -20
```

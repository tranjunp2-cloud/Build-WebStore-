---
title: "Phase 01 — Schema + Env"
effort: 0.5h
status: pending
dependsOn: []
blocks: [phase-02, phase-03]
---

# Phase 01 — Schema + Env

## Overview

- Add `keyString` field to Users collection (hidden, stores AES-256 encrypted SSO password)
- Add `sso_step_events` table for retry queue (raw SQL, not Payload collection)
- Add `SSO_ENCRYPTION_KEY` to env example files

## Files to Modify

| File | Change |
|------|--------|
| `src/collections/Users.ts` | Add `keyString` field after `otpAttempts` (line ~1224) |
| `scripts/db-setup.js` | Add 2 migration entries |
| `.env.example` | Add `SSO_ENCRYPTION_KEY` under SSO Integration section |
| `.env.staging.example` | Add `SSO_ENCRYPTION_KEY` |
| `.env.production.example` | Add `SSO_ENCRYPTION_KEY` |

## Implementation Steps

### 1. `src/collections/Users.ts` — add after `otpAttempts` field (~line 1224)

```typescript
{
    name: 'keyString',
    type: 'text',
    admin: { hidden: true, description: 'Encrypted SSO password for outbound SSO API calls' },
},
```

### 2. `scripts/db-setup.js` — add to MIGRATIONS array

```javascript
// Users: keyString (encrypted SSO password for outbound SSO API calls)
{
    name: 'users.add_key_string',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS key_string varchar;`,
},
// SSO step events retry queue (not a Payload collection — raw table)
{
    name: 'sso_step_events.create_table',
    sql: `CREATE TABLE IF NOT EXISTS sso_step_events (
        id serial PRIMARY KEY,
        user_id integer NOT NULL,
        step integer NOT NULL CHECK (step IN (1, 2, 3)),
        status varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        retry_count integer NOT NULL DEFAULT 0,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    );`,
},
```

### 3. Env example files — add under `# ── SSO Integration ──` section

```
# AES-256 key for encrypting user SSO passwords (keyString field). Generate: openssl rand -hex 32
SSO_ENCRYPTION_KEY=
```

- Add to: `.env.example`, `.env.staging.example`, `.env.production.example`
- Add to Vercel Dashboard (staging + production) with real values before deploy

## Verification

```bash
# Check migration syntax
node scripts/check-migrations.js origin/staging

# Confirm field appears in Payload schema
grep -n "keyString" src/collections/Users.ts
```

## Notes

- `keyString` is hidden from Payload Admin UI (never expose encrypted data)
- `sso_step_events` uses raw SQL (simpler than Payload collection for a queue table)
- Drizzle naming: simple `varchar` column on existing `users` table — no new join table needed

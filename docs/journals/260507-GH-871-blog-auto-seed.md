# GH-871: Blog Auto-Seed on Website Generation

**Date**: 2026-05-07 11:44
**Severity**: Low
**Component**: Blog seeding pipeline (`src/lib/ai/seed-blog-posts.ts`)
**Status**: Resolved

## What Happened

Implemented auto-seeding of 3 published blog posts per tenant on first website generation (GH-871). The seeder runs after product seeding in `POST /api/ai/generate-site`, uses `getBlogSeeds()` with tenant-prefixed slugs, and safely skips if blogs already exist.

## The Brutal Truth

Discovered a nasty side-effect halfway through: the existing `Blogs.ts` `afterChange` hook fires `BLOG_PUBLISHED` notifications for every post transitioned to `status === 'published'`. Since `payload.create()` sets `previousDoc: undefined`, all 3 seeded posts would trigger notifications to the tenant owner before they'd even see the site. That's spam and a terrible UX surprise.

## Technical Details

- Hook fires on: `doc.status === 'published' && previousDoc?.status !== 'published'`
- Problem: `previousDoc` is `undefined` on creation, so condition treats new posts as published transitions
- Fix: Pass `context: { skipPublishNotify: true }` in `payload.create()` call; guard the hook with `if (!req?.context?.skipPublishNotify) { send notification }`

## What We Tried

Initially considered passing `status: 'published'` only—realized hook fires regardless and notifications would spam. Guard in the hook is the minimal fix.

## Root Cause Analysis

Hook was designed for user actions (publish button), not system actions (seeding). Forgot to account for the `previousDoc === undefined` edge case that makes new posts look like transitions.

## Lessons Learned

**Before adding auto-save/create logic, audit hooks for side-effects.** Especially notification/email hooks. `previousDoc` being `undefined` is a real state worth guarding against.

## Next Steps

None—code passes tests (5/5, TC-F08-BS.01–05), TypeScript clean, no regressions.

---

**Status**: DONE
**Summary**: Implemented blog auto-seed with guard against spurious notifications via `context.skipPublishNotify` hook pattern.

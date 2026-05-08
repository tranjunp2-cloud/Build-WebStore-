# F23 Personal Profile — Silent Avatar Upload Failure Caught in Review

**Date**: 2026-05-08 10:47
**Severity**: High
**Component**: User profile settings UI + API routes
**Status**: Resolved

## What Happened

F23 Personal Profile shipped across 4 phases: API routes (auth guards + profile PATCH/avatar/password endpoints), 10-component RSC UI (tabs for general info + security settings, role-gated form fields), i18n integration (36 keys), and 63 unit tests. Code review caught a critical bug that would have silently broken production.

## The Brutal Truth

Avatar uploads were 100% broken: the client sent `formData.append('avatar', file)` but the server read `formData.get('file')` — null every time, 400 response, and users would see upload "succeed" with no avatar actually changing. This would have shipped undetected because the UI's optimistic preview hid the server failure. The test suite passed because tests mocked the API correctly (ironic: good test practice masked bad integration).

## Technical Details

**Root cause:** Naming mismatch between client and server form field. Client: `avatar-upload.tsx` line ~45. Server: `src/app/api/users/me/avatar/route.ts` reading wrong key.

**Secondary issues found in review:**
- Wrong i18n key used for "Last Login" label in owner security tab
- Failed avatar upload reverted to `undefined` instead of restoring previous state
- `role-guard.ts` (server-only) imported in client component; split into `role-utils.ts` (pure) + `role-guard.ts` wrapper

## Lessons Learned

1. **Mock correctness ≠ integration correctness.** Tests that mock APIs pass even when client-server contracts break. Need integration test or manual E2E check pre-review.

2. **Code review saved us.** Without reviewer reading both client + server code side-by-side, this ships broken. Solo developers miss field name mismatches.

3. **Force-dynamic RSC page was right call.** User data needed fresh on every load (auth state, avatar). Trade-off: revalidation latency vs. correctness — worth it.

## Next Steps

- Add integration test: real form data round-trip to API (not mocked)
- PR merged to staging with all 3 secondary fixes
- Scheduled for QA sign-off before main merge

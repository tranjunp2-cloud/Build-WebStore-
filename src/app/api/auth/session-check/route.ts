import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPayload } from 'payload';
import config from '@payload-config';
import { authUnavailableResponse, getCurrentUser, isAuthUnavailableError } from '@/lib/auth';
import { isSubscriptionActive } from '@/lib/subscriptions/plan-subscription';

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            // Transient null (HMR, token refresh, race condition) — not a confirmed logout event.
            // Client should retry; only escalate after repeated failures.
            console.warn('[session-check] getCurrentUser returned null, signaling retry');
            return NextResponse.json(
                { ok: false, retry: true },
                { headers: { 'Cache-Control': 'no-store' } },
            );
        }

        // Extract tenant from user object — may be stale/unpopulated from JWT cache
        const tenants = user.tenants as Array<{ tenant: string | { id: string } }> | undefined;
        const firstTenant = tenants?.[0]?.tenant;
        let resolvedTenantId = typeof firstTenant === 'string' ? firstTenant : firstTenant?.id;

        const payload = await getPayload({ config });

        if (!resolvedTenantId) {
            // User object may have unpopulated tenants due to depth/cache — re-fetch from DB to confirm
            const freshUser = await payload.findByID({
                collection: 'users',
                id: user.id,
                depth: 1,
                overrideAccess: true,
            });
            const freshTenants = freshUser?.tenants as Array<{ tenant: string | { id: string } }> | undefined;
            const freshFirst = freshTenants?.[0]?.tenant;
            resolvedTenantId = typeof freshFirst === 'string' ? freshFirst : freshFirst?.id;

            if (!resolvedTenantId) {
                // Confirmed via DB: user genuinely has no tenant — removed from workspace
                console.warn('[session-check] force_logout: Removed from workspace', { userId: user.id });
                return NextResponse.json(
                    { action: 'force_logout', reason: 'Removed from workspace' },
                    { headers: { 'Cache-Control': 'no-store' } },
                );
            }
        }

        // Subscription + ban checks. No row in plan-subscriptions = new/unprovisioned tenant still onboarding → let
        // through. The tenant's `status` (ban) comes populated on the session user (depth 1, SESSION_USER_POPULATE),
        // so only a membership the session did not populate reads the tenant row; the subscription read is one
        // statement — no COUNT, no depth-2 tenant re-read (TC-PERF-054). Polled every 60 s by every dashboard tab.
        const sessionTenant = tenants?.[0]?.tenant;
        const populatedStatus =
            sessionTenant && typeof sessionTenant === 'object' && String(sessionTenant.id) === String(resolvedTenantId)
                ? (sessionTenant as { status?: string | null }).status
                : undefined;
        const [subResult, tenantResult] = await Promise.all([
            payload.find({
                collection: 'plan-subscriptions',
                where: { and: [{ tenant: { equals: resolvedTenantId } }, { name: { equals: 'main' } }] },
                sort: '-createdAt',
                limit: 1,
                pagination: false,
                depth: 0,
                select: { status: true, endsAt: true, canceledAt: true, canceledImmediately: true },
            }),
            populatedStatus !== undefined
                ? Promise.resolve({ docs: [{ status: populatedStatus }] })
                // Use find() instead of findByID() — findByID throws on missing doc → 500 on this polling endpoint
                : payload.find({
                    collection: 'tenants',
                    where: { id: { equals: resolvedTenantId } },
                    limit: 1,
                    pagination: false,
                    depth: 0,
                    select: { status: true },
                }),
        ]);

        const subRow = subResult.docs[0];
        if (subRow && !isSubscriptionActive(subRow as unknown as Parameters<typeof isSubscriptionActive>[0])) {
            console.warn('[session-check] force_logout: subscription_expired', { userId: user.id, tenantId: resolvedTenantId });
            return NextResponse.json(
                { action: 'force_logout', reason: 'subscription_expired' },
                { headers: { 'Cache-Control': 'no-store' } },
            );
        }

        // Ban enforcement: suspended tenant → force logout
        const tenant = tenantResult.docs[0] ?? null;
        if ((tenant as { status?: string } | null)?.status === 'suspended') {
            console.warn('[session-check] force_logout: Account suspended', { userId: user.id, tenantId: resolvedTenantId });
            return NextResponse.json(
                { action: 'force_logout', reason: 'Account suspended' },
                { headers: { 'Cache-Control': 'no-store' } },
            );
        }

        // Decode JWT exp to let the client proactively refresh before expiry.
        // Best-effort: failure returns null, not a 500.
        const cookieStore = await cookies();
        const rawToken = cookieStore.get('payload-token')?.value;
        let expiresAt: number | null = null;
        if (rawToken) {
            try {
                const parts = rawToken.split('.');
                const jwtPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
                expiresAt = typeof jwtPayload.exp === 'number' ? jwtPayload.exp * 1000 : null;
            } catch {
                // non-fatal: return ok:true without a usable expiresAt
            }
        }

        const response = NextResponse.json({ ok: true, expiresAt });
        response.headers.set('Cache-Control', 'private, max-age=30');
        return response;
    } catch (error) {
        // The session could not be checked (DB incident): 503 + Retry-After. The watcher keeps polling and never
        // counts it as a signed-out answer, unlike `{ ok:false, retry:true }` (TC-PERF-011).
        if (isAuthUnavailableError(error)) return authUnavailableResponse();
        console.error('[Session Check Error]:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

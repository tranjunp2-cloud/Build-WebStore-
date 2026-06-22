import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { getCurrentUser } from '@/lib/auth';
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

        // Subscription + ban checks run in parallel — both query independent collections.
        // No row in plan-subscriptions = new/unprovisioned tenant still onboarding → let through.
        const [subResult, tenantResult] = await Promise.all([
            payload.find({
                collection: 'plan-subscriptions',
                where: { and: [{ tenant: { equals: resolvedTenantId } }, { name: { equals: 'main' } }] },
                sort: '-createdAt',
                limit: 1,
            }),
            // Use find() instead of findByID() — findByID throws on missing doc → 500 on this polling endpoint
            payload.find({
                collection: 'tenants',
                where: { id: { equals: resolvedTenantId } },
                limit: 1,
                depth: 0,
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

        const response = NextResponse.json({ ok: true });
        response.headers.set('Cache-Control', 'private, max-age=30');
        return response;
    } catch (error) {
        console.error('[Session Check Error]:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

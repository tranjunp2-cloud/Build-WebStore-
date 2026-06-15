import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { getCurrentUser } from '@/lib/auth';
import { isSubscriptionActive } from '@/lib/subscriptions/plan-subscription';

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json(
                { action: 'force_logout', reason: 'Unauthenticated' },
                { headers: { 'Cache-Control': 'no-store' } },
            );
        }

        // Extract tenant from user directly — avoid 2nd getCurrentUser() call
        const tenants = user.tenants as Array<{ tenant: string | { id: string } }> | undefined;
        const firstTenant = tenants?.[0]?.tenant;
        const activeTenantId = typeof firstTenant === 'string' ? firstTenant : firstTenant?.id;

        if (!activeTenantId) {
            // No tenants = user was removed from their only workspace.
            // Note: detecting removal from one workspace while still in another requires
            // the client to pass the active tenantId as a query param — not yet implemented.
            return NextResponse.json(
                { action: 'force_logout', reason: 'Removed from workspace' },
                { headers: { 'Cache-Control': 'no-store' } },
            );
        }

        // Subscription expiry check — only evict if a row exists but is no longer active.
        // No row = new/unprovisioned tenant still onboarding → let through.
        const payload = await getPayload({ config });
        const subResult = await payload.find({
            collection: 'plan-subscriptions',
            where: { and: [{ tenant: { equals: activeTenantId } }, { name: { equals: 'main' } }] },
            sort: '-createdAt',
            limit: 1,
        });
        const subRow = subResult.docs[0];
        if (subRow && !isSubscriptionActive(subRow as unknown as Parameters<typeof isSubscriptionActive>[0])) {
            return NextResponse.json(
                { action: 'force_logout', reason: 'subscription_expired' },
                { headers: { 'Cache-Control': 'no-store' } },
            );
        }

        // Ban enforcement: suspended tenant → force logout (no-store, not cached)
        // Use find() instead of findByID() — findByID throws on missing doc → 500 on this polling endpoint
        const tenantResult = await payload.find({
            collection: 'tenants',
            where: { id: { equals: activeTenantId } },
            limit: 1,
            depth: 0,
        });
        const tenant = tenantResult.docs[0] ?? null;
        if ((tenant as { status?: string } | null)?.status === 'suspended') {
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

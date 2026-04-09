import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ action: 'force_logout', reason: 'Unauthenticated' });
        }

        // Extract tenant from user directly — avoid 2nd getCurrentUser() call
        const tenants = user.tenants as Array<{ tenant: string | { id: string } }> | undefined;
        const firstTenant = tenants?.[0]?.tenant;
        const activeTenantId = typeof firstTenant === 'string' ? firstTenant : firstTenant?.id;

        if (!activeTenantId) {
            return NextResponse.json({ action: 'force_logout', reason: 'Missing Tenant' });
        }

        const isStillInTenant = tenants?.some((t) => {
            const tId = typeof t.tenant === 'object' ? t.tenant?.id : t.tenant;
            return tId === activeTenantId;
        });

        if (!isStillInTenant) {
            return NextResponse.json({ action: 'force_logout', reason: 'Removed from workspace' });
        }

        const response = NextResponse.json({ ok: true });
        response.headers.set('Cache-Control', 'private, max-age=30');
        return response;
    } catch (error) {
        console.error('[Session Check Error]:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

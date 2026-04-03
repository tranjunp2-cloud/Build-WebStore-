import { NextResponse } from 'next/server';
import { getCurrentUser, getCurrentTenantId } from '@/lib/auth';

export async function GET() {
    try {
        const user = await getCurrentUser();
        const tenantId = await getCurrentTenantId();

        if (!user || !tenantId) {
            return NextResponse.json({ action: 'force_logout', reason: 'Unauthenticated or Missing Tenant' });
        }

        // Check if the user still belongs to the active tenant
        const isStillInTenant = user.tenants?.some((t: { tenant: string | { id: string } }) => {
            const tId = typeof t.tenant === 'object' ? t.tenant?.id : t.tenant;
            return tId === tenantId;
        });

        if (!isStillInTenant) {
            return NextResponse.json({ action: 'force_logout', reason: 'Removed from workspace' });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Session Check Error]:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

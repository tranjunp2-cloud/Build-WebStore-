import React from 'react';
import { getCurrentTenantId } from '@/lib/auth';
import { StaffDirectoryClient } from './StaffDirectoryClient';
import { getPayloadHMR } from '@payloadcms/next/utilities';
import configPromise from '@payload-config';

export default async function StaffPage() {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) return null;

    const payload = await getPayloadHMR({ config: configPromise });
    const usersRes = await payload.find({
        collection: 'users',
        where: {
            'tenants.tenant': { equals: tenantId }
        },
        limit: 100
    });

    // Determine the current user's role to see if they can remove others
    // We don't have direct req.user here efficiently inside page.tsx without reading cookies
    // Usually, we let the client side or actions handle granular auth since Payload endpoints handle security
    // But we need the current user ID to not let them remove themselves
    const { cookies } = await import('next/headers');
    // Instead of parsing token manually here, we'll let the user's browser provide it if needed, or pass the full list.
    // Actually `getCurrentTenantId` doesn't give us the user ID directly.
    // We can fetch via Payload using token if needed, but simple way is to pass `me` info:
    
    // We can get the user from payload REST or just let the Action handle the "Cannot remove yourself" check.

    const staffMembers = usersRes.docs.map(u => {
        const tenantInfo = u.tenants?.find((t: any) => (typeof t.tenant === 'object' ? t.tenant.id : t.tenant) === tenantId);
        return {
            id: String(u.id),
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            avatar: typeof u.avatar === 'object' ? u.avatar?.url : null,
            role: tenantInfo?.role || 'viewer',
            status: tenantInfo?.status || 'active',
            permissions: tenantInfo?.permissions || [],
            lastLoginAt: u.lastLoginAt
        };
    });

    return (
        <StaffDirectoryClient
            tenantId={tenantId}
            initialStaff={staffMembers}
        />
    );
}

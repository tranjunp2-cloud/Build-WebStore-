import React from 'react';
import { getCurrentTenantId, getCurrentUser } from '@/lib/auth';
import { StaffDirectoryClient } from './StaffDirectoryClient';
import { getPayloadHMR } from '@payloadcms/next/utilities';
import configPromise from '@payload-config';
import { redirect } from 'next/navigation';

export default async function StaffPage() {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) return null;
    
    const user = await getCurrentUser();
    if (!user) return null;

    const currentTenantInfo = user.tenants?.find((t: { tenant: string | number | { id: string | number }, role?: string }) => {
        const tId = typeof t.tenant === 'object' && t.tenant !== null ? String(t.tenant.id) : String(t.tenant)
        return tId === tenantId
    });
    const currentUserRole = currentTenantInfo?.role || 'viewer';
    const currentUserId = String(user.id);

    // BA Rule: Only Owner has access to staff management
    if (currentUserRole !== 'owner') {
        redirect('/settings');
    }

    const payload = await getPayloadHMR({ config: configPromise });
    const usersRes = await payload.find({
        collection: 'users',
        where: {
            'tenants.tenant': { equals: tenantId }
        },
        sort: '-createdAt',
        limit: 100
    });

    const staffMembers = usersRes.docs.map(u => {
        const tenantInfo = u.tenants?.find((t: { tenant: string | number | { id: string | number }, role?: string, status?: string }) => {
            const tId = typeof t.tenant === 'object' && t.tenant !== null ? String(t.tenant.id) : String(t.tenant)
            return tId === tenantId
        });
        return {
            id: String(u.id),
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            avatar: typeof u.avatar === 'object' ? u.avatar?.url : null,
            role: tenantInfo?.role || 'viewer',
            status: tenantInfo?.status ?? 'active',
            permissions: tenantInfo?.permissions || [],
            lastLoginAt: u.lastLoginAt,
            createdAt: u.createdAt
        };
    });

    return (
        <StaffDirectoryClient
            tenantId={tenantId}
            initialStaff={staffMembers}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
        />
    );
}

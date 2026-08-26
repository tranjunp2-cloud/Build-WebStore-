import React from 'react';
import { getCurrentTenantId, getCurrentUser } from '@/lib/auth';
import { getPayloadHMR } from '@payloadcms/next/utilities';
import configPromise from '@payload-config';
import { redirect } from 'next/navigation';
import type { PlatformUser } from '@/types/user';
import { TeamAccountTabs, type StaffTabProps } from './_components/TeamAccountTabs';

/**
 * Team & Account — merged 2-tab page (F18 phase-04, #1138).
 * Profile tab: every role. Staff tab: owner only — the staff list is ONLY fetched when the
 * viewer is the tenant owner, so non-owners never receive staff data in the RSC payload.
 * The old non-owner redirect is gone: everyone keeps a working path to their own profile.
 * /settings/profile stays as a standalone route (backward-compat; no sidebar link anymore).
 */
export default async function StaffPage() {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) return null;

    const user = await getCurrentUser();
    if (!user) redirect('/login');

    const currentTenantInfo = user.tenants?.find((t: { tenant: string | number | { id: string | number }, role?: string }) => {
        const tId = typeof t.tenant === 'object' && t.tenant !== null ? String(t.tenant.id) : String(t.tenant)
        return tId === tenantId
    });
    const currentUserRole = currentTenantInfo?.role || 'viewer';
    const currentUserId = String(user.id);
    const isOwner = currentUserRole === 'owner';

    const payload = await getPayloadHMR({ config: configPromise });

    // Profile data — every role (same shape as settings/profile/page.tsx)
    const full = await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 1,
    });
    const u = full as unknown as Record<string, unknown>;
    const initialUser: PlatformUser = {
        id: String(u.id ?? ''),
        email: String(u.email ?? ''),
        firstName: u.firstName as string | undefined,
        lastName: u.lastName as string | undefined,
        phone: u.phone as string | undefined,
        avatar: u.avatar as PlatformUser['avatar'],
        roles: u.roles as PlatformUser['roles'],
        tenants: u.tenants as PlatformUser['tenants'],
        lastLoginAt: u.lastLoginAt as string | undefined,
        createdAt: String(u.createdAt ?? ''),
        updatedAt: String(u.updatedAt ?? ''),
    };

    // Staff data — BA rule: owner only. The gate lives here (data layer), not in the UI:
    // non-owners get staffProps=undefined → no Staff tab, no staff rows in the payload.
    let staffProps: StaffTabProps | undefined;
    if (isOwner) {
        const usersRes = await payload.find({
            collection: 'users',
            where: {
                'tenants.tenant': { equals: tenantId }
            },
            sort: '-createdAt',
            limit: 100
        });

        const staffMembers = usersRes.docs.map(su => {
            const tenantInfo = su.tenants?.find((t: { tenant: string | number | { id: string | number }, role?: string, status?: string }) => {
                const tId = typeof t.tenant === 'object' && t.tenant !== null ? String(t.tenant.id) : String(t.tenant)
                return tId === tenantId
            });
            return {
                id: String(su.id),
                email: su.email,
                firstName: su.firstName,
                lastName: su.lastName,
                avatar: typeof su.avatar === 'object' ? su.avatar?.url : null,
                role: tenantInfo?.role || 'viewer',
                status: tenantInfo?.status ?? 'active',
                permissions: tenantInfo?.permissions || [],
                lastLoginAt: su.lastLoginAt,
                createdAt: su.createdAt
            };
        });

        staffProps = {
            tenantId,
            initialStaff: staffMembers,
            currentUserId,
            currentUserRole,
        };
    }

    return <TeamAccountTabs initialUser={initialUser} staffProps={staffProps} />;
}

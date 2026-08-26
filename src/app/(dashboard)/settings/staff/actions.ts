"use server";

import { getCurrentTenantId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

// In Docker dev environments, NEXT_PUBLIC_SERVER_URL has the external port (e.g. 3006), 
// but the Node.js server inside the container listens on the internal port (3000).
// For server actions hitting their own API, we must use the internal loopback address.
const isDev = process.env.NODE_ENV !== 'production';
const internalPort = process.env.PORT || 3000;
const serverUrl = isDev ? `http://127.0.0.1:${internalPort}` : (process.env.NEXT_PUBLIC_SERVER_URL || `http://127.0.0.1:${internalPort}`);

async function getAuthToken() {
    const cookieStore = await cookies();
    return cookieStore.get('payload-token')?.value;
}

interface InviteStaffData {
    email: string;
    name: string;
    role: string;
    permissions?: string[];
}

export async function inviteStaffAction(data: InviteStaffData) {
    try {
        const tenantId = await getCurrentTenantId();
        const token = await getAuthToken();

        if (!tenantId || !token) {
            return { success: false, error: 'Unauthorized' };
        }

        const res = await fetch(`${serverUrl}/api/users/invite-staff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `JWT ${token}`
            },
            body: JSON.stringify({ ...data, tenantId })
        });

        const resData = await res.json();
        
        if (!res.ok) {
            return { success: false, error: resData.errors?.[0]?.message || 'Failed to send invitation' };
        }

        revalidatePath('/settings/staff');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Internal error' };
    }
}

export async function updateStaff(userId: string, name: string, role: string, permissions?: string[]) {
    try {
        const tenantId = await getCurrentTenantId();
        const token = await getAuthToken();

        if (!tenantId || !token) return { success: false, error: 'Unauthorized' };

        const res = await fetch(`${serverUrl}/api/users/update-staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `JWT ${token}` },
            body: JSON.stringify({ userId, tenantId, name, role, permissions })
        });

        const data = await res.json();
        if (!res.ok) return { success: false, error: data.errors?.[0]?.message || 'Failed to update staff' };

        revalidatePath('/settings/staff');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Internal error' };
    }
}

export async function updateStaffStatus(userId: string, status: string) {
    try {
        const tenantId = await getCurrentTenantId();
        const token = await getAuthToken();

        if (!tenantId || !token) return { success: false, error: 'Unauthorized' };

        const res = await fetch(`${serverUrl}/api/users/update-staff-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `JWT ${token}` },
            body: JSON.stringify({ userId, tenantId, status })
        });

        const data = await res.json();
        if (!res.ok) return { success: false, error: data.errors?.[0]?.message || 'Failed to update status' };

        revalidatePath('/settings/staff');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Internal error' };
    }
}

export async function resendInvite(userId: string) {
    try {
        const tenantId = await getCurrentTenantId();
        const token = await getAuthToken();

        if (!tenantId || !token) return { success: false, error: 'Unauthorized' };

        const res = await fetch(`${serverUrl}/api/users/resend-invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `JWT ${token}` },
            body: JSON.stringify({ userId, tenantId })
        });

        const data = await res.json();
        if (!res.ok) return { success: false, error: data.errors?.[0]?.message || 'Failed to resend invite' };

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Internal error' };
    }
}

export async function removeStaff(userId: string) {
    try {
        const tenantId = await getCurrentTenantId();
        const token = await getAuthToken();

        if (!tenantId || !token) return { success: false, error: 'Unauthorized' };

        const res = await fetch(`${serverUrl}/api/users/remove-staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `JWT ${token}` },
            body: JSON.stringify({ userId, tenantId })
        });

        const data = await res.json();
        if (!res.ok) return { success: false, error: data.errors?.[0]?.message || 'Failed to remove user' };

        revalidatePath('/settings/staff');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Internal error' };
    }
}

export async function bulkRemoveStaff(userIds: string[]) {
    try {
        const tenantId = await getCurrentTenantId();
        const token = await getAuthToken();

        if (!tenantId || !token) return { success: false, error: 'Unauthorized' };

        const res = await fetch(`${serverUrl}/api/users/bulk-remove-staff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `JWT ${token}` },
            body: JSON.stringify({ userIds, tenantId })
        });

        const data = await res.json();
        if (!res.ok) return { success: false, error: data.errors?.[0]?.message || 'Failed to bulk remove' };

        revalidatePath('/settings/staff');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Internal error' };
    }
}

"use server";

import { getPayloadHMR } from '@payloadcms/next/utilities';
import configPromise from '@payload-config';
import { revalidatePath } from 'next/cache';

type DomainEntry = { domain: string; status: 'pending' | 'active'; isPrimary?: boolean };

// Helper to get current domains array from tenant
async function getTenantDomains(payload: Awaited<ReturnType<typeof getPayloadHMR>>, tenantId: string): Promise<DomainEntry[]> {
    const tenant = await payload.findByID({ collection: 'tenants', id: tenantId });
    const raw = tenant.customDomains;
    if (!raw || !Array.isArray(raw)) return [];
    return raw as DomainEntry[];
}

export async function addCustomDomain(tenantId: string, rawDomain: string) {
    // 1) Sanitize and validate domain format
    const domain = rawDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Simple but robust domain regex (letters, numbers, hyphens, and dots)
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
        return { success: false, error: 'Invalid domain format. Please enter a valid custom domain (e.g., store.example.com).' };
    }

    const payload = await getPayloadHMR({ config: configPromise });

    const current = await getTenantDomains(payload, tenantId);

    // Check domain not already registered by any tenant
    const all = await payload.find({
        collection: 'tenants',
        limit: 1000,
    });
    for (const t of all.docs) {
        const domains = (t.customDomains as DomainEntry[]) ?? [];
        if (Array.isArray(domains) && domains.some(d => d.domain === domain)) {
            return { success: false, error: 'Domain is already registered by another store.' };
        }
    }

    // Check not already in current tenant
    if (current.some(d => d.domain === domain)) {
        return { success: false, error: 'Domain already added to your store.' };
    }

    try {
        const updated = [...current, { domain, status: 'pending' as const }];
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { customDomains: updated },
        });
        revalidatePath('/settings/domains');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to add domain' };
    }
}

export async function removeCustomDomain(tenantId: string, domain: string) {
    const payload = await getPayloadHMR({ config: configPromise });
    try {
        const current = await getTenantDomains(payload, tenantId);
        const updated = current.filter(d => d.domain !== domain);
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { customDomains: updated },
        });
        revalidatePath('/settings/domains');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to remove domain' };
    }
}

export async function verifyCustomDomain(tenantId: string, domain: string) {
    const payload = await getPayloadHMR({ config: configPromise });

    const serverIp = process.env.SERVER_IP;

    let isSuccess = false;
    let errorMessage = 'Verification failed. DNS records not found. Propagation may take up to 48 hours.';

    if (!serverIp) {
        // ── DEV MODE: SERVER_IP not set → simulate (80% success) ──
        await new Promise(resolve => setTimeout(resolve, 1500));
        isSuccess = Math.random() > 0.2;
    } else {
        // ── PRODUCTION: Real DNS lookup ──
        try {
            const { promises: dns } = await import('dns');
            const addresses = await dns.resolve4(domain);
            isSuccess = addresses.includes(serverIp);
            if (!isSuccess) {
                errorMessage = `DNS mismatch. Expected A record to point to ${serverIp}. Propagation may take up to 48 hours.`;
            }
        } catch {
            isSuccess = false;
            errorMessage = `Could not resolve "${domain}". Please check your DNS records and try again.`;
        }
    }

    if (isSuccess) {
        try {
            const current = await getTenantDomains(payload, tenantId);
            const updated = current.map(d =>
                d.domain === domain ? { ...d, status: 'active' as const } : d
            );
            await payload.update({
                collection: 'tenants',
                id: tenantId,
                data: { customDomains: updated },
            });
            revalidatePath('/settings/domains');
            return { success: true };
        } catch {
            return { success: false, error: 'Failed to update verification status' };
        }
    } else {
        return { success: false, error: errorMessage };
    }
}

// REQ-F19-05: Set a verified (active) domain as the Primary Domain
// Clears isPrimary on all others, sets isPrimary:true on target
export async function setPrimaryDomain(tenantId: string, domain: string) {
    const payload = await getPayloadHMR({ config: configPromise });
    try {
        const current = await getTenantDomains(payload, tenantId);
        // Only allow setting active domains as primary
        const target = current.find(d => d.domain === domain);
        if (!target || target.status !== 'active') {
            return { success: false, error: 'Only verified (connected) domains can be set as primary.' };
        }
        const updated = current.map(d => ({
            ...d,
            isPrimary: d.domain === domain,
        }));
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { customDomains: updated },
        });
        revalidatePath('/settings/domains');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to update primary domain.' };
    }
}

// Clear isPrimary on all custom domains → platform subdomain becomes default primary
export async function clearPrimaryDomain(tenantId: string) {
    const payload = await getPayloadHMR({ config: configPromise });
    try {
        const current = await getTenantDomains(payload, tenantId);
        const updated = current.map(d => ({ ...d, isPrimary: false }));
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { customDomains: updated },
        });
        revalidatePath('/settings/domains');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to reset primary domain.' };
    }
}

"use server";

import { getPayloadHMR } from '@payloadcms/next/utilities';
import configPromise from '@payload-config';
import { revalidatePath } from 'next/cache';
import { getCurrentTenantId } from '@/lib/auth';

// DigitalOcean API Constants
const DO_API_URL = 'https://api.digitalocean.com/v2/apps';

type DomainEntry = { domain: string; status: 'pending' | 'active'; isPrimary?: boolean };

// DigitalOcean specific types to replace any
type DoAppSpecDomain = { domain?: string; type?: string; [k: string]: unknown };
type DoAppLiveDomain = { id?: string; phase?: string; spec?: DoAppSpecDomain; [k: string]: unknown };
// Helper to get current domains array from tenant
async function getTenantDomains(payload: Awaited<ReturnType<typeof getPayloadHMR>>, tenantId: string): Promise<DomainEntry[]> {
    const tenant = await payload.findByID({ collection: 'tenants', id: tenantId });
    const raw = tenant.customDomains;
    if (!raw || !Array.isArray(raw)) return [];
    return raw as DomainEntry[];
}

export async function addCustomDomain(rawDomain: string) {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
        return { success: false, error: 'Unauthorized' };
    }

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
    const existing = await payload.find({
        collection: 'tenants',
        where: {
            'customDomains.domain': {
                equals: domain
            }
        },
        limit: 1,
    });
    
    if (existing.docs.length > 0) {
        return { success: false, error: 'Domain is already registered by another store.' };
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

        // ── VIP: DigitalOcean API Integration ──
        const DO_API_TOKEN = process.env.DO_API_TOKEN;
        const DO_APP_ID = process.env.DO_APP_ID;
        // Only call if we have credentials
        if (DO_API_TOKEN && DO_APP_ID) {
            try {
                const doResponse = await fetch(`${DO_API_URL}/${DO_APP_ID}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${DO_API_TOKEN}`,
                        'Content-Type': 'application/json',
                    }
                });
                
                if (doResponse.ok) {
                    const appData = await doResponse.json();
                    
                    // Lời Lead: "Domain là cha ngoài spec". 
                    // Tức là phải check mảng appData.app.domains (nằm ngoài spec) để biết chính xác DO đang quản lý những domain nào.
                    const liveDomains = appData.app.domains || [];
                    
                    // Nếu domain chưa thực sự tồn tại trên DO Live Domains
                    if (!liveDomains.some((d: DoAppLiveDomain) => d.spec?.domain === domain)) {
                        const appSpec = appData.app.spec; // Bản config
                        const specDomains = appSpec.domains || [];
                        const newDomains = [...specDomains, { domain, type: 'ALIAS' }];
                        
                        // Update the app spec
                        const putResponse = await fetch(`${DO_API_URL}/${DO_APP_ID}`, {
                            method: 'PUT',
                            headers: {
                                'Authorization': `Bearer ${DO_API_TOKEN}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                spec: {
                                    ...appSpec,
                                    domains: newDomains
                                }
                            })
                        });
                        
                        if (!putResponse.ok) {
                            console.error('DO API Error (PUT Add Domain):', await putResponse.text());
                        }
                    }
                }
            } catch (doError) {
                console.error('DO API Error (Add Domain):', doError);
                // We still returned success because it's in our DB, but background DO task failed.
            }
        }

        revalidatePath('/settings/domains');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to add domain' };
    }
}

export async function removeCustomDomain(domain: string) {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
        return { success: false, error: 'Unauthorized' };
    }

    const payload = await getPayloadHMR({ config: configPromise });
    try {
        const current = await getTenantDomains(payload, tenantId);
        const updated = current.filter(d => d.domain !== domain);
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { customDomains: updated },
        });

        // ── VIP: DigitalOcean API Integration (Remove) ──
        const DO_API_TOKEN = process.env.DO_API_TOKEN;
        const DO_APP_ID = process.env.DO_APP_ID;
        if (DO_API_TOKEN && DO_APP_ID) {
            try {
                const doResponse = await fetch(`${DO_API_URL}/${DO_APP_ID}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${DO_API_TOKEN}`,
                        'Content-Type': 'application/json',
                    }
                });
                
                if (doResponse.ok) {
                    const appData = await doResponse.json();
                    const appSpec = appData.app.spec;
                    
                    // Filter out the domain from DO spec
                    const newDomains = (appSpec.domains || []).filter((d: DoAppSpecDomain) => d.domain !== domain);
                    
                    const putResponse = await fetch(`${DO_API_URL}/${DO_APP_ID}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${DO_API_TOKEN}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            spec: {
                                ...appSpec,
                                domains: newDomains
                            }
                        })
                    });
                    
                    if (!putResponse.ok) {
                        console.error('DO API Error (PUT Remove Domain):', await putResponse.text());
                    }
                }
            } catch (doError) {
                console.error('DO API Error (Remove Domain):', doError);
            }
        }

        revalidatePath('/settings/domains');
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to remove domain' };
    }
}

export async function verifyCustomDomain(domain: string) {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
        return { success: false, error: 'Unauthorized' };
    }

    const payload = await getPayloadHMR({ config: configPromise });

    const serverIp = process.env.SERVER_IP;

    let isSuccess = false;
    let errorMessage = 'Verification failed. DNS records not found. Propagation may take up to 48 hours.';

    if (!serverIp) {
        // ── DEV MODE: SERVER_IP not set → simulate (80% success) ──
        await new Promise(resolve => setTimeout(resolve, 1500));
        isSuccess = Math.random() > 0.2;
    } else {
        // ── PRODUCTION: Real DNS lookup & DO SSL Check ──
        try {
            const { promises: dns } = await import('dns');
            const addresses = await dns.resolve4(domain);
            
            // Handle multiple IPs (comma separated in env)
            const validIps = (process.env.SERVER_IP || process.env.NEXT_PUBLIC_SERVER_IP || '').split(',').map(ip => ip.trim());
            
            // Check if any resolved IP matches our valid ingress IPs
            const isDnsMatched = addresses.some(ip => validIps.includes(ip));
            
            if (!isDnsMatched) {
                isSuccess = false;
                errorMessage = `DNS mismatch. Domain points to ${addresses.join(', ')}. Expected one of: ${validIps.join(', ')}. Propagation may take up to 48 hours.`;
            } else {
                // DNS is OK, now check if DO has finished SSL provisioning
                const DO_API_TOKEN = process.env.DO_API_TOKEN;
                const DO_APP_ID = process.env.DO_APP_ID;
                if (DO_API_TOKEN && DO_APP_ID) {
                    const doResponse = await fetch(`${DO_API_URL}/${DO_APP_ID}`, {
                        headers: { 'Authorization': `Bearer ${DO_API_TOKEN}` }
                    });
                    
                    if (doResponse.ok) {
                        const appData = await doResponse.json();
                        
                        // Domain status live tracking
                        const domainsStatuses = appData.app.domains || [];
                        const domainStatus = domainsStatuses.find((d: DoAppLiveDomain) => d.spec?.domain === domain);
                        
                        if (!domainStatus) {
                            // If undefined, it means DO hasn't started tracking it in live state (Deployment is pending)
                            isSuccess = false;
                            errorMessage = 'Domain registration is syncing with DigitalOcean. Please wait a few minutes and try again.';
                        } else {
                            const phase = domainStatus.phase?.toUpperCase();
                            if (phase === 'ACTIVE') {
                                isSuccess = true;
                            } else if (phase === 'ERROR') {
                                isSuccess = false;
                                errorMessage = 'Domain SSL configuration failed on DigitalOcean. Please check your DNS records, or try removing and re-adding the domain.';
                            } else {
                                // PENDING, CONFIGURING, etc.
                                isSuccess = false;
                                errorMessage = `SSL Provisioning is currently ${phase || 'in progress'}. Please wait up to 48 hours.`;
                            }
                        }
                    } else {
                        // If DO API fails, fall back to just DNS success to avoid blocking
                        isSuccess = true;
                    }
                } else {
                    // No API Token? Just trust the DNS check.
                    isSuccess = true;
                }
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
export async function setPrimaryDomain(domain: string) {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
        return { success: false, error: 'Unauthorized' };
    }

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
export async function clearPrimaryDomain() {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
        return { success: false, error: 'Unauthorized' };
    }

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

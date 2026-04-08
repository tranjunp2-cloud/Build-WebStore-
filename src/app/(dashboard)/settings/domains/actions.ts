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
                    
                    // Technical Note: DO's 'app.spec.domains' holds the static configuration target.
                    // We must inspect the top-level 'app.domains' array (live state outside the spec) 
                    // to accurately track real-time SSL provisioning and deployment phases.
                    const liveDomains = appData.app.domains || [];
                    const appSpec = appData.app.spec || {}; // Bản config
                    const specDomains = appSpec.domains || [];
                    
                    // Nếu domain chưa thực sự tồn tại trên DO Live Domains và cũng chưa có trong Spec pending
                    const isLive = liveDomains.some((d: DoAppLiveDomain) => d.spec?.domain === domain);
                    const isInSpec = specDomains.some((d: DoAppSpecDomain) => d.domain === domain);
                    
                    if (!isLive && !isInSpec) {
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
                // Domain saved in DB but DO sync failed — inform user so they can retry
                revalidatePath('/settings/domains');
                return { success: true, warning: 'Domain saved, but failed to register with hosting provider. Verification may be delayed — please try verifying later or contact support.' };
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

        // Block removing the current primary domain (TC-F19.14 QA)
        const target = current.find(d => d.domain === domain);
        if (target?.isPrimary) {
            return { success: false, error: 'Cannot remove the primary domain. Please set another domain as primary first.' };
        }

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
                // Domain removed from DB but DO sync failed — warn user
                revalidatePath('/settings/domains');
                return { success: true, warning: 'Domain removed from your store, but failed to sync with hosting provider. The domain may still route temporarily — please contact support if it persists.' };
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
        // SERVER_IP is required for DNS verification — block if not configured
        return {
            success: false,
            error: 'Domain verification is not available. Server configuration is missing (SERVER_IP). Please contact support.',
        };
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
                        // DO API failed — cannot confirm SSL provisioning (REQ-F19-04)
                        isSuccess = false;
                        errorMessage = 'DNS records are correct, but SSL status could not be confirmed. Please try again in a few minutes.';
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

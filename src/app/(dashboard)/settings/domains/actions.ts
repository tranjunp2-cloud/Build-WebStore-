"use server";

import { getPayloadHMR } from '@payloadcms/next/utilities';
import configPromise from '@payload-config';
import { revalidatePath } from 'next/cache';
import { promises as dns } from 'dns';
import psl from 'psl';
import { getCurrentTenantId } from '@/lib/auth';
import {
    addProjectDomain,
    verifyProjectDomain,
    getProjectDomain,
    removeProjectDomain,
} from '@/lib/vercel/domains';
import {
    VercelDomainsError,
    type VercelDomainVerification,
} from '@/lib/vercel/domains.types';

// Env-driven DNS expectations — default to Vercel's public values.
// Override via VERCEL_APEX_A_RECORD / VERCEL_CNAME_TARGET if Vercel rotates them.
const VERCEL_APEX_IP = process.env.VERCEL_APEX_A_RECORD ?? '76.76.21.21';
const VERCEL_CNAME = process.env.VERCEL_CNAME_TARGET ?? 'cname.vercel-dns.com';

type DomainEntry = {
    domain: string;
    status: 'pending' | 'active';
    isPrimary?: boolean;
    // Phase 02 schema fields. Payload types aren't regenerated yet (pre-existing
    // `pnpm payload generate:types` break), so these are declared here too.
    vercelDomainId?: string | null;
    vercelVerification?: VercelDomainVerification[] | null;
};

export type DomainActionResult =
    | { success: true; verification?: VercelDomainVerification[]; warning?: string }
    | { success: false; error: string; verification?: VercelDomainVerification[] };

// Helper to get current domains array from tenant
async function getTenantDomains(
    payload: Awaited<ReturnType<typeof getPayloadHMR>>,
    tenantId: string,
): Promise<DomainEntry[]> {
    const tenant = await payload.findByID({ collection: 'tenants', id: tenantId });
    const raw = tenant.customDomains;
    if (!raw || !Array.isArray(raw)) return [];
    return raw as DomainEntry[];
}

// psl.parse returns `subdomain: null` only for apex; anything with a label before
// the registrable domain (e.g. `store.example.com`) comes back with a non-null subdomain.
function isApexDomain(domain: string): boolean {
    const parsed = psl.parse(domain);
    if ('error' in parsed) return false;
    return parsed.subdomain === null;
}

// Convert IDN (e.g. `café.example.com`) to punycode so the regex + Vercel API
// both see ASCII. Falls back to the raw input if URL parsing fails — the regex
// will then reject it.
function toPunycode(domain: string): string {
    try {
        return new URL(`http://${domain}`).hostname;
    } catch {
        return domain;
    }
}

// Map provider errors to user-safe strings. Never leak raw URLs / internal IDs.
function mapVercelError(err: VercelDomainsError): string {
    if (err.code === 'domain_already_in_use') {
        return 'Domain already registered by another store.';
    }
    if (err.code === 'forbidden') {
        return 'Provider authentication failed. Please contact support.';
    }
    if (err.status === 429) {
        return `Too many requests. Please wait ${err.retryAfter ?? 60}s and try again.`;
    }
    if (err.status >= 500) {
        return 'Provider is temporarily unavailable. Please try again in a moment.';
    }
    return 'Unable to complete domain operation. Please try again or contact support.';
}

export async function addCustomDomain(rawDomain: string): Promise<DomainActionResult> {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
        return { success: false, error: 'Unauthorized' };
    }

    // 1) Sanitize input.
    const sanitized = rawDomain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '');

    // 2) IDN → punycode BEFORE validation so non-ASCII domains pass the regex (scenario 2.4).
    const domain = toPunycode(sanitized);

    // 3) Strict regex — letters/digits/hyphens/dots only. Rejects SSRF chars (#, ?, @, :, /).
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
        return {
            success: false,
            error: 'Invalid domain format. Please enter a valid custom domain (e.g., store.example.com).',
        };
    }

    const payload = await getPayloadHMR({ config: configPromise });

    const current = await getTenantDomains(payload, tenantId);

    // Cross-tenant uniqueness (scenario 3.2 defense in depth — Vercel 409 is the
    // second line of defense).
    const existing = await payload.find({
        collection: 'tenants',
        where: {
            'customDomains.domain': {
                equals: domain,
            },
        },
        limit: 1,
    });

    if (existing.docs.length > 0) {
        return { success: false, error: 'Domain already registered by another store.' };
    }

    // In-tenant dup.
    if (current.some((d) => d.domain === domain)) {
        return { success: false, error: 'Domain already added to your store.' };
    }

    // Step 1: write optimistic 'pending' row so the user sees feedback even if Vercel is slow.
    const optimistic: DomainEntry[] = [
        ...current,
        { domain, status: 'pending' },
    ];

    try {
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            // Payload types are stale (vercelDomainId / vercelVerification not regenerated
            // yet — tracked in plan). Cast through unknown to keep the call typed at runtime.
            data: { customDomains: optimistic } as unknown as Record<string, unknown>,
        });
    } catch (err) {
        console.error('[addCustomDomain] Payload optimistic write failed:', err);
        return {
            success: false,
            error: 'Unable to save domain. Please try again or contact support.',
        };
    }

    // Step 2: call Vercel.
    let vercelDomain;
    try {
        vercelDomain = await addProjectDomain(domain);
    } catch (err) {
        // Scenario 5.2 — Vercel failed AFTER Payload write. Roll back to avoid orphan row.
        try {
            await payload.update({
                collection: 'tenants',
                id: tenantId,
                data: { customDomains: current } as unknown as Record<string, unknown>,
            });
        } catch (rollbackErr) {
            console.error('[addCustomDomain] Rollback failed:', rollbackErr);
        }

        if (err instanceof VercelDomainsError) {
            return { success: false, error: mapVercelError(err) };
        }
        console.error('[addCustomDomain] Unexpected Vercel error:', err);
        return {
            success: false,
            error: 'Unable to complete domain operation. Please try again or contact support.',
        };
    }

    // Step 3: persist Vercel result. Two branches:
    //   a) verified=true + no verification → active immediately.
    //   b) otherwise → keep pending, store verification[] (may be empty if DNS not pointed).
    const isActive = vercelDomain.verified === true && !vercelDomain.verification?.length;
    const finalRow: DomainEntry = {
        domain,
        status: isActive ? 'active' : 'pending',
        vercelDomainId: vercelDomain.name,
        vercelVerification: vercelDomain.verification ?? null,
    };
    const finalList: DomainEntry[] = [...current, finalRow];

    try {
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { customDomains: finalList } as unknown as Record<string, unknown>,
        });
    } catch (err) {
        // Scenario 5.1 — Payload write failed AFTER Vercel registered the domain.
        // Reverse the Vercel side so we don't leave an orphan binding.
        console.error('[addCustomDomain] Payload final write failed — reversing Vercel:', err);
        try {
            await removeProjectDomain(domain);
        } catch (cleanupErr) {
            console.error('[addCustomDomain] Vercel reverse cleanup failed:', cleanupErr);
        }
        return {
            success: false,
            error: 'Service temporarily unavailable, please try again.',
        };
    }

    revalidatePath('/settings/domains');
    return {
        success: true,
        verification: vercelDomain.verification,
    };
}

export async function removeCustomDomain(rawDomain: string): Promise<DomainActionResult> {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
        return { success: false, error: 'Unauthorized' };
    }

    const domain = rawDomain.trim().toLowerCase();
    const payload = await getPayloadHMR({ config: configPromise });

    try {
        const current = await getTenantDomains(payload, tenantId);

        // CRITICAL — scenario 8.1 mirror: verify domain belongs to THIS tenant before
        // calling Vercel. Without this, tenant A could remove tenant B's domain from Vercel.
        const target = current.find((d) => d.domain === domain);
        if (!target) {
            return { success: false, error: 'Domain not found in your store.' };
        }

        // Block removing the current primary (TC-F19.14 QA).
        if (target.isPrimary) {
            return {
                success: false,
                error: 'Cannot remove the primary domain. Please set another domain as primary first.',
            };
        }

        const updated = current.filter((d) => d.domain !== domain);
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { customDomains: updated } as unknown as Record<string, unknown>,
        });

        // Best-effort Vercel cleanup. Payload is source of truth (scenario 5.6), so
        // any Vercel failure is logged but not surfaced to the user.
        try {
            await removeProjectDomain(domain);
        } catch (err) {
            if (err instanceof VercelDomainsError) {
                // Scenario 5.5 — domain already gone from Vercel. Idempotent.
                if (err.status === 404) {
                    console.warn(
                        `[removeCustomDomain] ${domain} already removed from Vercel (404), treating as success.`,
                    );
                } else if (err.status >= 500) {
                    // Scenario 5.6 — provider 5xx. Keep Payload removal.
                    console.error(
                        `[removeCustomDomain] Vercel ${err.status} removing ${domain}; Payload already cleared:`,
                        err.message,
                    );
                } else {
                    console.error(
                        `[removeCustomDomain] Vercel error removing ${domain}:`,
                        err.code,
                        err.message,
                    );
                }
            } else {
                console.error('[removeCustomDomain] Unexpected error removing from Vercel:', err);
            }
        }

        revalidatePath('/settings/domains');
        return { success: true };
    } catch (err) {
        console.error('[removeCustomDomain] Failed:', err);
        return { success: false, error: 'Failed to remove domain' };
    }
}

export async function verifyCustomDomain(rawDomain: string): Promise<DomainActionResult> {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
        return { success: false, error: 'Unauthorized' };
    }

    const domain = rawDomain.trim().toLowerCase();
    const payload = await getPayloadHMR({ config: configPromise });

    // CRITICAL — scenario 8.1: verify the domain belongs to THIS tenant before
    // calling Vercel. Without this, tenant A could call /verify on tenant B's
    // domain and (on success) mutate tenant B's row. We only mutate the current
    // tenant's row below, but still enforce ownership here so we don't probe
    // Vercel for arbitrary attacker-controlled strings.
    const current = await getTenantDomains(payload, tenantId);
    const row = current.find((d) => d.domain === domain);
    if (!row) {
        return { success: false, error: 'Domain not found in your store.' };
    }

    // Idempotent early return — respects Vercel's ~50/hr verify rate limit.
    if (row.status === 'active') {
        return { success: true };
    }

    // Soft DNS pre-flight — log-only, never hard-fails. Vercel is the source of truth.
    try {
        if (isApexDomain(domain)) {
            const addresses = await dns.resolve4(domain);
            if (!addresses.includes(VERCEL_APEX_IP)) {
                console.warn(
                    `[verifyCustomDomain] ${domain} apex does not yet point at ${VERCEL_APEX_IP}; resolved: ${addresses.join(', ')}`,
                );
            }
        } else {
            const cnames = await dns.resolveCname(domain);
            const normalized = cnames.map((c) => c.replace(/\.$/, '').toLowerCase());
            if (!normalized.includes(VERCEL_CNAME.toLowerCase())) {
                console.warn(
                    `[verifyCustomDomain] ${domain} CNAME does not yet point at ${VERCEL_CNAME}; resolved: ${cnames.join(', ')}`,
                );
            }
        }
    } catch (dnsErr) {
        console.warn(`[verifyCustomDomain] DNS pre-flight failed for ${domain}:`, dnsErr);
        // Continue anyway — Vercel will confirm.
    }

    // Call Vercel verify.
    try {
        const result = await verifyProjectDomain(domain);

        if (result.verified === true && !result.verification?.length) {
            // Success — persist active status and clear any stale verification challenges.
            const updated = current.map((d) =>
                d.domain === domain
                    ? {
                          ...d,
                          status: 'active' as const,
                          vercelDomainId: result.name,
                          vercelVerification: null,
                      }
                    : d,
            );
            try {
                await payload.update({
                    collection: 'tenants',
                    id: tenantId,
                    data: { customDomains: updated } as unknown as Record<string, unknown>,
                });
            } catch (err) {
                console.error('[verifyCustomDomain] Payload update after success failed:', err);
                return { success: false, error: 'Failed to update verification status.' };
            }
            revalidatePath('/settings/domains');
            return { success: true };
        }

        // verified=false with verification[] — rare on /verify (usually surfaced by /add),
        // but persist and surface.
        const verification = result.verification ?? [];
        const updated = current.map((d) =>
            d.domain === domain
                ? { ...d, vercelVerification: verification }
                : d,
        );
        try {
            await payload.update({
                collection: 'tenants',
                id: tenantId,
                data: { customDomains: updated } as unknown as Record<string, unknown>,
            });
        } catch (err) {
            console.error('[verifyCustomDomain] Payload verification persist failed:', err);
        }
        revalidatePath('/settings/domains');
        return {
            success: false,
            error: 'Verification failed. Please add the TXT record below.',
            verification,
        };
    } catch (err) {
        if (err instanceof VercelDomainsError) {
            // 400 from /verify typically means TXT missing or mismatched. Fetch fresh
            // verification challenges via GET so we can surface them.
            if (err.status === 400) {
                let verification: VercelDomainVerification[] = [];
                try {
                    const fresh = await getProjectDomain(domain);
                    verification = fresh.verification ?? [];
                } catch (getErr) {
                    console.error(
                        '[verifyCustomDomain] getProjectDomain after 400 failed:',
                        getErr,
                    );
                }

                const updated = current.map((d) =>
                    d.domain === domain
                        ? { ...d, vercelVerification: verification }
                        : d,
                );
                try {
                    await payload.update({
                        collection: 'tenants',
                        id: tenantId,
                        data: { customDomains: updated } as unknown as Record<string, unknown>,
                    });
                } catch (updateErr) {
                    console.error(
                        '[verifyCustomDomain] Payload persist after 400 failed:',
                        updateErr,
                    );
                }
                revalidatePath('/settings/domains');
                return {
                    success: false,
                    error: 'Verification failed. Please add the TXT record below.',
                    verification,
                };
            }

            return { success: false, error: mapVercelError(err) };
        }

        console.error('[verifyCustomDomain] Unexpected error:', err);
        return {
            success: false,
            error: 'Unable to verify domain. Please try again or contact support.',
        };
    }
}

// REQ-F19-05: Set a verified (active) domain as the Primary Domain.
// Clears isPrimary on all others, sets isPrimary:true on target.
// Platform-agnostic — no provider calls.
export async function setPrimaryDomain(domain: string): Promise<DomainActionResult> {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
        return { success: false, error: 'Unauthorized' };
    }

    const payload = await getPayloadHMR({ config: configPromise });
    try {
        const current = await getTenantDomains(payload, tenantId);
        const target = current.find((d) => d.domain === domain);
        if (!target || target.status !== 'active') {
            return {
                success: false,
                error: 'Only verified (connected) domains can be set as primary.',
            };
        }
        const updated = current.map((d) => ({
            ...d,
            isPrimary: d.domain === domain,
        }));
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { customDomains: updated } as unknown as Record<string, unknown>,
        });
        revalidatePath('/settings/domains');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to update primary domain.' };
    }
}

// Clear isPrimary on all custom domains → platform subdomain becomes default primary.
// Platform-agnostic — no provider calls.
export async function clearPrimaryDomain(): Promise<DomainActionResult> {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
        return { success: false, error: 'Unauthorized' };
    }

    const payload = await getPayloadHMR({ config: configPromise });
    try {
        const current = await getTenantDomains(payload, tenantId);
        const updated = current.map((d) => ({ ...d, isPrimary: false }));
        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { customDomains: updated } as unknown as Record<string, unknown>,
        });
        revalidatePath('/settings/domains');
        return { success: true };
    } catch {
        return { success: false, error: 'Failed to reset primary domain.' };
    }
}

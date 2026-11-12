import React from 'react';
import { getCurrentTenantId, getCurrentUser } from '@/lib/auth';
import { canBuildSite } from '@/lib/sites/site-access';
import { DomainsClient } from './DomainsClient';
import { resolveWebsiteStatus } from './website-status';
import { getPayloadHMR } from '@payloadcms/next/utilities';
import configPromise from '@payload-config';
import type { VercelDomainVerification } from '@/lib/vercel/domains.types';

export const dynamic = 'force-dynamic';

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'primeweb.app';

export default async function DomainsPage() {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) return null;

    const payload = await getPayloadHMR({ config: configPromise });
    const [tenant, user, siteResult] = await Promise.all([
        payload.findByID({
            collection: 'tenants',
            id: tenantId,
        }),
        getCurrentUser(),
        // One tenant = one site (same lookup as the shipping settings page).
        payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            limit: 1,
            depth: 0,
            select: { id: true, status: true, publishedAt: true },
            overrideAccess: true,
        }),
    ]);

    // Read from customDomains json array (supports multiple domains)
    const raw = tenant.customDomains;
    const customDomains: Array<{ domain: string; status: string; isPrimary?: boolean; vercelVerification?: VercelDomainVerification[] | null }> =
        Array.isArray(raw)
            ? (raw as Array<{ domain: string; status: string; isPrimary?: boolean; vercelVerification?: VercelDomainVerification[] | null }>).filter(d => d?.domain)
            : [];

    const site = siteResult.docs[0];
    const tenantSlug = tenant.slug as string;
    const primaryDomain = customDomains.find(d => d.status === 'active' && d.isPrimary)?.domain;
    const website = site
        ? {
            siteId: String(site.id),
            status: resolveWebsiteStatus({
                status: typeof site.status === 'string' ? site.status : null,
                publishedAt: typeof site.publishedAt === 'string' ? site.publishedAt : null,
            }),
            siteUrl: primaryDomain
                ? `https://${primaryDomain}`
                : tenantSlug ? `https://${tenantSlug}.${PLATFORM_DOMAIN}` : null,
            // Same check the DELETE /api/sites/:id/publish route makes (403 otherwise).
            canUnpublish: !!user && canBuildSite(user, String(tenantId)),
        }
        : null;

    return (
        <DomainsClient
            tenantId={tenantId}
            tenantSlug={tenantSlug}
            customDomains={customDomains}
            website={website}
        />
    );
}

import React from 'react';
import { getCurrentTenantId } from '@/lib/auth';
import { DomainsClient } from './DomainsClient';
import { getPayloadHMR } from '@payloadcms/next/utilities';
import configPromise from '@payload-config';

export default async function DomainsPage() {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) return null;

    const payload = await getPayloadHMR({ config: configPromise });
    const tenant = await payload.findByID({
        collection: 'tenants',
        id: tenantId,
    });

    // Read from customDomains json array (supports multiple domains)
    const raw = tenant.customDomains;
    const customDomains: Array<{ domain: string; status: string; isPrimary?: boolean }> =
        Array.isArray(raw)
            ? (raw as Array<{ domain: string; status: string; isPrimary?: boolean }>).filter(d => d?.domain)
            : [];

    return (
        <DomainsClient
            tenantId={tenantId}
            tenantSlug={tenant.slug as string}
            customDomains={customDomains}
        />
    );
}

import React from 'react';
import { getPayload } from 'payload';
import config from '@payload-config';
import { getCurrentTenantId } from '@/lib/auth';
import { PaymentsFormClient } from './PaymentsFormClient';

export default async function PaymentsPage() {
    const tenantId = await getCurrentTenantId();
    const payload = await getPayload({ config });

    let cardEnabled = true;
    let fpxEnabled = true;

    if (tenantId) {
        const sites = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: tenantId } },
            limit: 1,
        });
        const site = sites.docs[0];
        const paymentConfig = (site as any)?.paymentConfig ?? {};
        cardEnabled = paymentConfig.cardEnabled !== false;
        fpxEnabled = paymentConfig.fpxEnabled !== false;
    }

    return (
        <PaymentsFormClient
            tenantId={tenantId ?? undefined}
            initialCardEnabled={cardEnabled}
            initialFpxEnabled={fpxEnabled}
        />
    );
}

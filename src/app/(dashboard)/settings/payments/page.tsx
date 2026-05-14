import React from 'react';
import { getPayload } from 'payload';
import config from '@payload-config';
import { getCurrentTenantId } from '@/lib/auth';
import { PaymentsFormClient } from './PaymentsFormClient';

export default async function PaymentsPage() {
    const tenantId = await getCurrentTenantId();
    const payload = await getPayload({ config });

    let stripeOnboardingComplete = false;
    let stripeAccountId: string | null = null;
    let cardEnabled = false;
    let fpxEnabled = false;

    if (tenantId) {
        const tenant = await payload.findByID({ collection: 'tenants', id: tenantId });
        stripeOnboardingComplete = (tenant as any)?.stripeOnboardingComplete ?? false;
        stripeAccountId = (tenant as any)?.stripeAccountId ?? null;
        cardEnabled = (tenant as any)?.payments?.payment_card ?? false;
        fpxEnabled = (tenant as any)?.payments?.payment_fpx ?? false;
    }

    return (
        <PaymentsFormClient
            tenantId={tenantId ?? undefined}
            stripeOnboardingComplete={stripeOnboardingComplete}
            stripeAccountId={stripeAccountId}
            initialCardEnabled={cardEnabled}
            initialFpxEnabled={fpxEnabled}
        />
    );
}

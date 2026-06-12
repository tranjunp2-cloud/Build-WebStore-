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
    let xenditAccountId: string | null = null;
    let xenditAccountStatus = 'NOT_CONNECTED';
    let xenditOnboardingComplete = false;
    let xenditTngEnabled = false;
    let xenditGrabpayEnabled = false;
    let xenditDuitnowEnabled = false;
    let xenditFpxEnabled = false;
    let xenditShopeepayEnabled = false;
    let xenditBoostEnabled = false;
    let xenditMaeEnabled = false;

    if (tenantId) {
        const tenant = await payload.findByID({ collection: 'tenants', id: tenantId });
        stripeOnboardingComplete = (tenant as any)?.stripeOnboardingComplete ?? false;
        stripeAccountId = (tenant as any)?.stripeAccountId ?? null;
        cardEnabled = (tenant as any)?.payments?.payment_card ?? false;
        fpxEnabled = (tenant as any)?.payments?.payment_fpx ?? false;
        xenditAccountId = (tenant as any)?.xenditAccountId ?? null;
        xenditAccountStatus = (tenant as any)?.xenditAccountStatus ?? 'NOT_CONNECTED';
        xenditOnboardingComplete = (tenant as any)?.xenditOnboardingComplete ?? false;
        xenditTngEnabled = (tenant as any)?.payments?.xendit_tng ?? false;
        xenditGrabpayEnabled = (tenant as any)?.payments?.xendit_grabpay ?? false;
        xenditDuitnowEnabled = (tenant as any)?.payments?.xendit_duitnow ?? false;
        xenditFpxEnabled = (tenant as any)?.payments?.xendit_fpx ?? false;
        xenditShopeepayEnabled = (tenant as any)?.payments?.xendit_shopeepay ?? false;
        xenditBoostEnabled = (tenant as any)?.payments?.xendit_boost ?? false;
        xenditMaeEnabled = (tenant as any)?.payments?.xendit_mae ?? false;
    }

    return (
        <PaymentsFormClient
            tenantId={tenantId ?? undefined}
            stripeOnboardingComplete={stripeOnboardingComplete}
            stripeAccountId={stripeAccountId}
            initialCardEnabled={cardEnabled}
            initialFpxEnabled={fpxEnabled}
            xenditAccountId={xenditAccountId}
            xenditAccountStatus={xenditAccountStatus}
            xenditOnboardingComplete={xenditOnboardingComplete}
            initialXenditTngEnabled={xenditTngEnabled}
            initialXenditGrabpayEnabled={xenditGrabpayEnabled}
            initialXenditDuitnowEnabled={xenditDuitnowEnabled}
            initialXenditFpxEnabled={xenditFpxEnabled}
            initialXenditShopeepayEnabled={xenditShopeepayEnabled}
            initialXenditBoostEnabled={xenditBoostEnabled}
            initialXenditMaeEnabled={xenditMaeEnabled}
        />
    );
}

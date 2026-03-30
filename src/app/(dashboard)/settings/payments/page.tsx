import React from 'react';
import { getCurrentTenantId } from '@/lib/auth';
import { PaymentsFormClient } from './PaymentsFormClient';

export default async function PaymentsPage() {
    const tenantId = await getCurrentTenantId();
    
    return <PaymentsFormClient tenantId={tenantId ?? undefined} />;
}

import { getPayload } from 'payload'
import config from '@payload-config'
import { isAiAgentEnabled } from '@/lib/ai-platform/config'
import { getCurrentTenantId, getCurrentUser } from '@/lib/auth'
import { canManageAutomations } from '@/lib/automations/automation-access'
import { readAutomationSettings } from '@/lib/automations/automation-store'
import { EMAIL_TEMPLATE_TYPES } from '@/lib/email/types'
import { getDefaultContentFields } from '@/lib/email/template-default-fields'
import type { ContentFields } from '@/lib/email/template-default-fields'
import type { EmailTemplateType } from '@/lib/email/types'
import { AutomationsSection } from './_components/automations-section'
import { EmailTemplatesClient } from './_components/EmailTemplatesClient'
import { AgentRefresh } from '@/lib/agent-changes/agent-refresh'

export default async function EmailTemplatesPage() {
    const tenantId = await getCurrentTenantId()
    const payload = await getPayload({ config })

    let rows: any[] = []
    if (tenantId) {
        const result = await payload.find({
            collection: 'email-template-settings',
            where: { tenant: { equals: tenantId } },
            limit: 100,
            depth: 0,
            overrideAccess: true,
        })
        rows = result.docs
    }

    // Precompute defaults for every template type so the client form can prefill inputs
    // to match what the Live Preview already renders via mergeTemplateConfig defaults.
    const defaultsByType = Object.fromEntries(
        EMAIL_TEMPLATE_TYPES.map((type) => [
            type,
            {
                contentEn: getDefaultContentFields(type, 'en'),
                contentMs: getDefaultContentFields(type, 'ms'),
            },
        ])
    ) as Record<EmailTemplateType, { contentEn: ContentFields; contentMs: ContentFields }>

    // Automations (scheduled reminders): same page, under the template list. They run only where the
    // assistant does (the cron skips otherwise), so the section is hidden with it.
    let automationsSlot = null
    if (tenantId && isAiAgentEnabled()) {
        try {
            const user = await getCurrentUser()
            const settings = await readAutomationSettings(payload, tenantId)
            automationsSlot = <AutomationsSection initial={settings} canEdit={canManageAutomations(user, tenantId)} />
        } catch (error) {
            // the templates must still open when the automation settings can not be read
            console.error('[EmailTemplatesPage] automation settings unavailable', error instanceof Error ? error.message : error)
        }
    }

    // The assistant edits templates: render this page's rows again once per burst (open editors are kept by the client)
    return (
        <>
            <AgentRefresh kinds={['email_template']} />
            <EmailTemplatesClient
                tenantId={tenantId ?? undefined}
                initialRows={rows}
                defaultsByType={defaultsByType}
                automationsSlot={automationsSlot}
            />
        </>
    )
}

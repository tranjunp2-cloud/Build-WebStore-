'use client'

import { Mail, Edit2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { EmailTemplateType, EmailRecipient } from '@/lib/email/types'
import type { TemplateRow } from './EmailTemplatesClient'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { CRITICAL_TYPES, TEMPLATE_ICONS, toLabel, relTime } from './email-template-list-view'

/** Card view shown only on phones (<md). iPad + desktop keep the original <Table>
 *  (untouched). Mirrors the discounts card-list pattern: tap card to edit, the
 *  status switch stops propagation. Avoids the fixed-column table overflowing on
 *  narrow screens. */

interface Props {
    types: EmailTemplateType[]
    recipient: EmailRecipient
    findRow: (type: EmailTemplateType) => TemplateRow | undefined
    onSelectTemplate: (templateType: EmailTemplateType, recipient: EmailRecipient) => void
    onToggleEnabled: (templateType: EmailTemplateType, recipient: EmailRecipient, enabled: boolean) => void
}

export function EmailTemplateCardList({ types, recipient, findRow, onSelectTemplate, onToggleEnabled }: Props) {
    const { t, ti } = useI18n()
    const et = t.dashboard.settings.emailTemplates

    return (
        <div className="grid grid-cols-1 gap-3 content-start">
            {types.map((type) => {
                const row = findRow(type)
                const isEnabled = row ? row.enabled : true
                const isCritical = CRITICAL_TYPES.includes(type)
                const isCustomized = Boolean(row)
                const Icon = TEMPLATE_ICONS[type] ?? Mail

                return (
                    <div
                        key={type}
                        onClick={() => onSelectTemplate(type, recipient)}
                        className="rounded-[16px] overflow-hidden cursor-pointer active:opacity-80 transition-opacity"
                        style={{ background: 'var(--dash-surface)', border: '1px solid var(--dash-border)' }}
                    >
                        <div className="flex flex-col gap-[10px] px-[17px] pt-[15px] pb-[13px]">
                            {/* Icon + name + customized badge */}
                            <div className="flex items-start gap-3">
                                <div
                                    className={`flex items-center justify-center rounded-lg shrink-0 ${isEnabled ? 'bg-[hsl(var(--primary)/0.1)]' : 'bg-slate-500/10'}`}
                                    style={{ width: 36, height: 36 }}
                                >
                                    <Icon
                                        className={isEnabled ? 'text-[hsl(var(--primary))]' : 'text-slate-500'}
                                        style={{ width: 18, height: 18 }}
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                        <span
                                            className="text-[14px] font-semibold"
                                            style={{ color: isEnabled ? 'var(--dash-text)' : 'var(--dash-text-muted)' }}
                                        >
                                            {toLabel(type)}
                                        </span>
                                        {isCustomized && (
                                            <span className="shrink-0 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]">
                                                {et.customized}
                                            </span>
                                        )}
                                    </div>
                                    <p
                                        className="text-[12px] leading-[16px]"
                                        style={{
                                            color: 'var(--dash-text-muted)',
                                            overflow: 'hidden',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                        }}
                                    >
                                        {et.descriptions[type]}
                                    </p>
                                </div>
                                <Edit2 className="h-4 w-4 shrink-0 mt-1" style={{ color: 'var(--dash-text-muted)' }} />
                            </div>

                            {/* Status switch + badge | last edited */}
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                                <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                                    <Switch
                                        checked={isEnabled}
                                        disabled={isCritical}
                                        onCheckedChange={(val) => onToggleEnabled(type, recipient, val)}
                                    />
                                    <Badge variant={isEnabled ? 'success' : 'secondary'} dot className="rounded-full">
                                        {isEnabled ? et.enabled : et.disabled}
                                    </Badge>
                                </div>
                                <span className="text-[12px] whitespace-nowrap shrink-0" style={{ color: 'var(--dash-text-muted)' }}>
                                    {relTime(row?.updatedAt, et.neverEdited, et.editedAgo, ti)}
                                </span>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

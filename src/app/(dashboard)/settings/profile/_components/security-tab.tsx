'use client'

import { useState } from 'react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { PasswordChangeForm } from './password-change-form'

// Password & Security card (F23 GH-1614 P3) — staff-only. Owner reaches a separate
// read-only OwnerProfileView (P4) and never mounts this component. Collapsed by default:
// static summary line + outline "Change Password" button. Expanding renders the 3-field
// form; success or Cancel collapses the card back (see PasswordChangeForm onDone/onCancel).
export function SecurityTab() {
    const { t } = useI18n()
    const [collapsed, setCollapsed] = useState(true)

    return (
        <div className="bg-[hsl(var(--card))] border border-solid border-[hsl(var(--border))] rounded-2xl p-6">
            {/* Section heading — title only (no subtitle, unlike GeneralInfoTab) */}
            <div className="mb-5">
                <h2 className="text-lg font-bold text-[hsl(var(--foreground))] leading-6">
                    {t.profile.security.title}
                </h2>
            </div>

            {collapsed ? (
                <div className="flex items-center justify-between gap-4">
                    <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
                        {t.profile.security.summary}
                    </p>
                    <Button
                        type="button"
                        variant="dashSecondary"
                        onClick={() => setCollapsed(false)}
                    >
                        {t.profile.security.changePassword}
                    </Button>
                </div>
            ) : (
                <PasswordChangeForm
                    onDone={() => setCollapsed(true)}
                    onCancel={() => setCollapsed(true)}
                />
            )}
        </div>
    )
}

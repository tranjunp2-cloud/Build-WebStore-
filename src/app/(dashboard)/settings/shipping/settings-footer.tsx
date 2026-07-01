"use client"

import { useRef, useState, useEffect } from 'react'
import { CheckCircle2, RotateCcw, Save } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'

type Props = {
    isDirty: boolean
    isSaving: boolean
    lastSaveSucceeded: boolean
    onReset: () => void
    onSave: () => void
}

const CARD_CLS =
    "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 rounded-[16px] border border-white/[0.08] bg-[hsl(var(--card)/0.95)] backdrop-blur-md px-6 py-4"

export function SettingsFooter({ isDirty, isSaving, lastSaveSucceeded, onReset, onSave }: Props) {
    const { t } = useI18n()
    const s = t.dashboard.settings.shipping
    const naturalRef = useRef<HTMLDivElement>(null)
    // Start true: fixed copy shows immediately when page overflows viewport on load
    const [showFixed, setShowFixed] = useState(true)

    useEffect(() => {
        const el = naturalRef.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => setShowFixed(!entry.isIntersecting),
            { threshold: 0.1 }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const buttons = (
        <>
            <div className="min-w-0">
                {!isDirty && lastSaveSucceeded && (
                    <span className="flex items-center gap-1.5 text-[13px] text-success">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        {s.allSaved}
                    </span>
                )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 w-full sm:w-auto">
                <Button
                    type="button"
                    onClick={onReset}
                    variant="dashSecondary"
                    size="dash"
                    className="w-full sm:w-auto justify-center"
                >
                    <RotateCcw className="h-4 w-4" />
                    {s.resetToDefaults}
                </Button>
                <Button
                    type="button"
                    onClick={onSave}
                    disabled={!isDirty || isSaving}
                    variant="dashPrimary"
                    size="dash"
                    className="w-full sm:w-auto justify-center"
                >
                    <Save className="h-4 w-4" />
                    {isSaving ? s.saving : s.saveChanges}
                </Button>
            </div>
        </>
    )

    return (
        <>
            {/* Natural-position footer — always in DOM so layout is preserved */}
            <div ref={naturalRef} className={`mt-5 ${CARD_CLS}`}>
                {buttons}
            </div>

            {/* Fixed copy — visible only when natural footer is scrolled off-screen */}
            {showFixed && (
                <div className={`fixed bottom-4 sm:bottom-6 md:bottom-8 left-4 right-4 sm:left-6 sm:right-6 md:left-[250px] md:right-8 z-50 ${CARD_CLS}`}>
                    {buttons}
                </div>
            )}
        </>
    )
}

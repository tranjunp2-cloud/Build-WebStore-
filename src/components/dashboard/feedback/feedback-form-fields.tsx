'use client'

import type { RefObject } from 'react'
import { Info } from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { Alert } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FeedbackTypeControl } from './feedback-type-control'
import { ScreenshotField } from './screenshot-field'
import type { useFeedbackForm } from './use-feedback-form'
import { FeedbackAreaSelect } from './feedback-area-select'
import { MAX_DETAILS_LENGTH, type FeedbackType } from './types'

const ERROR_BORDER = 'border-[hsl(var(--destructive))]'
// Figma "sending": every control muted + dimmed while the request runs.
const LOCKED = 'disabled:bg-[hsl(var(--muted))] disabled:opacity-60'
const LABEL = 'text-[13px] font-semibold leading-5 text-[var(--dash-text)]'
const HELPER = 'text-[11px] leading-4 text-[var(--dash-text-muted)]'
const ERROR_TEXT = 'text-xs leading-4 text-[hsl(var(--destructive))]'
const REQUIRED = <span aria-hidden className="text-[hsl(var(--destructive))]">*</span>

type Props = {
    form: ReturnType<typeof useFeedbackForm>
    submitting: boolean
    types: readonly FeedbackType[]
    ids: { type: string; area: string; details: string }
    areaRef: RefObject<HTMLButtonElement | null>
    detailsRef: RefObject<HTMLTextAreaElement | null>
}

/** Scrollable field list of the feedback form (type, area, details, reference, screenshots). */
export function FeedbackFormFields({ form, submitting, types, ids, areaRef, detailsRef }: Props) {
    const { t } = useI18n()
    const f = t.dashboard.feedback

    return (
        <>
        <div className="flex flex-col gap-1.5">
            <span id={ids.type} className={LABEL}>{f.fields.type} {REQUIRED}</span>
            <FeedbackTypeControl
                value={form.type}
                onChange={form.setType}
                types={types}
                disabled={submitting}
                labelledBy={ids.type}
            />
            {form.type === 'mismatch' && (
                <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-solid border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.1)] px-3 py-2.5 text-xs leading-4 text-[var(--dash-text)]">
                    <Info aria-hidden className="mt-px h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                    {f.mismatchNotice}
                </div>
            )}
        </div>

        <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.area} className={LABEL}>{f.fields.area} {REQUIRED}</Label>
            <FeedbackAreaSelect
                ref={areaRef}
                id={ids.area}
                value={form.areas}
                onChange={form.setAreas}
                disabled={submitting}
                describedBy={form.errors.area ? `${ids.area}-error` : undefined}
                className={cn(LOCKED, form.errors.area && ERROR_BORDER)}
            />
            {form.errors.area && (
                <p id={`${ids.area}-error`} role="alert" className={ERROR_TEXT}>{f.fields.areaError}</p>
            )}
        </div>

        <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.details} className={LABEL}>{f.fields.details} {REQUIRED}</Label>
            <div className="relative">
                <Textarea
                    ref={detailsRef}
                    id={ids.details}
                    value={form.details}
                    onChange={(e) => form.setDetails(e.target.value)}
                    placeholder={form.type === 'mismatch' ? f.fields.detailsPlaceholderMismatch : f.fields.detailsPlaceholder}
                    disabled={submitting}
                    maxLength={MAX_DETAILS_LENGTH}
                    aria-required
                    aria-invalid={!!form.errors.details}
                    aria-describedby={`${ids.details}-help`}
                    className={cn('min-h-[96px] pb-6', LOCKED, form.errors.details && ERROR_BORDER)}
                />
                <span aria-hidden className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-[var(--dash-text-muted)]">
                    {form.details.length}/{MAX_DETAILS_LENGTH}
                </span>
            </div>
            {form.errors.details && (
                <p role="alert" className={ERROR_TEXT}>
                    {form.errors.details === 'short' ? f.fields.detailsShortError : f.fields.detailsError}
                </p>
            )}
            <p id={`${ids.details}-help`} className={HELPER}>{f.fields.detailsHelper}</p>
        </div>

        <div className="flex flex-col gap-1.5">
            <span className={LABEL}>
                {f.fields.screenshots}{' '}
                <span className="text-[11px] font-normal text-[var(--dash-text-muted)]">{f.fields.optional}</span>
            </span>
            <ScreenshotField
                items={form.screenshots.items}
                onAdd={form.screenshots.add}
                onRemove={form.screenshots.remove}
                overflow={form.screenshots.overflow}
                disabled={submitting}
            />
        </div>
        </>
    )
}

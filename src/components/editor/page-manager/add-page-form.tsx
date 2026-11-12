import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { PageData } from '@/store/editorStore'
import { validateNewPageTitle } from './page-manager-helpers'

export interface AddPageLabels {
    addNewPage: string
    pageNameLabel: string
    placeholder: string
    urlPreview: string
    cancel: string
    createPage: string
    duplicatePage: string
    invalidPageName: string
    reservedPage: string
}

interface AddPageFormProps {
    labels: AddPageLabels
    pages: PageData[]
    locale: string
    isSubmitting: boolean
    /** Resolves true when the page was created, so the form can close. */
    onCreate: (title: string) => Promise<boolean>
    /** Called after the form opens so the host can scroll it into view. */
    onOpen?: () => void
}

/** Dashed "Add new page" button that expands into an inline form (Enter creates, Esc cancels). */
export function AddPageForm({ labels, pages, locale, isSubmitting, onCreate, onOpen }: AddPageFormProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [title, setTitle] = useState('')
    const validation = validateNewPageTitle(title, pages, locale)
    const canSubmit = !validation.error && !isSubmitting
    const errorText = validation.error === 'duplicate' ? labels.duplicatePage
        : validation.error === 'invalid' ? labels.invalidPageName
        : validation.error === 'reserved' ? labels.reservedPage : null

    const close = () => { setIsOpen(false); setTitle('') }
    const submit = async () => {
        if (!canSubmit) return
        if (await onCreate(title.trim())) close()
    }

    if (!isOpen) {
        return (
            <button
                type="button"
                onClick={() => { setIsOpen(true); onOpen?.() }}
                className="flex h-[38px] w-full shrink-0 items-center justify-center gap-2 rounded-[10px] border border-dashed border-slate-300 text-[13px] font-medium text-[var(--editor-text)] transition-colors hover:border-teal-600 hover:bg-teal-50 hover:text-teal-800 dark:border-[var(--editor-border)] dark:hover:border-[hsl(var(--primary)/0.55)] dark:hover:bg-[hsl(var(--primary)/0.05)] dark:hover:text-[hsl(var(--primary))]"
            >
                <Plus className="h-[15px] w-[15px]" />
                {labels.addNewPage}
            </button>
        )
    }

    return (
        <form
            onSubmit={e => { e.preventDefault(); void submit() }}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }}
            className="flex shrink-0 flex-col gap-2 rounded-xl border border-teal-600/40 bg-slate-50 p-3 dark:border-[hsl(var(--primary)/0.35)] dark:bg-[var(--editor-surface-elevated)]"
        >
            <label htmlFor="page-manager-new-page-name" className="text-[11px] font-semibold tracking-[0.06em] text-[var(--editor-text-muted)]">
                {labels.pageNameLabel}
            </label>
            <Input
                id="page-manager-new-page-name"
                autoFocus
                variant="editor"
                autoComplete="off"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={labels.placeholder}
            />
            <p className="text-xs text-[var(--editor-text-muted)]">
                {labels.urlPreview} <span className="text-[var(--editor-text)]">/{validation.slug || 'new-page'}</span>
            </p>
            {errorText ? <p role="alert" className="text-xs text-[hsl(var(--destructive))]">{errorText}</p> : null}
            <div className="mt-0.5 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={close}
                    className="flex h-[34px] items-center justify-center rounded-lg bg-[var(--editor-overlay-bg)] text-[13px] font-medium text-[var(--editor-text)] transition-colors hover:bg-[var(--editor-overlay-hover)]"
                >
                    {labels.cancel}
                </button>
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex h-[34px] items-center justify-center gap-2 rounded-lg bg-[linear-gradient(90deg,hsl(var(--info)),hsl(var(--primary)))] text-[13px] font-semibold text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:bg-[var(--editor-overlay-bg)] disabled:bg-none disabled:text-[var(--editor-text-subtle)] disabled:hover:filter-none"
                >
                    {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {labels.createPage}
                </button>
            </div>
        </form>
    )
}

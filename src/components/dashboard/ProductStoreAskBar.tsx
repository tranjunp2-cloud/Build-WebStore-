'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ImagePlus, Plus, ShieldCheck } from 'lucide-react'
import { AgentMascot, boxOf } from '@ech/agent-ui'
import { useI18n } from '@/i18n'

/** Hand a request to the dashboard copilot (DashboardAgentDock listens for `ech-agent:open`): the mascot flies from `from` and opens the chat. */
export function askProductStoreAgent(prompt: string | undefined, from?: Element | null) {
    window.dispatchEvent(
        new CustomEvent('ech-agent:open', { detail: { ...(prompt ? { prompt } : {}), ...(from ? { from: boxOf(from) } : {}) } }),
    )
}

/**
 * Product Store's way into the AI copilot. It is not a second chat: on Enter
 * the mascot picks the request up and carries it into its own chat, which
 * drafts new products for the merchant to review and approve before anything
 * goes on sale.
 */
export function ProductStoreAskBar() {
    const { t } = useI18n()
    const l = t.dashboard.products.list
    const form = useRef<HTMLFormElement>(null)
    const input = useRef<HTMLInputElement>(null)
    const [value, setValue] = useState('')
    /** the request on its way to the mascot */
    const [handing, setHanding] = useState<string | null>(null)
    const [picked, setPicked] = useState(false)

    useEffect(() => {
        if (handing === null) return
        const onPicked = () => setPicked(true)
        window.addEventListener('ech-agent:picked', onPicked)
        // no dock to pick it up → never leave text stuck
        const fallback = window.setTimeout(onPicked, 2500)
        return () => {
            window.removeEventListener('ech-agent:picked', onPicked)
            window.clearTimeout(fallback)
        }
    }, [handing])
    useEffect(() => {
        if (!picked) return
        const done = window.setTimeout(() => {
            setHanding(null)
            setPicked(false)
        }, 260)
        return () => window.clearTimeout(done)
    }, [picked])

    const submit = () => {
        const request = value.trim()
        if (!request || handing !== null) return
        setHanding(request)
        setValue('')
        askProductStoreAgent(request, form.current)
    }
    const chip =
        'inline-flex h-7 items-center gap-1.5 rounded-full [border:1px_solid_hsl(var(--border))] bg-transparent px-2.5 text-[12px] text-foreground/85 transition-colors hover:[border-color:hsl(var(--primary)/0.6)] hover:bg-[hsl(var(--primary)/0.06)] hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--primary)/0.18)] [&_svg]:size-[13px] [&_svg]:text-muted-foreground'

    return (
        <section aria-label={l.askAiSend}>
            <form
                ref={form}
                onSubmit={(e) => {
                    e.preventDefault()
                    submit()
                }}
                className="relative flex h-12 items-center gap-2.5 overflow-hidden rounded-xl [border:1px_solid_hsl(var(--input-border))] bg-[hsl(var(--card))] pl-3 pr-1.5 transition-[border-color,box-shadow] hover:[border-color:hsl(var(--primary)/0.5)] focus-within:![border-color:hsl(var(--primary))] focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]"
            >
                <span className="grid size-7 shrink-0 place-items-center">
                    <AgentMascot size={26} />
                </span>
                <input
                    ref={input}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    aria-label={l.askAiLabel}
                    autoComplete="off"
                    placeholder={handing === null ? l.askAiPlaceholder : ''}
                    className="h-full min-w-0 flex-1 border-0 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground max-md:placeholder:text-transparent"
                />
                {/* the long example does not fit a phone; the short one shows there instead */}
                {handing === null && value === '' && (
                    <span aria-hidden="true" className="pointer-events-none absolute left-[50px] hidden text-[14px] text-muted-foreground max-md:block">
                        {l.askAiPlaceholderShort}
                    </span>
                )}
                {handing !== null && (
                    <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-y-0 left-[50px] right-14 flex origin-left items-center truncate text-[14px] text-foreground transition-[transform,opacity] duration-200 ease-in motion-reduce:transition-none ${
                            picked ? '-translate-x-6 scale-50 opacity-0' : ''
                        }`}
                    >
                        {handing}
                    </span>
                )}
                <kbd className="hidden h-[22px] shrink-0 items-center rounded-md [border:1px_solid_hsl(var(--border))] px-1.5 font-sans text-[11px] text-muted-foreground md:inline-flex">
                    Enter ↵
                </kbd>
                <button
                    type="submit"
                    disabled={!value.trim() || handing !== null}
                    aria-label={l.askAiSend}
                    className="grid size-9 shrink-0 place-items-center rounded-[9px] border-0 bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] !text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-35 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--primary)/0.3)]"
                >
                    <ArrowUp className="size-4" />
                </button>
            </form>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-muted-foreground">{l.askAiTry}</span>
                <button type="button" className={chip} onClick={(e) => askProductStoreAgent(l.askAiFromPhotosPrompt, e.currentTarget)}>
                    <ImagePlus />
                    {l.askAiFromPhotos}
                </button>
                <button
                    type="button"
                    className={chip}
                    onClick={() => {
                        setValue(l.askAiExamplePrompt)
                        input.current?.focus()
                    }}
                >
                    <Plus />
                    {l.askAiExample}
                </button>
                <span className="inline-flex basis-full items-center gap-1.5 text-[12px] text-muted-foreground md:ml-auto md:basis-auto">
                    <ShieldCheck className="size-[13px] shrink-0" />
                    {l.askAiDraftNote}
                </span>
            </div>
        </section>
    )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { BlockImageEditor } from './BlockImageEditor'
import { HERO_TRANSITIONS, type HeroTransition, type HeroConfig, type HeroSlide } from '@/blocks/hero/config'

const control = 'rounded border border-white/15 bg-white/5 p-2 text-xs text-gray-200 disabled:opacity-30'

export default function HeroSlidesSettings({ block, blockIndex, onBlockUpdate }: {
    block: HeroConfig
    blockIndex: number
    onBlockUpdate: (index: number, changes: Record<string, unknown>) => void
}) {
    const slides: HeroSlide[] = block.slides?.length ? block.slides.map(slide => ({ ...slide, ctaButtons: slide.ctaButtons || [] })) :
        (block.images?.length ? block.images : [block.image]).map(image => ({
            image, headline: block.headline || '', subheadline: block.subheadline, ctaButtons: block.ctaButtons || [],
        }))
    const [selected, setSelected] = useState(0)
    const [editingSlide, setEditingSlide] = useState(false)
    const [uploading, setUploading] = useState(false)
    const dragIndex = useRef<number | null>(null)
    const active = Math.min(selected, slides.length - 1)
    const slide = slides[active]
    const latest = useRef(slides)
    latest.current = slides
    useEffect(() => {
        const frame = document.querySelector<HTMLIFrameElement>('iframe[src*="/preview/"]')
        const send = (slideIndex: number | null) => frame?.contentWindow?.postMessage({
            type: 'HERO_SLIDE_PREVIEW', blockIndex, slideIndex,
        }, window.location.origin)
        const sync = () => send(editingSlide ? active : null)
        const receive = (event: MessageEvent) => {
            if (event.source !== frame?.contentWindow || event.origin !== window.location.origin) return
            if (event.data?.type === 'HERO_SLIDE_READY' && event.data.blockIndex === blockIndex) { sync(); return }
            if (event.data?.type !== 'HERO_SLIDE_SELECTED' || event.data.blockIndex !== blockIndex) return
            const index = event.data.slideIndex
            if (!uploading && Number.isInteger(index) && index >= 0 && index < latest.current.length) setSelected(index)
        }
        sync()
        frame?.addEventListener('load', sync)
        window.addEventListener('message', receive)
        return () => {
            send(null)
            frame?.removeEventListener('load', sync)
            window.removeEventListener('message', receive)
        }
    }, [active, blockIndex, block.slides, uploading, editingSlide])
    const save = (next: HeroSlide[], index = active) => {
        setEditingSlide(true)
        setSelected(index)
        onBlockUpdate(blockIndex, { slides: next })
    }
    const patch = (changes: Partial<HeroSlide>) => save(latest.current.map((item, i) => i === active ? { ...item, ...changes } : item))
    const move = (from: number, to: number) => {
        if (uploading || from === to || to < 0 || to >= slides.length) return
        const next = [...slides]
        const [item] = next.splice(from, 1)
        next.splice(to, 0, item)
        save(next, to)
    }
    const settings = block.sourceLayout ?? { size: 'hero' as const, autoplay: true, interval: 5000, sourceComponentId: '' }
    const setting = (changes: Partial<NonNullable<HeroConfig['sourceLayout']>>) => onBlockUpdate(blockIndex, { sourceLayout: { ...settings, ...changes } })
    return <section className="space-y-3 border-t border-white/10 pt-4" aria-label="Hero slides">
        <div className="flex items-center justify-between"><h3 className="text-xs font-medium uppercase text-gray-400">Slides ({slides.length})</h3></div>
        <div className="space-y-2">
            {slides.map((item, i) => <div key={i}>
                <div draggable={!uploading}
                onDragStart={() => { dragIndex.current = i }} onDragEnd={() => { dragIndex.current = null }}
                onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragIndex.current !== null) move(dragIndex.current, i); dragIndex.current = null }}
                className={`flex items-center gap-2 rounded-lg border p-2 ${editingSlide && active === i ? 'border-teal-500 bg-teal-500/10' : 'border-white/10 bg-white/5'}`}>
                <GripVertical size={14} className="shrink-0 text-gray-500" />
                <button type="button" disabled={uploading}
                    aria-expanded={editingSlide && active === i}
                    aria-controls={`hero-${blockIndex}-slide-${i}-edit`}
                    onClick={() => { setSelected(i); setEditingSlide(!(editingSlide && active === i)) }}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded p-1 text-left text-xs text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-accent)]">
                    <span className="h-8 w-12 shrink-0 rounded bg-gray-700 bg-cover bg-center" style={{ backgroundImage: item.image?.url ? `url(${JSON.stringify(item.image.url)})` : undefined }} />
                    <span className="flex-1">Slide {i + 1}</span>
                    {editingSlide && active === i ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                </button>
                </div>
                {editingSlide && active === i && (
        <fieldset id={`hero-${blockIndex}-slide-${i}-edit`} onFocusCapture={() => setEditingSlide(true)} disabled={uploading} className="mt-2 space-y-3 rounded-lg border border-white/10 p-3" key={active}>
            <div className="flex items-center justify-between text-xs text-gray-300"><strong>Slide {active + 1}</strong><div className="flex gap-2">
                <button type="button" className={control} aria-label="Duplicate slide" onClick={() => { const next = [...slides]; next.splice(active + 1, 0, structuredClone(slide)); save(next, active + 1) }}><Copy size={14} /></button>
                <button type="button" className={control} aria-label="Delete slide" disabled={slides.length <= 1} onClick={() => save(slides.filter((_, i) => i !== active), Math.max(0, active - 1))}><Trash2 size={14} /></button>
            </div></div>
            <BlockImageEditor imageUrl={slide.image?.url || ''} altText={slide.image?.alt || ''} onUploadingChange={setUploading}
                onImageChange={(_id, url) => patch({ image: { url, alt: latest.current[active]?.image?.alt || '' } })}
                onAltTextChange={alt => patch({ image: { ...slide.image, url: slide.image?.url || '', alt } })} />
            <label className="block space-y-1 text-xs text-gray-400"><span>Headline</span><Input variant="editor" value={slide.headline} onChange={event => patch({ headline: event.target.value })} /></label>
            <label className="block space-y-1 text-xs text-gray-400"><span>Description</span><Textarea value={slide.subheadline || ''} onChange={event => patch({ subheadline: event.target.value })} /></label>
            <section aria-label="CTA buttons" className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <h4 className="text-xs font-medium uppercase tracking-wide text-gray-400">CTA buttons</h4>
                {(slide.ctaButtons || []).map((cta, i) => <div key={i} className="space-y-2 rounded border border-white/10 p-2">
                    <div className="flex justify-between text-xs text-gray-400"><span>Button {i + 1}</span><button type="button" aria-label={`Remove slide button ${i + 1}`} onClick={() => patch({ ctaButtons: slide.ctaButtons.filter((_, n) => n !== i) })}><Trash2 size={14} /></button></div>
                    <Input variant="editor" aria-label={`Button ${i + 1} label`} placeholder="Label" value={cta.label} onChange={event => patch({ ctaButtons: slide.ctaButtons.map((item, n) => n === i ? { ...item, label: event.target.value } : item) })} />
                    <Input variant="editor" aria-label={`Button ${i + 1} URL`} placeholder="/products" value={cta.url} onChange={event => patch({ ctaButtons: slide.ctaButtons.map((item, n) => n === i ? { ...item, url: event.target.value } : item) })} />
                </div>)}
                {slide.ctaButtons.length < 2 && <button type="button" className={control} onClick={() => patch({ ctaButtons: [...slide.ctaButtons, { label: 'Learn more', url: '#', style: 'primary' }] })}>Add button</button>}
            </section>
        </fieldset>
                )}
            </div>)}
        </div>
        <button type="button" disabled={uploading} className={`${control} flex w-full items-center justify-center gap-2`} onClick={() => save([...slides, { headline: '', subheadline: '', ctaButtons: [] }], slides.length)}><Plus size={14} />Add slide</button>

        <div className="space-y-3 border-t border-white/10 pt-3 text-xs text-gray-300">
            {([
                { key: 'autoplay', label: 'Autoplay', description: 'Automatically advance slides on the website.' },
                { key: 'showArrows', label: 'Next / Previous', description: 'Show arrow buttons to change slides.' },
                { key: 'showDots', label: 'Slide dots', description: 'Show slide indicators below the banner.' },
            ] as const).map(({ key, label, description }) => <label key={key} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-1">
                <span className="space-y-1"><span className="block text-gray-200">{label}</span><span className="block text-[11px] leading-relaxed text-gray-500">{description}</span></span>
                <Switch aria-label={label} checked={settings[key] ?? true}
                    onCheckedChange={checked => setting({ [key]: checked })} />
            </label>)}
            <div className="space-y-2">
                <label htmlFor={`hero-${blockIndex}-interval`} className="block text-xs text-gray-400">Interval</label>
                <div className="relative">
                    <Input id={`hero-${blockIndex}-interval`} aria-label="Slide interval seconds" variant="editor"
                        type="number" min={1} max={30} step="any" disabled={!settings.autoplay}
                        key={settings.interval} defaultValue={settings.interval / 1000}
                        className="h-10 pr-20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        onBlur={event => {
                            const value = Number(event.target.value)
                            if (event.target.value.trim() && Number.isFinite(value) && value >= 1 && value <= 30) {
                                if (value * 1000 !== settings.interval) setting({ interval: value * 1000 })
                            } else event.target.value = String(settings.interval / 1000)
                        }}
                        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-500">seconds</span>
                </div>
            </div>
            <div className="space-y-2">
                <label htmlFor={`hero-${blockIndex}-transition`} className="block text-xs text-gray-400">Transition</label>
                <Select value={settings.animation ?? 'fade'} onValueChange={value => {
                    if (HERO_TRANSITIONS.includes(value as HeroTransition)) setting({ animation: value as HeroTransition })
                }}>
                    <SelectTrigger id={`hero-${blockIndex}-transition`} aria-label="Slide transition"
                        className="h-10 border-[var(--editor-border)] bg-[var(--editor-surface)] text-[var(--editor-text)]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="fade">Fade</SelectItem>
                        <SelectItem value="slide-horizontal">Slide horizontal</SelectItem>
                        <SelectItem value="slide-vertical">Slide vertical</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    </section>
}

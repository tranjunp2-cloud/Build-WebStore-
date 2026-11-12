'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Package, ArrowRight } from 'lucide-react'
import { useI18n } from '@/i18n'
import { normalizeOrderNumber } from '@/lib/orders/normalize-order-number'

interface NavOrderSearchProps {
    slug: string
    className?: string
    /** `dropdown` (default) = desktop popup; `inline` = form rendered in place (mobile drawer). */
    variant?: 'dropdown' | 'inline'
    /** Called after a successful submit (e.g. to close the mobile drawer). */
    onNavigate?: () => void
}

export function NavOrderSearch({ slug, className = '', variant = 'dropdown', onNavigate }: NavOrderSearchProps) {
    const { t } = useI18n()
    const ol = t.storefront.orderLookup
    const router = useRouter()
    const pathname = usePathname()
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState('')
    const [error, setError] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (open) inputRef.current?.focus()
    }, [open])

    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('mousedown', handler)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', handler)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = normalizeOrderNumber(value)
        if (!trimmed) { setError(ol.required); return }
        const shopBase = pathname.startsWith('/sites/') ? `/sites/${slug}` : ''
        router.push(`${shopBase}/orders/${encodeURIComponent(trimmed)}`)
        setOpen(false)
        setValue('')
        setError('')
        onNavigate?.()
    }

    if (variant === 'inline') {
        return (
            <form
                onSubmit={handleSubmit}
                className={`px-4 py-3 flex flex-col gap-2 ${className}`.trim()}
                data-testid="nav-order-search-inline"
            >
                <label
                    htmlFor="nav-order-search-inline-input"
                    className="flex items-center gap-1.5 text-sm font-medium opacity-80"
                >
                    <Package size={15} strokeWidth={1.8} />
                    {ol.navLabel}
                </label>
                <div className="flex gap-2">
                    <input
                        id="nav-order-search-inline-input"
                        type="text"
                        value={value}
                        onChange={e => { setValue(e.target.value); setError('') }}
                        placeholder={ol.placeholder}
                        autoComplete="off"
                        className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm bg-transparent outline-none"
                        style={{
                            color: 'inherit',
                            border: `1px solid ${error
                                ? 'var(--brand-primary)'
                                : 'color-mix(in srgb, currentColor 25%, transparent)'}`,
                        }}
                    />
                    <button
                        type="submit"
                        aria-label={ol.submit}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-3 text-sm font-bold"
                        style={{ background: 'var(--brand-primary)', color: '#fff' }}
                    >
                        <ArrowRight size={16} />
                    </button>
                </div>
                {error && (
                    <p role="alert" className="text-xs" style={{ color: 'var(--brand-primary)' }}>
                        {error}
                    </p>
                )}
            </form>
        )
    }

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger — styled like a nav link (Option B) */}
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium opacity-60 hover:opacity-100 transition-all duration-200 rounded-lg hover:bg-white/[0.04]"
                style={{ color: 'inherit' }}
                aria-expanded={open}
                aria-haspopup="true"
            >
                <Package size={15} strokeWidth={1.8} />
                {ol.navLabel}
            </button>

            {/* Popup dropdown */}
            {open && (
                <div
                    className="absolute right-0 top-full mt-2 w-72 rounded-2xl p-5 z-[200]"
                    style={{
                        background: 'color-mix(in srgb, var(--surface, #111) 96%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--text, #fafafa) 12%, transparent)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.10)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        color: 'var(--text, #fafafa)',
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: 'rgba(var(--brand-primary-rgb, 14 117 86), 0.15)',
                            display: 'grid', placeItems: 'center',
                            color: 'var(--brand-primary)',
                        }}>
                            <Package size={16} strokeWidth={1.8} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'inherit' }}>
                            {ol.title}
                        </span>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit}>
                        <label style={{
                            display: 'block', fontSize: 11, fontWeight: 600,
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                            opacity: 0.5, marginBottom: 6,
                        }}>
                            {ol.label}
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={value}
                            onChange={e => { setValue(e.target.value); setError('') }}
                            placeholder={ol.placeholder}
                            autoComplete="off"
                            style={{
                                display: 'block', width: '100%', boxSizing: 'border-box',
                                padding: '9px 12px', fontSize: 14,
                                fontFamily: 'var(--font-body, system-ui)',
                                background: 'color-mix(in srgb, var(--text, #fafafa) 6%, transparent)',
                                border: `1px solid ${error
                                    ? 'var(--brand-primary)'
                                    : 'color-mix(in srgb, var(--text, #fafafa) 14%, transparent)'}`,
                                borderRadius: 10, color: 'inherit', outline: 'none',
                                marginBottom: error ? 4 : 12,
                                transition: 'border-color 150ms',
                            }}
                        />
                        {error && (
                            <p style={{ fontSize: 11, color: 'var(--brand-primary)', marginBottom: 10 }}>
                                {error}
                            </p>
                        )}
                        <button
                            type="submit"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: 6, width: '100%', padding: '10px 16px',
                                fontSize: 13, fontWeight: 700,
                                color: '#fff',
                                background: 'linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb, 14 117 86), 0.75))',
                                border: 'none', borderRadius: 10, cursor: 'pointer',
                                transition: 'opacity 150ms',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                            {ol.submit}
                            <ArrowRight size={14} />
                        </button>
                    </form>
                </div>
            )}
        </div>
    )
}

'use client'

import { useState } from 'react'
import { Sparkles, ArrowRight, Building2, ShoppingBag, Briefcase, Globe, ChevronRight } from 'lucide-react'
import { useBuilderStore, type BusinessInfo } from '@/store/builderStore'
import { cn } from '@/lib/utils'

const INDUSTRY_OPTIONS = [
    { value: 'restaurant', label: 'Restaurant / Café / F&B', icon: '🍽️' },
    { value: 'ecommerce', label: 'Shop / Fashion / E-commerce', icon: '🛍️' },
    { value: 'beauty', label: 'Beauty / Spa / Wellness', icon: '💄' },
    { value: 'tech', label: 'Tech / IT / SaaS', icon: '💻' },
    { value: 'health', label: 'Health / Dental / Clinic', icon: '🏥' },
    { value: 'education', label: 'Education / Training', icon: '📚' },
    { value: 'realestate', label: 'Real Estate / Property', icon: '🏠' },
    { value: 'fitness', label: 'Gym / Fitness / Yoga', icon: '💪' },
    { value: 'creative', label: 'Portfolio / Agency', icon: '🎨' },
    { value: 'other', label: 'Other', icon: '🏢' },
]

const STYLE_OPTIONS = [
    { value: 'modern', label: 'Modern', sub: 'Clean & Minimal' },
    { value: 'classic', label: 'Classic', sub: 'Timeless & Elegant' },
    { value: 'bold', label: 'Bold', sub: 'Vibrant & Energetic' },
    { value: 'minimal', label: 'Minimal', sub: 'Pure & Simple' },
]

const LANGUAGE_OPTIONS = [
    { value: 'auto', label: 'Auto', flag: '🌐' },
    { value: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
    { value: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
    { value: 'en', label: 'English', flag: '🇬🇧' },
]

interface BusinessInfoFormProps {
    onSubmit?: (info: BusinessInfo) => void
    isGenerating?: boolean
}

export default function BusinessInfoForm({ onSubmit, isGenerating }: BusinessInfoFormProps) {
    const setBusinessInfo = useBuilderStore(s => s.setBusinessInfo)

    const [form, setForm] = useState({
        businessName: '',
        shortDescription: '',
        industry: '',
        products: '',
        targetAudience: '',
        style: 'modern',
        language: 'auto',
    })
    const [errors, setErrors] = useState<Record<string, string>>({})

    const validate = (): boolean => {
        const e: Record<string, string> = {}
        if (!form.businessName.trim()) e.businessName = 'Please enter your business name'
        if (!form.industry) e.industry = 'Please select an industry'
        if (!form.products.trim()) e.products = 'Please describe your products / services'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!validate() || isGenerating) return
        if (onSubmit) {
            onSubmit(form as BusinessInfo)
        } else {
            setBusinessInfo(form as BusinessInfo)
        }
    }

    return (
        <div className="relative flex min-h-screen overflow-hidden bg-[#080E1E]">
            {/* Ambient Background Orbs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-64 -top-64 h-[600px] w-[600px] rounded-full bg-purple-600/10 blur-[120px]" />
                <div className="absolute -right-64 top-1/3 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
                <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-indigo-600/8 blur-[120px]" />
            </div>

            {/* ─── Left side — Form ─────────────────────────────── */}
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-12">
                <div className="w-full max-w-[520px] space-y-7">

                    {/* Logo + Title */}
                    <div className="space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25">
                                <Sparkles className="h-5 w-5 text-white" />
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight text-white">
                                    PrimeWeb <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">AI Builder</span>
                                </h1>
                                <p className="text-xs text-white/30">Step 1 of 3 — Business Information</p>
                            </div>
                        </div>

                        {/* Step indicator */}
                        <div className="flex items-center gap-2">
                            <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                                <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-700" />
                            </div>
                            <span className="text-[10px] font-medium text-white/30">33%</span>
                        </div>

                        <p className="text-sm leading-[1.7] text-white/50">
                            Tell us about your business and we'll craft a professional website in minutes using AI.
                        </p>
                    </div>

                    {/* ─── Form Card ─────────────────────────────────── */}
                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Business Name */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">
                                <Building2 className="h-3 w-3" />
                                Business Name <span className="text-red-400/70">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={form.businessName}
                                    onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                                    placeholder="e.g. The Coffee House, Beauty Spa Hana..."
                                    className={cn(
                                        'w-full rounded-2xl border bg-white/[0.04] px-4 py-3.5 text-sm text-white backdrop-blur-sm placeholder:text-white/20 outline-none transition-all duration-200',
                                        errors.businessName
                                            ? 'border-red-500/40 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10'
                                            : 'border-white/[0.08] focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10'
                                    )}
                                />
                            </div>
                            {errors.businessName && (
                                <p className="flex items-center gap-1 text-xs text-red-400/80">
                                    <span className="h-1 w-1 rounded-full bg-red-400" />
                                    {errors.businessName}
                                </p>
                            )}
                        </div>

                        {/* Short Description */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">
                                <Briefcase className="h-3 w-3" />
                                Short Description
                            </label>
                            <textarea
                                value={form.shortDescription}
                                onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))}
                                placeholder="e.g. A cozy handmade bakery operating since 2020..."
                                rows={2}
                                className="w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-sm text-white backdrop-blur-sm placeholder:text-white/20 outline-none transition-all duration-200 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                            />
                        </div>

                        {/* Industry */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">
                                <Briefcase className="h-3 w-3" />
                                Industry <span className="text-red-400/70">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {INDUSTRY_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            setForm(f => ({ ...f, industry: opt.value }))
                                            setErrors(e => ({ ...e, industry: '' }))
                                        }}
                                        className={cn(
                                            'group relative flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition-all duration-200 hover:scale-[1.02]',
                                            form.industry === opt.value
                                                ? 'border-blue-500/40 bg-blue-500/10 text-blue-300 shadow-lg shadow-blue-500/10'
                                                : 'border-white/[0.06] bg-white/[0.025] text-white/40 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white/70'
                                        )}
                                    >
                                        <span className="text-base leading-none">{opt.icon}</span>
                                        <span className="truncate">{opt.label}</span>
                                        {form.industry === opt.value && (
                                            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                                        )}
                                    </button>
                                ))}
                            </div>
                            {errors.industry && (
                                <p className="flex items-center gap-1 text-xs text-red-400/80">
                                    <span className="h-1 w-1 rounded-full bg-red-400" />
                                    {errors.industry}
                                </p>
                            )}
                        </div>

                        {/* Products / Services */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">
                                <ShoppingBag className="h-3 w-3" />
                                Products / Services <span className="text-red-400/70">*</span>
                            </label>
                            <textarea
                                value={form.products}
                                onChange={e => setForm(f => ({ ...f, products: e.target.value }))}
                                placeholder="e.g. Specialty coffee, bubble tea, handmade pastries, co-working space..."
                                rows={3}
                                className={cn(
                                    'w-full resize-none rounded-2xl border bg-white/[0.04] px-4 py-3.5 text-sm text-white backdrop-blur-sm placeholder:text-white/20 outline-none transition-all duration-200',
                                    errors.products
                                        ? 'border-red-500/40 focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10'
                                        : 'border-white/[0.08] focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10'
                                )}
                            />
                            {errors.products && (
                                <p className="flex items-center gap-1 text-xs text-red-400/80">
                                    <span className="h-1 w-1 rounded-full bg-red-400" />
                                    {errors.products}
                                </p>
                            )}
                        </div>

                        {/* Target Audience */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-white/40">
                                Target Audience <span className="ml-1 text-[10px] font-normal normal-case text-white/20">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={form.targetAudience}
                                onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))}
                                placeholder="e.g. Young adults 18–35, office workers, families..."
                                className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-sm text-white backdrop-blur-sm placeholder:text-white/20 outline-none transition-all duration-200 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                            />
                        </div>

                        {/* Style & Language row */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Style */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-white/40">Style</label>
                                <div className="space-y-1.5">
                                    {STYLE_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, style: opt.value }))}
                                            className={cn(
                                                'group flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200',
                                                form.style === opt.value
                                                    ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                                                    : 'border-white/[0.06] bg-white/[0.025] text-white/40 hover:border-white/[0.12] hover:text-white/70'
                                            )}
                                        >
                                            <span>{opt.label}</span>
                                            {form.style === opt.value && <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Language */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-white/40">
                                    <Globe className="h-3 w-3" />
                                    Language
                                </label>
                                <div className="space-y-1.5">
                                    {LANGUAGE_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, language: opt.value }))}
                                            className={cn(
                                                'group flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200',
                                                form.language === opt.value
                                                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                                                    : 'border-white/[0.06] bg-white/[0.025] text-white/40 hover:border-white/[0.12] hover:text-white/70'
                                            )}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className="text-sm leading-none">{opt.flag}</span>
                                                {opt.label}
                                            </span>
                                            {form.language === opt.value && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isGenerating}
                                className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-sm font-semibold text-white shadow-xl shadow-blue-600/25 transition-all duration-300 hover:shadow-blue-600/40 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:brightness-100"
                            >
                                {/* Shine overlay */}
                                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                                <span className="relative flex items-center gap-2.5">
                                    {isGenerating ? (
                                        <>
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                            Generating Website...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4" />
                                            Generate My Website
                                            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                                        </>
                                    )}
                                </span>
                            </button>

                            <p className="mt-3 text-center text-[11px] text-white/20">
                                ✨ AI will craft your professional website in under 60 seconds
                            </p>
                        </div>
                    </form>
                </div>
            </div>

            {/* ─── Right side — Visual Panel ─────────────────────── */}
            <div className="relative hidden flex-1 items-center justify-center border-l border-white/[0.04] bg-gradient-to-br from-[#0B1220] via-[#0E1530] to-[#13103A] lg:flex">
                {/* Decorative mesh gradient */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-1/4 top-1/4 h-80 w-80 rounded-full bg-blue-500/8 blur-[80px]" />
                    <div className="absolute bottom-1/4 right-1/4 h-60 w-60 rounded-full bg-purple-500/10 blur-[60px]" />
                </div>

                <div className="relative z-10 w-full max-w-xs space-y-8 px-6">
                    {/* Hero Icon */}
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 shadow-2xl shadow-blue-500/10 ring-1 ring-white/10">
                        <Sparkles className="h-11 w-11 text-blue-400/90" />
                    </div>

                    <div className="space-y-1 text-center">
                        <h2 className="text-xl font-bold text-white/90">AI Website Builder</h2>
                        <p className="text-sm leading-relaxed text-white/35">
                            Just 3 quick steps.<br />Your professional website — ready in minutes.
                        </p>
                    </div>

                    {/* Step guide */}
                    <div className="space-y-2">
                        {[
                            { num: 1, text: 'Tell us about your business', active: true },
                            { num: 2, text: 'AI creates your content & design', active: false },
                            { num: 3, text: 'Preview, edit & publish', active: false },
                        ].map(step => (
                            <div
                                key={step.num}
                                className={cn(
                                    'flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 transition-all',
                                    step.active
                                        ? 'border-blue-500/30 bg-blue-500/10 shadow-lg shadow-blue-500/5'
                                        : 'border-white/[0.04] bg-white/[0.02] opacity-40'
                                )}
                            >
                                <div className={cn(
                                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                                    step.active
                                        ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                                        : 'bg-white/10 text-white/40'
                                )}>
                                    {step.num}
                                </div>
                                <span className={cn('text-sm', step.active ? 'font-medium text-white/80' : 'text-white/40')}>
                                    {step.text}
                                </span>
                                {step.active && <ChevronRight className="ml-auto h-4 w-4 text-blue-400/60" />}
                            </div>
                        ))}
                    </div>

                    {/* Stat chips */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                            { label: '< 60s', sub: 'Generate' },
                            { label: '10+', sub: 'Sections' },
                            { label: 'Free', sub: 'To start' },
                        ].map(stat => (
                            <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-2 py-3">
                                <div className="text-sm font-bold text-white/80">{stat.label}</div>
                                <div className="mt-0.5 text-[10px] text-white/30">{stat.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <p className="text-center text-[11px] text-white/15">
                        © 2026 PrimeWeb. AI-powered website builder.
                    </p>
                </div>
            </div>
        </div>
    )
}

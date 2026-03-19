'use client'

import { useState } from 'react'
import { Sparkles, ArrowRight, Building2, ShoppingBag, Briefcase } from 'lucide-react'
import { useBuilderStore, type BusinessInfo } from '@/store/builderStore'

const INDUSTRY_OPTIONS = [
    { value: 'restaurant', label: '🍽️ Restaurant / Cafe / F&B', icon: '🍽️' },
    { value: 'ecommerce', label: '🛍️ Shop / Fashion / E-commerce', icon: '🛍️' },
    { value: 'beauty', label: '💄 Beauty / Spa / Wellness', icon: '💄' },
    { value: 'tech', label: '💻 Tech / IT / SaaS', icon: '💻' },
    { value: 'health', label: '🏥 Health / Dental / Clinic', icon: '🏥' },
    { value: 'education', label: '📚 Education / Training', icon: '📚' },
    { value: 'realestate', label: '🏠 Real Estate / Property', icon: '🏠' },
    { value: 'fitness', label: '💪 Gym / Fitness / Yoga', icon: '💪' },
    { value: 'creative', label: '🎨 Portfolio / Freelancer / Agency', icon: '🎨' },
    { value: 'other', label: '🏢 Other', icon: '🏢' },
]

const STYLE_OPTIONS = [
    { value: 'modern', label: 'Modern & Clean' },
    { value: 'classic', label: 'Classic & Elegant' },
    { value: 'bold', label: 'Bold & Vibrant' },
    { value: 'minimal', label: 'Minimal & Simple' },
]

const LANGUAGE_OPTIONS = [
    { value: 'auto', label: '🌐 Auto-detect' },
    { value: 'vi', label: '🇻🇳 Tiếng Việt' },
    { value: 'ms', label: '🇲🇾 Bahasa Melayu' },
    { value: 'en', label: '🇬🇧 English' },
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
        <div className="flex h-screen bg-[#0B1120]">
            {/* Left side — Form */}
            <div className="flex flex-1 items-center justify-center p-6">
                <div className="w-full max-w-lg space-y-8">
                    {/* Header */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-600">
                                <Sparkles className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">Create Website with AI</h1>
                                <p className="text-xs text-gray-500">Step 1/3 — Business Information</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-400">
                            Provide basic information so AI can create the perfect website for you.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Business Name */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                <Building2 className="h-3.5 w-3.5 text-gray-500" />
                                Business Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.businessName}
                                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                                placeholder="VD: The Coffee House, Beauty Spa Hana..."
                                className={`w-full rounded-xl border bg-[#1E293B] px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors
                                    ${errors.businessName ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-blue-500/50'}`}
                            />
                            {errors.businessName && <p className="text-xs text-red-400">{errors.businessName}</p>}
                        </div>

                        {/* Short Description */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                <Briefcase className="h-3.5 w-3.5 text-gray-500" />
                                Short Description
                            </label>
                            <textarea
                                value={form.shortDescription}
                                onChange={e => setForm(f => ({ ...f, shortDescription: e.target.value }))}
                                placeholder="VD: Tiệm bánh handmade hoạt động từ 2020..."
                                rows={2}
                                className="w-full rounded-xl border border-white/10 bg-[#1E293B] px-4 py-3 text-sm text-white placeholder-gray-600 outline-none resize-none focus:border-blue-500/50 transition-colors"
                            />
                        </div>

                        {/* Industry */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                <Briefcase className="h-3.5 w-3.5 text-gray-500" />
                                Industry <span className="text-red-400">*</span>
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
                                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-all
                                            ${form.industry === opt.value
                                                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                                                : 'border-white/10 bg-[#1E293B] text-gray-400 hover:border-white/20 hover:text-gray-300'
                                            }`}
                                    >
                                        <span>{opt.icon}</span>
                                        <span className="truncate">{opt.label.split(' ').slice(1).join(' ')}</span>
                                    </button>
                                ))}
                            </div>
                            {errors.industry && <p className="text-xs text-red-400">{errors.industry}</p>}
                        </div>

                        {/* Products / Services */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                <ShoppingBag className="h-3.5 w-3.5 text-gray-500" />
                                Products / Services <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                value={form.products}
                                onChange={e => setForm(f => ({ ...f, products: e.target.value }))}
                                placeholder="e.g. Specialty coffee, bubble tea, handmade pastries, co-working space..."
                                rows={3}
                                className={`w-full rounded-xl border bg-[#1E293B] px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors resize-none
                                    ${errors.products ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-blue-500/50'}`}
                            />
                            {errors.products && <p className="text-xs text-red-400">{errors.products}</p>}
                        </div>

                        {/* Target Audience (optional) */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-300">
                                Target Audience <span className="text-gray-600">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={form.targetAudience}
                                onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))}
                                placeholder="e.g. Young adults 18-35, office workers, families..."
                                className="w-full rounded-xl border border-white/10 bg-[#1E293B] px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500/50 transition-colors"
                            />
                        </div>

                        {/* Style */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-300">Style</label>
                            <div className="flex gap-2">
                                {STYLE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, style: opt.value }))}
                                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all
                                            ${form.style === opt.value
                                                ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                                                : 'border-white/10 bg-[#1E293B] text-gray-400 hover:border-white/20'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Language */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-300">Website Language</label>
                            <div className="flex flex-wrap gap-2">
                                {LANGUAGE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, language: opt.value }))}
                                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all
                                            ${form.language === opt.value
                                                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                                                : 'border-white/10 bg-[#1E293B] text-gray-400 hover:border-white/20'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isGenerating}
                            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/40 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? (
                                <>Generating Website...</>
                            ) : (
                                <>
                                    Generate Website
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            {/* Right side — Visual */}
            <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-[#0F172A] to-[#1E1B4B] border-l border-white/5">
                <div className="text-center space-y-6 max-w-sm">
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20">
                        <Sparkles className="h-12 w-12 text-purple-400" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-lg font-bold text-white">AI Website Builder</h2>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Just 3 simple steps, AI will create a professional website in minutes.
                        </p>
                    </div>
                    <div className="space-y-3 text-left">
                        <div className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">1</div>
                            <span className="text-sm text-gray-300">Enter business information</span>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-3 opacity-50">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-400">2</div>
                            <span className="text-sm text-gray-500">AI creates content & design</span>
                        </div>
                        <div className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-3 opacity-50">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-400">3</div>
                            <span className="text-sm text-gray-500">Preview & Publish</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

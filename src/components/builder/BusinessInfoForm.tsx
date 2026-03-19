'use client'

import { useState } from 'react'
import { Sparkles, ArrowRight, LayoutTemplate } from 'lucide-react'
import { useBuilderStore, type BusinessInfo } from '@/store/builderStore'
import { cn } from '@/lib/utils'

const INDUSTRY_OPTIONS = [
    { value: 'restaurant', label: 'Restaurant / Cafe / F&B', icon: '🍕' },
    { value: 'shop', label: 'Shop / Fashion / Ecommerce', icon: '🛍️' },
    { value: 'tech', label: 'Tech / IT / SaaS', icon: '💻' },
    { value: 'health', label: 'Health / Dental / Clinic', icon: '🏥' },
    { value: 'realestate', label: 'Real Estate / Property', icon: '🏠' },
    { value: 'portfolio', label: 'Portfolio / Freelancer / Agency', icon: '💼' },
    { value: 'education', label: 'Education / Training', icon: '🎓' },
    { value: 'fitness', label: 'Gym / Fitness / Yoga', icon: '🏋️' },
    { value: 'other', label: 'Other', icon: '📦' },
]

const STYLE_OPTIONS = [
    { value: 'modern', label: 'Modern & Clean' },
    { value: 'classic', label: 'Classic & Elegant' },
    { value: 'bold', label: 'Bold & Vibrant' },
    { value: 'minimal', label: 'Minimal & Simple' },
]

interface BusinessInfoFormProps {
    onSubmit?: (info: BusinessInfo) => void
    isGenerating?: boolean
}

export default function BusinessInfoForm({ onSubmit, isGenerating }: BusinessInfoFormProps) {
    const setBusinessInfo = useBuilderStore(s => s.setBusinessInfo)

    const [form, setForm] = useState({
        businessName: '',
        shortDescription: '', // kept for compatibility, but omitted visually
        industry: '',
        products: '',
        targetAudience: '',
        style: 'modern',
        language: 'auto', // kept for compatibility
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
        <div className="flex h-screen w-full bg-[#0B1120] text-white overflow-hidden font-['Inter']">
            {/* ─── Left Panel: Form ─────────────────────────────────────── */}
            <div className="flex w-full flex-col overflow-y-auto lg:w-1/2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                {/* Form Container imitating layout_TAPY5V (width ~775.5 inside 50%) */}
                <div className="w-full max-w-[695px] px-8 py-10 md:px-[40px] md:py-[40px] mx-auto lg:ml-auto lg:mr-0 flex flex-col gap-[44px]">
                    
                    {/* Header */}
                    <div className="flex items-center gap-[12px] h-[44px]">
                        <div className="flex h-[40px] w-[40px] items-center justify-center rounded-[16px] bg-gradient-to-br from-[#3B82F6] to-[#2DD4BF] shadow-[0_0_40px_rgba(45,212,191,0.3),0_0_24px_rgba(59,130,246,0.6)] shrink-0">
                            <Sparkles className="h-[20px] w-[20px] text-white" />
                        </div>
                        <div className="flex flex-col justify-center h-[44px]">
                            <h1 className="text-[20px] font-semibold text-transparent bg-clip-text bg-gradient-to-br from-[#F8FAFC] to-[#F8FAFC] leading-[1.4em]">
                                Create Website with AI
                            </h1>
                            <p className="text-[12px] text-[#94A3B8] leading-[1.333em]">
                                Step 1/3 — Business Information
                            </p>
                        </div>
                    </div>

                    <p className="text-[14px] leading-[1.428em] text-[#94A3B8] max-w-[466px] -mt-[30px]">
                        Provide basic information so AI can create the perfect website for you.
                    </p>

                    {/* Form Fields container layout_X1XR1C */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-[24px] pr-0 md:pr-[19px]">
                        
                        {/* 1. Business Name */}
                        <div className="flex flex-col gap-[8px]">
                            <label className="flex items-center text-[14px] font-medium text-[#F8FAFC] h-[24px]">
                                <span className="w-[20px] leading-none text-center transform -translate-y-px">📝</span>
                                <span className="ml-[8px]">Business Name </span>
                                <span className="ml-[1px] text-[#EF4444]">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.businessName}
                                onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                                placeholder="Business Name"
                                className={cn(
                                    'w-full rounded-[16px] border bg-[rgba(30,41,59,0.6)] px-[12px] py-[12px] text-[14px] text-white placeholder:text-[#94A3B8] outline-none transition-all duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_rgba(255,255,255,0.05)]',
                                    errors.businessName
                                        ? 'border-red-500/40 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/10'
                                        : 'border-[rgba(59,130,246,0.15)] focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/10'
                                )}
                            />
                            {errors.businessName && <span className="text-xs text-red-400">{errors.businessName}</span>}
                        </div>

                        {/* 2. Industry */}
                        <div className="flex flex-col gap-[8px]">
                            <label className="flex items-center text-[14px] font-medium text-[#F8FAFC] h-[24px]">
                                <span className="w-[20px] leading-none text-center transform -translate-y-px">🏢</span>
                                <span className="ml-[8px]">Industry </span>
                                <span className="ml-[1px] text-[#EF4444]">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-x-[12px] gap-y-[10px]">
                                {INDUSTRY_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            setForm(f => ({ ...f, industry: opt.value }))
                                            setErrors(e => ({ ...e, industry: '' }))
                                        }}
                                        className={cn(
                                            'flex items-center gap-[8px] rounded-[16px] border px-[10px] py-[10px] text-left transition-all duration-200 min-h-[40px]',
                                            form.industry === opt.value
                                                ? 'border-[#3B82F6] bg-gradient-to-r from-[rgba(59,130,246,0.2)] to-[rgba(45,212,191,0.2)] text-[#F8FAFC] shadow-[0_4px_6px_-4px_rgba(59,130,246,0.25),0_10px_15px_-3px_rgba(59,130,246,0.25)]'
                                                : 'border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] text-[#94A3B8] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_rgba(255,255,255,0.05)] hover:border-blue-500/30'
                                        )}
                                    >
                                        <span className="w-[20px] leading-[24px] text-center shrink-0">{opt.icon}</span>
                                        <span className={cn('text-[12px] leading-[1.333em]', form.industry === opt.value ? 'font-semibold text-[#03V6UO]' : 'font-medium text-[#94A3B8]')}>
                                            {opt.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            {errors.industry && <span className="text-xs text-red-400">{errors.industry}</span>}
                        </div>

                        {/* 3. Products / Services */}
                        <div className="flex flex-col gap-[8px]">
                            <label className="flex items-center text-[14px] font-medium text-[#F8FAFC] h-[24px]">
                                <span className="w-[20px] leading-none text-center transform -translate-y-px">📦</span>
                                <span className="ml-[8px]">Products / Services </span>
                                <span className="ml-[1px] text-[#EF4444]">*</span>
                            </label>
                            <div className="relative">
                                <textarea
                                    value={form.products}
                                    onChange={e => setForm(f => ({ ...f, products: e.target.value }))}
                                    placeholder="e.g., Specialty coffee, bubble tea, handmade pastries, croissants etc..."
                                    rows={3}
                                    className={cn(
                                        'w-full resize-none rounded-[16px] border bg-[rgba(30,41,59,0.6)] pl-[12px] pr-[40px] py-[12px] text-[14px] text-[#F8FAFC] placeholder:text-[rgba(248,250,252,0.5)] outline-none transition-all duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_rgba(255,255,255,0.05)]',
                                        errors.products
                                            ? 'border-red-500/40 focus:border-red-500/60 focus:ring-1 focus:ring-red-500/10'
                                            : 'border-[rgba(59,130,246,0.15)] focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/10'
                                    )}
                                />
                                <div className="absolute right-[12px] top-[12px] flex h-[24px] w-[24px] items-center justify-center rounded-full bg-[rgba(59,130,246,0.1)]">
                                    <Sparkles className="h-[12px] w-[12px] text-[#3B82F6]" />
                                </div>
                            </div>
                            <div className="flex items-center gap-[8px] text-[12px] text-[#94A3B8] pl-[2px]">
                                <span>AI will use this to suggest product images and layout</span>
                            </div>
                            {errors.products && <span className="text-xs text-red-400">{errors.products}</span>}
                        </div>

                        {/* 4. Target Audience */}
                        <div className="flex flex-col gap-[8px]">
                            <label className="flex items-center text-[14px] font-medium text-[#F8FAFC] h-[24px]">
                                <span className="w-[20px] leading-none text-center transform -translate-y-px">🎯</span>
                                <span className="ml-[8px]">Target Audience </span>
                                <span className="ml-[4px] text-[12px] text-[#94A3B8] font-medium">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={form.targetAudience}
                                onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))}
                                placeholder="Enter target audience..."
                                className="w-full rounded-[16px] border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] px-[12px] py-[12px] text-[14px] text-white placeholder:text-[#94A3B8] outline-none transition-all duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_rgba(255,255,255,0.05)] focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/10"
                            />
                        </div>

                        {/* 5. Style */}
                        <div className="flex flex-col gap-[8px]">
                            <label className="flex items-center text-[14px] font-medium text-[#F8FAFC] h-[24px]">
                                <span className="w-[20px] leading-none text-center transform -translate-y-px">🎨</span>
                                <span className="ml-[8px]">Style</span>
                            </label>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-[4px]">
                                {STYLE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, style: opt.value }))}
                                        className={cn(
                                            'flex w-full items-center justify-center rounded-[16px] border px-[8px] h-[44px] text-[12px] transition-all duration-200',
                                            form.style === opt.value
                                                ? 'border-[#3B82F6] bg-gradient-to-r from-[rgba(59,130,246,0.2)] to-[rgba(45,212,191,0.2)] text-[#03V6UO] font-semibold shadow-[0_4px_6px_-4px_rgba(59,130,246,0.25),0_10px_15px_-3px_rgba(59,130,246,0.25)]'
                                                : 'border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] text-[#94A3B8] font-medium shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_rgba(255,255,255,0.05)] hover:border-blue-500/30'
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-[24px]">
                            <button
                                type="submit"
                                disabled={isGenerating}
                                className="flex w-full items-center justify-center gap-[6px] rounded-[16px] bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] h-[48px] text-[14px] font-semibold text-white transition-all duration-300 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.1)]"
                            >
                                {isGenerating ? (
                                    <>
                                        <span className="h-[16px] w-[16px] animate-spin rounded-full border-[2px] border-white/20 border-t-white" />
                                        <span>Initializing...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="leading-[20px]">Continue — AI will create your website</span>
                                        <ArrowRight className="h-[16px] w-[16px] text-white opacity-80" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ─── Right Panel: AI Website Builder Promo ────────────────── */}
            <div className="hidden lg:flex w-1/2 h-full items-center justify-center bg-gradient-to-br from-[rgba(59,130,246,0.1)] via-[rgba(45,212,191,0.1)] to-transparent relative">
                {/* Promo Card layout_DLRHEE */}
                <div className="relative z-10 w-[448px] h-[419.5px] rounded-[16px] border border-[rgba(59,130,246,0.15)] bg-[rgba(30,41,59,0.6)] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_rgba(255,255,255,0.05)] backdrop-blur-xl shrink-0 p-8 flex flex-col justify-center">
                    
                    {/* Header icon */}
                    <div className="h-[64px] w-[64px] rounded-[16px] bg-gradient-to-br from-[#3B82F6] to-[#2DD4BF] shadow-[0_0_40px_rgba(45,212,191,0.3),0_0_24px_rgba(59,130,246,0.6)] flex items-center justify-center mb-[24px]">
                        <LayoutTemplate className="h-[32px] w-[32px] text-white" />
                    </div>

                    {/* Header text */}
                    <div className="mb-[32px]">
                        <h2 className="text-[24px] font-semibold text-[#F8FAFC] leading-[1.333em] mb-[8px]">
                            AI Website Builder
                        </h2>
                        <p className="text-[14px] text-[#94A3B8] leading-[1.625em] max-w-[373px]">
                            Just 3 simple steps, AI will create a professional website in minutes.
                        </p>
                    </div>

                    {/* Steps List layout_KS5UKP */}
                    <div className="flex flex-col gap-[16px]">
                        {/* Step 1 */}
                        <div className="flex items-center gap-[16px]">
                            <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2DD4BF] text-white font-semibold text-[16px]">
                                1
                            </div>
                            <span className="text-[14px] font-medium text-[#F8FAFC]">
                                Enter business information
                            </span>
                        </div>
                        
                        {/* Step 2 */}
                        <div className="flex items-center gap-[16px]">
                            <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[rgba(30,41,59,0.6)] border border-[rgba(59,130,246,0.15)] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_rgba(255,255,255,0.05)] text-[#94A3B8] font-semibold text-[16px]">
                                2
                            </div>
                            <span className="text-[14px] font-medium text-[#94A3B8]">
                                AI creates content & design
                            </span>
                        </div>
                        
                        {/* Step 3 */}
                        <div className="flex items-center gap-[16px]">
                            <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[rgba(30,41,59,0.6)] border border-[rgba(59,130,246,0.15)] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_rgba(255,255,255,0.05)] text-[#94A3B8] font-semibold text-[16px]">
                                3
                            </div>
                            <span className="text-[14px] font-medium text-[#94A3B8]">
                                Preview & Publish
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

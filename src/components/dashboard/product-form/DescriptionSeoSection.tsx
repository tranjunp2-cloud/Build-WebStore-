'use client'

import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { toast } from 'sonner'
import { ProductFormValues } from './schema'
import { Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'

export function DescriptionSeoSection() {
    const { register, watch, setValue, getValues, formState: { errors } } = useFormContext<ProductFormValues>()
    const { t, locale } = useI18n()
    
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false)
    const [isGeneratingSeo, setIsGeneratingSeo] = useState(false)

    const productName = watch('name')
    const categoryIds = watch('categoryIds')

    const getCategoryName = () => {
        if (!categoryIds || categoryIds.length === 0) return ''
        return String(categoryIds[0])
    }

    const handleGenerateDescription = async () => {
        if (!productName || productName.trim().length < 3) {
            toast.error(t.dashboard.products.messages?.nameRequired || 'Please enter a product name first!', {
                position: 'top-center'
            })
            return
        }

        setIsGeneratingDesc(true)
        const categoryName = getCategoryName()
        const loadingId = toast.loading(t.dashboard.products.messages?.aiWritingDesc || 'AI is writing description...', { position: 'top-center' })
        try {
            const res = await fetch('/api/ai/product-description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: productName, category: categoryName, language: locale })
            })
            const result = await res.json()
            if (result.success && result.data?.description) {
                setValue('description', result.data.description, { shouldDirty: true, shouldValidate: true })
                toast.success(t.dashboard.products.messages?.descSuccess || 'Description generated successfully!', { id: loadingId })
            } else {
                throw new Error(result.error || t.dashboard.products.messages?.generateFailed || 'Failed to generate')
            }
        } catch (err: any) {
            toast.error(err.message || t.dashboard.products.messages?.networkError || 'Network error', { id: loadingId })
        } finally {
            setIsGeneratingDesc(false)
        }
    }

    const handleGenerateSeo = async () => {
        const name = getValues('name')
        if (!name || name.trim().length < 3) {
            toast.error(t.dashboard.products.messages?.nameRequired || 'Please enter a product name first!', {
                position: 'top-center'
            })
            return
        }
        
        setIsGeneratingSeo(true)
        const loadingId = toast.loading(t.dashboard.products.messages?.aiOptimizingSeo || 'AI is optimizing SEO...', { position: 'top-center' })
        try {
            const res = await fetch('/api/ai/seo-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, language: locale })
            })
            const result = await res.json()
            if (result.success && result.data) {
                setValue('metaTitle', result.data.title, { shouldDirty: true, shouldValidate: true })
                setValue('metaDescription', result.data.description, { shouldDirty: true, shouldValidate: true })
                setValue('urlSlug', result.data.slug, { shouldDirty: true, shouldValidate: true })
                toast.success(t.dashboard.products.messages?.seoSuccess || 'SEO optimized successfully!', { id: loadingId })
            } else {
                throw new Error(result.error || t.dashboard.products.messages?.generateFailed || 'Failed to generate')
            }
        } catch (err: any) {
            toast.error(err.message || t.dashboard.products.messages?.networkError || 'Network error', { id: loadingId })
        } finally {
            setIsGeneratingSeo(false)
        }
    }

    return (
        <div className="rounded-2xl border border-white/[0.08] bg-[#1E293B]/60 p-[25px] flex flex-col gap-6">
            <h2 className="text-[18px] font-semibold text-[#F8FAFC] leading-[1.56] font-outfit m-0">{t.dashboard.products.form.sections?.seo || 'Description & SEO'}</h2>
            
            {/* Body */}
            <div className="flex flex-col gap-6">
                {/* Description */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[14px] font-medium text-[#F8FAFC] m-0">
                            {t.dashboard.products.form.seoDescription || 'Product Description'}
                        </label>
                        <button 
                            type="button"
                            onClick={handleGenerateDescription}
                            disabled={isGeneratingDesc}
                            className="flex items-center gap-1.5 rounded-xl border-none outline-none bg-[#2DD4BF]/10 px-3 py-1.5 transition-colors hover:bg-[#2DD4BF]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGeneratingDesc ? <Loader2 className="h-3.5 w-3.5 text-[#2DD4BF] animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-[#2DD4BF]" />}
                            <span className="text-[12px] font-semibold text-[#2DD4BF]">{t.dashboard.products.form.sections?.writeWithAi || 'Write with AI'}</span>
                        </button>
                    </div>
                    <textarea
                        {...register('description')}
                        placeholder="Enter detailed product description..."
                        rows={6}
                        className="w-full rounded-2xl border border-white/[0.08] bg-[#0B1120] px-4 py-3 text-[16px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 focus:border-white focus:ring-1 focus:ring-white focus:outline-none transition-colors resize-y"
                    />
                </div>

                {/* SEO Toggle Banner -> AI Optimization Button in Design */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0 rounded-2xl border border-white/5 bg-[#0B1120]/50 p-3 md:p-[17px]">
                    <div className="flex flex-col items-start gap-1 text-left">
                        <h3 className="text-[14px] md:text-[16px] font-medium text-[#F8FAFC] m-0">{t.dashboard.products.form.sections?.seoOpt || 'Search Optimization (SEO)'}</h3>
                        <p className="text-[12px] text-[#F8FAFC]/50 m-0 leading-tight pb-0.5 md:pb-0">{t.dashboard.products.form.sections?.seoOptDesc || 'Automatically generate Meta Title and Slug'}</p>
                    </div>
                    <button 
                        type="button"
                        onClick={handleGenerateSeo}
                        disabled={isGeneratingSeo}
                        className="flex items-center gap-1.5 rounded-[12px] border-none outline-none bg-[#2DD4BF]/10 px-3 py-1.5 md:px-4 md:py-2 transition-colors hover:bg-[#2DD4BF]/20 shrink-0 mt-0.5 md:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGeneratingSeo ? (
                            <Loader2 className="w-[17px] h-[20px] text-[#2DD4BF] animate-spin" />
                        ) : (
                            <svg width="17" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[17px] h-[20px] text-[#2DD4BF]">
                                <path d="M10.4902 4.08447C10.7495 2.5029 12.9818 2.37893 13.4334 3.92137L14.288 6.83984C14.4449 7.37563 14.8647 7.79545 15.4005 7.95232L18.3189 8.8069C19.8614 9.25845 19.7374 11.4908 18.1558 11.7501L15.1741 12.2389C14.6214 12.3295 14.1802 12.7707 14.0896 13.3235L13.6008 16.3051C13.3415 17.8867 11.1092 18.0107 10.6576 16.4682L9.803 13.5497C9.64614 13.0139 9.22632 12.5941 8.69053 12.4372L5.77207 11.5826C4.22953 11.1311 4.3535 8.89874 5.93506 8.63945L8.91678 8.15065C9.46953 8.05999 9.91071 7.61881 10.0014 7.06606L10.4902 4.08447Z" fill="currentColor" />
                                <path d="M4.65934 3.0901C4.76785 2.42845 5.70051 2.37655 5.88941 3.02196L6.24683 4.24357C6.31215 4.46663 6.48666 4.6415 6.70992 4.70725L7.93325 5.0674C8.57866 5.25737 8.52676 6.19003 7.86511 6.29854L6.6178 6.5031C6.38682 6.54098 6.2023 6.72596 6.16452 6.9571L5.96041 8.20456C5.85191 8.86621 4.91924 8.91811 4.73034 8.2727L4.37293 7.05109C4.30761 6.82803 4.13309 6.65315 3.90983 6.58741L2.68651 6.22725C2.0411 6.03728 2.093 5.10462 2.75465 4.99611L4.00196 4.79155C4.23294 4.75367 4.41746 4.56869 4.45523 4.33755L4.65934 3.0901Z" fill="currentColor" />
                            </svg>
                        )}
                        <span className="text-[14px] font-semibold text-[#2DD4BF]">{t.dashboard.products.form.sections?.aiOpt || 'AI Optimization'}</span>
                    </button>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-[14px] font-medium text-[#F8FAFC] m-0">{t.dashboard.products.form.sections?.metaTitle || 'Meta Title'}</label>
                        <input
                            {...register('metaTitle')}
                            placeholder="Title for SEO"
                            className={cn(
                                "w-full rounded-2xl border bg-[#0B1120] px-4 py-3 text-[16px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 focus:ring-1 focus:ring-white focus:outline-none transition-colors",
                                errors.metaTitle ? "border-red-500" : "border-white/[0.08] focus:border-white"
                            )}
                        />
                        {errors.metaTitle && <span className="text-[12px] text-red-500">{errors.metaTitle.message}</span>}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[14px] font-medium text-[#F8FAFC] m-0">{t.dashboard.products.form.sections?.metaDesc || 'Meta Description'}</label>
                            <span className="text-[12px] text-[#F8FAFC]/40">{t.dashboard.products.form.sections?.metaDescMax || '(max 160 chars)'}</span>
                        </div>
                        <textarea
                            {...register('metaDescription')}
                            placeholder="Brief description for search engines (150-160 chars)"
                            rows={3}
                            className={cn(
                                "w-full rounded-2xl border bg-[#0B1120] px-4 py-3 text-[16px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 focus:ring-1 focus:ring-white focus:outline-none transition-colors resize-none",
                                errors.metaDescription ? "border-red-500" : "border-white/[0.08] focus:border-white"
                            )}
                        />
                        {errors.metaDescription && <span className="text-[12px] text-red-500">{errors.metaDescription.message}</span>}
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[14px] font-medium text-[#F8FAFC] m-0">{t.dashboard.products.form.sections?.urlSlug || 'URL Slug'} <span className="text-[#F8FAFC]">*</span></label>
                        <input
                            {...register('urlSlug')}
                            placeholder="product-url"
                            className={cn(
                                "w-full rounded-2xl border bg-[#0B1120] px-4 py-3 text-[16px] text-[#F8FAFC] placeholder:text-[#F8FAFC]/40 focus:ring-1 focus:ring-white focus:outline-none transition-colors",
                                errors.urlSlug ? "border-red-500" : "border-white/[0.08] focus:border-white"
                            )}
                        />
                        {errors.urlSlug && <span className="text-[12px] text-red-500">{errors.urlSlug.message}</span>}
                    </div>
                </div>
            </div>
        </div>
    )
}

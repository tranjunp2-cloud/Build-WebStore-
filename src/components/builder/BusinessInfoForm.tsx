'use client'

import type { FormEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { BuilderField } from '@/components/builder/fields/BuilderField'
import { BuilderOptionCard } from '@/components/builder/fields/BuilderOptionCard'
import { BuilderOptionGrid } from '@/components/builder/fields/BuilderOptionGrid'
import { BuilderSubmitButton } from '@/components/builder/fields/BuilderSubmitButton'
import { BuilderTextInput } from '@/components/builder/fields/BuilderTextInput'
import { BuilderTextarea } from '@/components/builder/fields/BuilderTextarea'
import { BuilderPromoCard } from '@/components/builder/onboarding/BuilderPromoCard'
import { BuilderStepScreen } from '@/components/builder/onboarding/BuilderStepScreen'
import { useBuilderStore, type BusinessInfo } from '@/store/builderStore'

type IndustryOption = {
    value: string
    label: string
    icon?: string
}

const BUILDER_TEXTAREA_BADGE_URL = '/assets/builder/builder-textarea-badge.svg'
const BUILDER_TEXTAREA_HINT_ICON_URL = '/assets/builder/builder-hint-icon.svg'

interface BusinessInfoFormProps {
    onSubmit?: (info: BusinessInfo) => void
    onPreviewNextStep?: (info: BusinessInfo) => void
    isGenerating?: boolean
    floatingControls?: ReactNode
    initialValues?: Partial<BusinessInfo> | null
}

const DEFAULT_FORM: BusinessInfo = {
    businessName: '',
    shortDescription: '',
    industry: '',
    products: '',
    targetAudience: '',
    style: 'modern',
    language: 'auto',
}

export default function BusinessInfoForm({
    onSubmit,
    onPreviewNextStep,
    isGenerating,
    floatingControls,
    initialValues,
}: BusinessInfoFormProps) {
    const setBusinessInfo = useBuilderStore((s) => s.setBusinessInfo)

    const [form, setForm] = useState<BusinessInfo>({ ...DEFAULT_FORM, ...initialValues })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [industryOptions, setIndustryOptions] = useState<IndustryOption[]>([])
    const [isLoadingIndustries, setIsLoadingIndustries] = useState(true)

    const isFormReady =
        form.businessName.trim().length > 0 &&
        form.industry.trim().length > 0 &&
        form.products.trim().length > 0

    useEffect(() => {
        let isMounted = true

        async function fetchIndustryOptions() {
            try {
                const response = await fetch('/api/templates/categories', {
                    credentials: 'include',
                })

                if (!response.ok) {
                    throw new Error('Failed to load industries')
                }

                const data = await response.json()
                if (!isMounted) return

                setIndustryOptions(Array.isArray(data.docs) ? data.docs : [])
            } catch (error) {
                console.error('Failed to fetch industry options:', error)
                if (!isMounted) return
                setIndustryOptions([])
            } finally {
                if (isMounted) {
                    setIsLoadingIndustries(false)
                }
            }
        }

        fetchIndustryOptions()

        return () => {
            isMounted = false
        }
    }, [])

    useEffect(() => {
        if (!initialValues) return

        setForm({
            ...DEFAULT_FORM,
            ...initialValues,
        })
    }, [
        initialValues?.businessName,
        initialValues?.shortDescription,
        initialValues?.industry,
        initialValues?.products,
        initialValues?.targetAudience,
        initialValues?.style,
        initialValues?.language,
    ])

    const validate = (): boolean => {
        const nextErrors: Record<string, string> = {}

        if (!form.businessName.trim()) nextErrors.businessName = 'Please enter your business name'
        if (!form.industry) nextErrors.industry = 'Please select an industry'
        if (!form.products.trim()) nextErrors.products = 'Please describe your products / services'

        setErrors(nextErrors)
        return Object.keys(nextErrors).length === 0
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        submitForm()
    }

    const submitForm = () => {
        if (!validate() || isGenerating) return

        if (onSubmit) {
            onSubmit(form as BusinessInfo)
            return
        }

        setBusinessInfo(form as BusinessInfo)
    }

    const handlePreviewNextStep = () => {
        const demoInfo: BusinessInfo = {
            businessName: 'Duck Coffee',
            shortDescription: 'We are a modern neighborhood cafe serving specialty coffee, fresh pastries, and a warm all-day atmosphere.',
            industry: 'restaurant',
            products: 'Specialty coffee, croissants, handmade pastries, bubble tea',
            targetAudience: '',
            style: 'modern',
            language: 'auto',
        }

        if (onPreviewNextStep) {
            onPreviewNextStep(demoInfo)
            return
        }

        setBusinessInfo(demoInfo)
    }

    const leftBody = (
        <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
                <BuilderField
                    error={errors.businessName}
                    icon="📝"
                    label="Business Name"
                    required
                >
                    <BuilderTextInput
                        invalid={!!errors.businessName}
                        onChange={(e) => setForm((current) => ({ ...current, businessName: e.target.value }))}
                        placeholder="e.g., The Cookie House, Beauty Spa Hana..."
                        type="text"
                        value={form.businessName}
                    />
                </BuilderField>

                <BuilderField
                    error={errors.industry}
                    icon="🏢"
                    label="Industry"
                    required
                >
                    <BuilderOptionGrid>
                        {industryOptions.map((option) => (
                            <BuilderOptionCard
                                icon={option.icon}
                                key={option.value}
                                label={option.label}
                                onClick={() => setForm((current) => ({ ...current, industry: option.value }))}
                                selected={form.industry === option.value}
                            />
                        ))}
                    </BuilderOptionGrid>
                    {isLoadingIndustries ? (
                        <p className="text-xs text-[#94a3b8]">Loading industries...</p>
                    ) : null}
                </BuilderField>

                <BuilderField
                    hint={(
                        <div className="flex items-center gap-2">
                            <img alt="" className="size-3" src={BUILDER_TEXTAREA_HINT_ICON_URL} />
                            <span>AI will use this to suggest product images and layout</span>
                        </div>
                    )}
                    error={errors.products}
                    icon="📦"
                    label="Products / Services"
                    required
                >
                    <BuilderTextarea
                        adornment={(
                            <div className="flex size-6 items-center justify-center rounded-full bg-[rgba(59,130,246,0.1)]">
                                <img alt="" className="size-3" src={BUILDER_TEXTAREA_BADGE_URL} />
                            </div>
                        )}
                        invalid={!!errors.products}
                        onChange={(e) => setForm((current) => ({ ...current, products: e.target.value }))}
                        placeholder="e.g., Specialty coffee, bubble tea, handmade pastries, croissants etc..."
                        rows={3}
                        value={form.products}
                    />
                </BuilderField>

                <BuilderField
                    hint={(
                        <div className="flex items-center gap-2">
                            <img alt="" className="size-3" src={BUILDER_TEXTAREA_HINT_ICON_URL} />
                            <span>AI will use this to suggest content and tone</span>
                        </div>
                    )}
                    icon="📝"
                    label="Description"
                    optionalLabel="(optional)"
                >
                    <BuilderTextarea
                        adornment={(
                            <div className="flex size-6 items-center justify-center rounded-full bg-[rgba(59,130,246,0.1)]">
                                <img alt="" className="size-3" src={BUILDER_TEXTAREA_BADGE_URL} />
                            </div>
                        )}
                        onChange={(e) => setForm((current) => ({ ...current, shortDescription: e.target.value }))}
                        placeholder="e.g., We are a family-owned bakery that specializes in artisan breads and pastries..."
                        rows={3}
                        value={form.shortDescription}
                    />
                </BuilderField>
            </div>
        </form>
    )

    const leftFooter = (
        <>
            <BuilderSubmitButton
                disabled={!isFormReady || isGenerating}
                loading={isGenerating}
                onClick={submitForm}
                type="button"
            >
                Continue — AI will create your website
            </BuilderSubmitButton>
            <button
                className="mt-3 w-full text-center text-xs font-medium text-[#94a3b8] transition-colors hover:text-white"
                onClick={handlePreviewNextStep}
                type="button"
            >
                Use demo data to preview next step
            </button>
        </>
    )

    const rightPane = (
        <BuilderPromoCard
            description="Just 3 simple steps, AI will create a professional website in minutes."
            steps={[
                { id: 1, label: 'Enter business information', active: true },
                { id: 2, label: 'AI creates content & design' },
                { id: 3, label: 'Preview & Publish' },
            ]}
            title="AI Website Builder"
        />
    )

    return (
        <BuilderStepScreen
            description="Provide basic information so AI can create the perfect website for you."
            floatingControls={floatingControls}
            leftBody={leftBody}
            leftFooter={leftFooter}
            right={rightPane}
            subtitle="Business Information"
            title="Create Website with AI"
        />
    )
}

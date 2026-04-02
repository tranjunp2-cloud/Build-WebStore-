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
import { useI18n } from '@/i18n'

type IndustryOption = {
    value: string
    label: string
    icon?: string
}

const BUILDER_TEXTAREA_BADGE_URL = '/assets/builder/builder-textarea-badge.svg'
const BUILDER_TEXTAREA_HINT_ICON_URL = '/assets/builder/builder-hint-icon.svg'

interface BusinessInfoFormProps {
    onSubmit?: (info: BusinessInfo) => void
    onRetry?: (info: BusinessInfo) => void
    errorMessage?: string | null
    isGenerating?: boolean
    initialValues?: Partial<BusinessInfo> | null
}

const DEFAULT_FORM: BusinessInfo = {
    businessName: '',
    shortDescription: '',
    industry: '',
    products: '',
    language: 'auto',
}

export default function BusinessInfoForm({
    onSubmit,
    onRetry,
    errorMessage,
    isGenerating,
    initialValues,
}: BusinessInfoFormProps) {
    const setBusinessInfo = useBuilderStore((s) => s.setBusinessInfo)
    const { t } = useI18n()

    const [form, setForm] = useState<BusinessInfo>({ ...DEFAULT_FORM, ...initialValues })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [industryOptions, setIndustryOptions] = useState<IndustryOption[]>([])
    const [isLoadingIndustries, setIsLoadingIndustries] = useState(true)

    const isFormReady =
        form.businessName.trim().length > 0 &&
        form.industry.trim().length > 0 &&
        form.shortDescription.trim().length > 0 &&
        form.products.trim().length > 0

    useEffect(() => {
        let isMounted = true

        async function fetchIndustryOptions() {
            try {
                const response = await fetch('/api/data/industries', {
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
        initialValues?.language,
    ])

    const validate = (): boolean => {
        const nextErrors: Record<string, string> = {}

        if (!form.businessName.trim()) nextErrors.businessName = t.onboarding.form.errors.businessName
        if (!form.industry) nextErrors.industry = t.onboarding.form.errors.industry
        if (!form.shortDescription.trim()) nextErrors.shortDescription = t.onboarding.form.errors.shortDescription
        if (!form.products.trim()) nextErrors.products = t.onboarding.form.errors.products

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

    const leftBody = (
        <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
                {errorMessage ? (
                    <div className="rounded-2xl border border-[rgba(248,113,113,0.35)] bg-[rgba(127,29,29,0.18)] px-4 py-3 text-sm text-[#fecaca]">
                        <p>{errorMessage}</p>
                        {onRetry ? (
                            <button
                                className="mt-3 text-sm font-semibold text-white transition-colors hover:text-[#bfdbfe]"
                                onClick={() => onRetry(form)}
                                type="button"
                            >
                                {t.onboarding.form.retryWithCurrent}
                            </button>
                        ) : null}
                    </div>
                ) : null}

                <BuilderField
                    error={errors.businessName}
                    icon="📝"
                    label={t.onboarding.form.businessName}
                    required
                >
                    <BuilderTextInput
                        invalid={!!errors.businessName}
                        onChange={(e) => setForm((current) => ({ ...current, businessName: e.target.value }))}
                        placeholder={t.onboarding.form.businessNamePlaceholder}
                        type="text"
                        value={form.businessName}
                    />
                </BuilderField>

                <BuilderField
                    error={errors.industry}
                    icon="🏢"
                    label={t.onboarding.form.industry}
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
                        <p className="text-xs text-[#94a3b8]">{t.onboarding.form.loadingIndustries}</p>
                    ) : null}
                </BuilderField>

                <BuilderField
                    hint={(
                        <div className="flex items-center gap-2">
                            <img alt="" className="size-3" src={BUILDER_TEXTAREA_HINT_ICON_URL} />
                            <span>{t.onboarding.form.productsHint}</span>
                        </div>
                    )}
                    error={errors.products}
                    icon="📦"
                    label={t.onboarding.form.products}
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
                        placeholder={t.onboarding.form.productsPlaceholder}
                        rows={3}
                        value={form.products}
                    />
                </BuilderField>

                <BuilderField
                    hint={(
                        <div className="flex items-center gap-2">
                            <img alt="" className="size-3" src={BUILDER_TEXTAREA_HINT_ICON_URL} />
                            <span>{t.onboarding.form.shortDescriptionHint}</span>
                        </div>
                    )}
                    error={errors.shortDescription}
                    icon="📝"
                    label={t.onboarding.form.shortDescription}
                    required
                >
                    <BuilderTextarea
                        adornment={(
                            <div className="flex size-6 items-center justify-center rounded-full bg-[rgba(59,130,246,0.1)]">
                                <img alt="" className="size-3" src={BUILDER_TEXTAREA_BADGE_URL} />
                            </div>
                        )}
                        invalid={!!errors.shortDescription}
                        onChange={(e) => setForm((current) => ({ ...current, shortDescription: e.target.value }))}
                        placeholder={t.onboarding.form.shortDescriptionPlaceholder}
                        rows={3}
                        value={form.shortDescription}
                    />
                </BuilderField>
            </div>
        </form>
    )

    const leftFooter = (
        <BuilderSubmitButton
            disabled={!isFormReady || isGenerating}
            loading={isGenerating}
            onClick={submitForm}
            type="button"
        >
            {t.onboarding.form.generateButton}
        </BuilderSubmitButton>
    )

    const rightPane = (
        <BuilderPromoCard
            description={t.onboarding.form.promoDescription}
            steps={[
                { id: 1, label: t.onboarding.form.promoStep1, active: true },
                { id: 2, label: t.onboarding.form.promoStep2 },
                { id: 3, label: t.onboarding.form.promoStep3 },
            ]}
            title={t.onboarding.form.promoTitle}
        />
    )

    return (
        <BuilderStepScreen
            description={t.onboarding.step1Description}
            leftBody={leftBody}
            leftFooter={leftFooter}
            right={rightPane}
            subtitle={t.onboarding.step1Subtitle}
            title={t.onboarding.step1Title}
        />
    )
}

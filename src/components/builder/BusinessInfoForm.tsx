'use client'

import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
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

type ExtractionResult = {
    businessName: string
    industry: string
    shortDescription: string
    products: string
    suggestedTheme?: {
        primaryColor?: string
        secondaryColor?: string
        siteType?: string
    }
    detectedLanguage: string
    confidence: 'high' | 'medium' | 'low'
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

    // URL extraction state
    const [inputMode, setInputMode] = useState<'manual' | 'url'>('manual')
    const [urlValue, setUrlValue] = useState('')
    const [urlExtracting, setUrlExtracting] = useState(false)
    const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)
    const [extractionError, setExtractionError] = useState<string | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    const isFormReady =
        form.businessName.trim().length >= 3 &&
        form.industry.trim().length > 0 &&
        form.shortDescription.trim().length >= 3 &&
        form.products.trim().length >= 3

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

        if (form.businessName.trim().length < 3) nextErrors.businessName = t.onboarding.form.errors.businessName
        if (!form.industry) nextErrors.industry = t.onboarding.form.errors.industry
        if (form.shortDescription.trim().length < 3) nextErrors.shortDescription = t.onboarding.form.errors.shortDescription
        if (form.products.trim().length < 3) nextErrors.products = t.onboarding.form.errors.products

        setErrors(nextErrors)
        return Object.keys(nextErrors).length === 0
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        submitForm()
    }

    const submitForm = () => {
        if (!validate() || isGenerating) return

        const payload: BusinessInfo = {
            ...form,
            ...(extractionResult ? { businessUrl: urlValue, source: 'url' as const } : { source: 'form' as const }),
        }

        if (onSubmit) {
            onSubmit(payload)
            return
        }

        setBusinessInfo(payload)
    }

    // ── URL Extraction ───────────────────────────────────────────────────

    const isValidUrl = (value: string): boolean => {
        try {
            const url = new URL(value)
            return ['http:', 'https:'].includes(url.protocol)
        } catch {
            return false
        }
    }

    const handleUrlExtract = async () => {
        if (!isValidUrl(urlValue) || urlExtracting) return

        setUrlExtracting(true)
        setExtractionError(null)
        setExtractionResult(null)

        abortControllerRef.current = new AbortController()

        try {
            const res = await fetch('/api/ai/extract-from-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ url: urlValue }),
                signal: abortControllerRef.current.signal,
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                const code = data.code || ''
                let message = data.error || t.onboarding.form.errorGeneric

                // Map error codes to i18n messages
                if (code === 'RATE_LIMITED') message = t.onboarding.form.errorRateLimit
                else if (code === 'URL_BLOCKED') message = t.onboarding.form.errorBlocked
                else if (code === 'CONTENT_UNSAFE') message = t.onboarding.form.errorUnsafe
                else if (code === 'SCRAPE_FAILED') {
                    if (data.error?.includes('timed out')) message = t.onboarding.form.errorTimeout
                    else if (data.error?.includes('non-HTML')) message = t.onboarding.form.errorInvalid
                    else message = t.onboarding.form.errorTimeout
                }

                setExtractionError(message)
                return
            }

            const data = await res.json()
            const result = data.data as ExtractionResult

            setExtractionResult(result)

            // Build payload from extraction result
            const extractedInfo: BusinessInfo = {
                businessName: result.businessName || '',
                industry: result.industry || '',
                shortDescription: result.shortDescription || '',
                products: result.products || '',
                language: result.detectedLanguage === 'ms' ? 'ms' : result.detectedLanguage === 'vi' ? 'vi' : 'auto',
                businessUrl: urlValue,
                source: 'url',
            }

            // If all required fields extracted → generate immediately (skip review)
            const canAutoGenerate =
                extractedInfo.businessName.trim().length >= 3 &&
                extractedInfo.industry.trim().length > 0 &&
                extractedInfo.shortDescription.trim().length >= 3 &&
                extractedInfo.products.trim().length >= 3

            if (canAutoGenerate) {
                // Direct generation — no review step needed
                if (onSubmit) {
                    onSubmit(extractedInfo)
                } else {
                    setBusinessInfo(extractedInfo)
                }
                return
            }

            // Fallback: not enough data → show form for user to fill gaps
            setForm((current) => ({
                ...current,
                businessName: result.businessName || current.businessName,
                industry: result.industry || current.industry,
                shortDescription: result.shortDescription || current.shortDescription,
                products: result.products || current.products,
            }))
            setInputMode('manual')
            setErrors({})

        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return
            toast.error(t.onboarding.form.errorGeneric)
        } finally {
            setUrlExtracting(false)
            abortControllerRef.current = null
        }
    }

    const handleSwitchToManual = () => {
        setInputMode('manual')
        setExtractionError(null)
        if (urlExtracting && abortControllerRef.current) {
            abortControllerRef.current.abort()
            setUrlExtracting(false)
        }
    }

    // ── Confidence Badge ─────────────────────────────────────────────────

    const confidenceBadge = extractionResult ? (
        <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
                extractionResult.confidence === 'high'
                    ? 'border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] text-[#86efac]'
                    : extractionResult.confidence === 'medium'
                      ? 'border-[rgba(234,179,8,0.3)] bg-[rgba(234,179,8,0.1)] text-[#fde047]'
                      : 'border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.1)] text-[#fca5a5]'
            }`}
            role="status"
            aria-live="polite"
        >
            <div className="flex items-center justify-between">
                <span className="font-semibold">
                    {extractionResult.confidence === 'high'
                        ? `✅ ${t.onboarding.form.confidenceHigh}`
                        : extractionResult.confidence === 'medium'
                          ? `⚠️ ${t.onboarding.form.confidenceMedium}`
                          : `⚠️ ${t.onboarding.form.confidenceLow}`}
                </span>
                <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={`size-2 rounded-full ${
                                i < (extractionResult.confidence === 'high' ? 3 : extractionResult.confidence === 'medium' ? 2 : 1)
                                    ? extractionResult.confidence === 'high'
                                        ? 'bg-green-400'
                                        : extractionResult.confidence === 'medium'
                                          ? 'bg-yellow-400'
                                          : 'bg-red-400'
                                    : 'bg-white/20'
                            }`}
                        />
                    ))}
                </div>
            </div>
            {extractionResult.confidence === 'low' && (
                <p className="mt-1 text-xs opacity-80">{t.onboarding.form.warningLow}</p>
            )}
            {extractionResult.confidence === 'medium' && (
                <p className="mt-1 text-xs opacity-80">{t.onboarding.form.warningMedium}</p>
            )}
        </div>
    ) : null

    // ── Render ───────────────────────────────────────────────────────────

    const toggleTabs = (
        <div className="mb-6 flex border-b border-white/10" role="tablist" aria-label="Input method selection">
            <button
                role="tab"
                aria-selected={inputMode === 'manual'}
                aria-controls="panel-manual"
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    inputMode === 'manual'
                        ? 'border-b-2 border-blue-500 bg-blue-500/15 text-blue-400 font-semibold'
                        : 'border-b-2 border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-300'
                }`}
                disabled={urlExtracting}
                onClick={() => handleSwitchToManual()}
                type="button"
            >
                ✏️ {t.onboarding.form.tabManual}
            </button>
            <button
                role="tab"
                aria-selected={inputMode === 'url'}
                aria-controls="panel-url"
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    inputMode === 'url'
                        ? 'border-b-2 border-blue-500 bg-blue-500/15 text-blue-400 font-semibold'
                        : 'border-b-2 border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-300'
                }`}
                disabled={urlExtracting}
                onClick={() => {
                    setInputMode('url')
                    setExtractionError(null)
                }}
                type="button"
            >
                🔗 {t.onboarding.form.tabUrl}
            </button>
        </div>
    )

    const urlInputSection = (
        <div id="panel-url" role="tabpanel" aria-labelledby="tab-url">
            <BuilderField icon="🔗" label={t.onboarding.form.urlLabel} required>
                <div className="flex gap-3">
                    <div className="flex-1">
                        <BuilderTextInput
                            invalid={false}
                            onChange={(e) => setUrlValue(e.target.value)}
                            placeholder={t.onboarding.form.urlPlaceholder}
                            type="url"
                            value={urlValue}
                            disabled={urlExtracting}
                            aria-label="Website URL"
                        />
                    </div>
                    <button
                        className="flex h-[44px] min-w-[120px] items-center justify-center gap-2 rounded-xl bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] px-5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!isValidUrl(urlValue) || urlExtracting}
                        onClick={handleUrlExtract}
                        type="button"
                        aria-label={urlExtracting ? t.onboarding.form.extracting : t.onboarding.form.extractButton}
                        aria-busy={urlExtracting}
                    >
                        {urlExtracting ? (
                            <>
                                <span className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                <span>{t.onboarding.form.extracting}</span>
                            </>
                        ) : (
                            <>
                                <span>{t.onboarding.form.extractButton}</span>
                                <span>→</span>
                            </>
                        )}
                    </button>
                </div>
                <p className="mt-2 text-xs text-slate-400">{t.onboarding.form.urlHint}</p>
            </BuilderField>

            {/* Loading skeleton */}
            {urlExtracting && (
                <div className="mt-6 space-y-4">
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-blue-400">
                            <span className="size-4 animate-spin rounded-full border-2 border-blue-400/20 border-t-blue-400" />
                            <span>{t.onboarding.form.analyzingWebsite}</span>
                        </div>
                    </div>
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="space-y-2">
                            <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
                            <div className="h-11 animate-pulse rounded-xl bg-white/5" />
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {extractionError && !urlExtracting && (
                <div className="mt-6 rounded-2xl border border-[rgba(248,113,113,0.35)] bg-[rgba(127,29,29,0.18)] px-4 py-3 text-sm text-[#fecaca]" role="alert">
                    <p>{extractionError}</p>
                    <button
                        className="mt-3 text-sm font-semibold text-white transition-colors hover:text-[#bfdbfe]"
                        onClick={handleSwitchToManual}
                        type="button"
                    >
                        {t.onboarding.form.tryManual} →
                    </button>
                </div>
            )}
        </div>
    )

    const formFields = (
        <div id="panel-manual" role="tabpanel" aria-labelledby="tab-manual">
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

                    {confidenceBadge}

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
        </div>
    )

    const leftBody = (
        <>
            {toggleTabs}
            {inputMode === 'url' ? urlInputSection : formFields}
        </>
    )

    const leftFooter = (
        <BuilderSubmitButton
            disabled={inputMode === 'url' ? false : !isFormReady || isGenerating}
            loading={isGenerating}
            onClick={inputMode === 'url' ? undefined : submitForm}
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
            leftFooter={inputMode === 'manual' ? leftFooter : undefined}
            right={rightPane}
            subtitle={t.onboarding.step1Subtitle}
            title={t.onboarding.step1Title}
        />
    )
}

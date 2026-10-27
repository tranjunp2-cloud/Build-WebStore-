'use client'

import type { FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'
import {
    AlertTriangle,
    ArrowRight,
    Briefcase,
    Building2,
    CalendarHeart,
    CheckCircle2,
    Coffee,
    Dumbbell,
    GraduationCap,
    House,
    Laptop,
    Newspaper,
    Palette,
    Plane,
    Scissors,
    ShoppingBag,
    Stethoscope,
    UtensilsCrossed,
} from 'lucide-react'
import { BuilderField } from '@/components/builder/fields/BuilderField'
import { BuilderOptionCard } from '@/components/builder/fields/BuilderOptionCard'
import { BuilderOptionGrid } from '@/components/builder/fields/BuilderOptionGrid'
import { BuilderSubmitButton } from '@/components/builder/fields/BuilderSubmitButton'
import { BuilderTextInput } from '@/components/builder/fields/BuilderTextInput'
import { BuilderTextarea } from '@/components/builder/fields/BuilderTextarea'
import { BuilderSitePreview } from '@/components/builder/onboarding/BuilderSitePreview'
import { BuilderStepScreen } from '@/components/builder/onboarding/BuilderStepScreen'
import { useBuilderStore, type BusinessInfo } from '@/store/builderStore'
import { useI18n } from '@/i18n'
import SlugPicker from '@/components/onboarding/SlugPicker'
import { ExtractionReview } from '@/components/builder/ExtractionReview'

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
    referenceContent?: Record<string, unknown>
    suggestedTheme?: {
        primaryColor?: string
        secondaryColor?: string
        siteType?: string
        mood?: string
    }
    suggestedBlocks?: string[]
    detectedLanguage: string
    confidence: 'high' | 'medium' | 'low'
}

// Industry values come from TEMPLATE_CATEGORY_OPTIONS (labels carry an emoji the form no longer shows).
const INDUSTRY_ICONS: Record<string, LucideIcon> = {
    restaurant: UtensilsCrossed,
    ecommerce: ShoppingBag,
    beauty: Scissors,
    tech: Laptop,
    health: Stethoscope,
    education: GraduationCap,
    realestate: House,
    fitness: Dumbbell,
    creative: Palette,
    business: Building2,
    fnb: Coffee,
    events: CalendarHeart,
    blog: Newspaper,
    travel: Plane,
}

const FOOD_INDUSTRIES = new Set(['restaurant', 'fnb'])
const MISSING_HINT_ID = 'builder-submit-missing'
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'

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
    const setBusinessInfoDraft = useBuilderStore((s) => s.setBusinessInfoDraft)
    const setContentBrief = useBuilderStore((s) => s.setContentBrief)
    const { t } = useI18n()

    const [form, setForm] = useState<BusinessInfo>({ ...DEFAULT_FORM, ...initialValues })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [industryOptions, setIndustryOptions] = useState<IndustryOption[]>([])
    const [isLoadingIndustries, setIsLoadingIndustries] = useState(true)

    // Slug picker state (F23)
    const [chosenSlug, setChosenSlug] = useState('')
    const [slugAvailable, setSlugAvailable] = useState(true) // true by default — slug is optional

    // Stable callback so SlugPicker's checkAvailability useCallback doesn't
    // invalidate on every BusinessInfoForm re-render (causing redundant API calls).
    const handleSlugChange = useCallback((slug: string, available: boolean) => {
        setChosenSlug(slug)
        setSlugAvailable(available)
    }, [])

    // URL extraction state
    const [inputMode, setInputMode] = useState<'manual' | 'url'>('manual')
    const [urlValue, setUrlValue] = useState('')
    const [urlExtracting, setUrlExtracting] = useState(false)
    const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)
    const [extractionError, setExtractionError] = useState<string | null>(null)
    const [showReview, setShowReview] = useState(false)
    const abortControllerRef = useRef<AbortController | null>(null)

    const isFormReady =
        form.businessName.trim().length >= 3 &&
        form.industry.trim().length > 0 &&
        form.shortDescription.trim().length >= 3 &&
        form.products.trim().length >= 3 &&
        slugAvailable // true by default; only false if user entered an unavailable slug

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
            ...(chosenSlug ? { slug: chosenSlug } : {}),
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

            // Store ContentBrief in Zustand for generator to use
            setContentBrief({
                businessInfo: {
                    businessName: result.businessName || '',
                    industry: result.industry || '',
                    shortDescription: result.shortDescription || '',
                    products: result.products || '',
                },
                referenceContent: result.referenceContent || {},
                visualStyle: {
                    primaryColor: result.suggestedTheme?.primaryColor,
                    secondaryColor: result.suggestedTheme?.secondaryColor,
                    mood: result.suggestedTheme?.mood,
                },
                suggestedBlocks: result.suggestedBlocks,
                source: 'url',
                sourceUrl: urlValue,
                language: result.detectedLanguage || 'en',
                confidence: result.confidence,
            })

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

            // If all required fields extracted → show review step before applying
            const canAutoGenerate =
                extractedInfo.businessName.trim().length >= 3 &&
                extractedInfo.industry.trim().length > 0 &&
                extractedInfo.shortDescription.trim().length >= 3 &&
                extractedInfo.products.trim().length >= 3

            if (canAutoGenerate) {
                // Show review step instead of auto-generating
                setShowReview(true)
                return
            }

            // Fallback: not enough data → show form for user to fill gaps
            const partialData = {
                businessName: result.businessName || '',
                industry: result.industry || '',
                shortDescription: result.shortDescription || '',
                products: result.products || '',
            }
            setForm((current) => ({
                ...current,
                ...partialData,
            }))
            // Persist to Zustand store so data survives HMR/re-renders
            setBusinessInfoDraft(partialData)
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
                <span className="flex items-center gap-1.5 font-semibold">
                    {extractionResult.confidence === 'high' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" aria-hidden />
                    ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" aria-hidden />
                    )}
                    {extractionResult.confidence === 'high'
                        ? t.onboarding.form.confidenceHigh
                        : extractionResult.confidence === 'medium'
                          ? t.onboarding.form.confidenceMedium
                          : t.onboarding.form.confidenceLow}
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

    // Hidden: this was the only tab left (the URL import tab is already hidden) and it did nothing.
    // Restore together with `Pencil` in the lucide-react import and `{toggleTabs}` in `leftBody`.
    /*
    const toggleTabs = (
        <div className="mb-6 flex" role="tablist" aria-label="Input method selection">
            <button
                role="tab"
                aria-selected={true}
                className="flex-1 px-4 py-3 text-sm font-medium transition-colors rounded-2xl bg-blue-500/15 text-blue-400 font-semibold"
                type="button"
            >
                <span className="inline-flex items-center justify-center gap-2">
                    <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                    {t.onboarding.form.tabManual}
                </span>
            </button>
        </div>
    )
    */

    const urlInputSection = (
        <div id="panel-url" role="tabpanel" aria-labelledby="tab-url">
            <BuilderField label={t.onboarding.form.urlLabel} required>
                <div className="flex gap-3">
                    <div className="flex-1">
                        <BuilderTextInput
                            invalid={false}
                            onChange={(e) => setUrlValue(e.target.value)}
                            placeholder={t.onboarding.form.urlPlaceholder}
                            type="url"
                            value={urlValue}
                            disabled={urlExtracting}
                            aria-label={t.onboarding.form.urlLabel}
                        />
                    </div>
                    <button
                        className="flex h-[44px] min-w-[120px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors duration-200 bg-[hsl(var(--p-teal-400))] text-[hsl(var(--p-slate-950))] hover:bg-[color:color-mix(in_srgb,hsl(var(--p-teal-400))_90%,black)] active:bg-[color:color-mix(in_srgb,hsl(var(--p-teal-400))_80%,black)] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!isValidUrl(urlValue) || urlExtracting}
                        onClick={handleUrlExtract}
                        type="button"
                        aria-label={urlExtracting ? t.onboarding.form.extracting : t.onboarding.form.extractButton}
                        aria-busy={urlExtracting}
                    >
                        {urlExtracting ? (
                            <>
                                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                <span>{t.onboarding.form.extracting}</span>
                            </>
                        ) : (
                            <>
                                <span>{t.onboarding.form.extractButton}</span>
                                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
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

            {/* Extraction Review */}
            {showReview && extractionResult && !urlExtracting && (
                <div className="mt-6">
                    <ExtractionReview
                        extractedData={{
                            businessName: extractionResult.businessName || '',
                            industry: extractionResult.industry || '',
                            shortDescription: extractionResult.shortDescription || '',
                            products: extractionResult.products || '',
                        }}
                        onApply={(data) => {
                            const payload: BusinessInfo = {
                                ...form,
                                ...data,
                                businessUrl: urlValue,
                                source: 'url',
                                ...(chosenSlug ? { slug: chosenSlug } : {}),
                            }
                            setShowReview(false)
                            if (onSubmit) {
                                onSubmit(payload)
                            } else {
                                setBusinessInfo(payload)
                            }
                        }}
                        onSkip={() => {
                            setShowReview(false)
                            setInputMode('manual')
                            if (extractionResult) {
                                setForm((current) => ({
                                    ...current,
                                    businessName: extractionResult.businessName || current.businessName,
                                    industry: extractionResult.industry || current.industry,
                                    shortDescription: extractionResult.shortDescription || current.shortDescription,
                                    products: extractionResult.products || current.products,
                                }))
                            }
                        }}
                    />
                </div>
            )}

            {/* Error */}
            {extractionError && !urlExtracting && (
                <div className="mt-6 rounded-2xl border border-[rgba(248,113,113,0.35)] bg-[rgba(127,29,29,0.18)] px-4 py-3 text-sm text-[#fecaca]" role="alert">
                    <p>{extractionError}</p>
                    <button
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white transition-colors hover:text-[#bfdbfe]"
                        onClick={handleSwitchToManual}
                        type="button"
                    >
                        {t.onboarding.form.tryManual}
                        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                    </button>
                </div>
            )}
        </div>
    )

    const formFields = (
        <div>
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

                    {/* F23: Slug picker — auto-generate from business name */}
                    {form.businessName.trim().length >= 3 && (
                        <SlugPicker
                            businessName={form.businessName}
                            onSlugChange={handleSlugChange}
                            skipInitialCheck={!!initialValues?.businessName}
                        />
                    )}

                    <BuilderField
                        error={errors.industry}
                        label={t.onboarding.form.industry}
                        required
                    >
                        <BuilderOptionGrid>
                            {industryOptions.map((option) => {
                                const i18nLabels = (t.onboarding.form as Record<string, unknown>).industryOptions as Record<string, string> | undefined
                                const translatedLabel = i18nLabels?.[option.value] || option.label
                                const Icon = INDUSTRY_ICONS[option.value] ?? Briefcase
                                return (
                                    <BuilderOptionCard
                                        icon={<Icon />}
                                        key={option.value}
                                        label={translatedLabel}
                                        onClick={() => setForm((current) => ({ ...current, industry: option.value }))}
                                        selected={form.industry === option.value}
                                    />
                                )
                            })}
                        </BuilderOptionGrid>
                        {isLoadingIndustries ? (
                            <p className="text-xs text-[#94a3b8]">{t.onboarding.form.loadingIndustries}</p>
                        ) : null}
                    </BuilderField>

                    <BuilderField
                        hint={t.onboarding.form.productsHint}
                        error={errors.products}
                        label={t.onboarding.form.products}
                        required
                    >
                        <BuilderTextarea
                            invalid={!!errors.products}
                            onChange={(e) => setForm((current) => ({ ...current, products: e.target.value }))}
                            placeholder={t.onboarding.form.productsPlaceholder}
                            rows={3}
                            value={form.products}
                        />
                    </BuilderField>

                    <BuilderField
                        hint={t.onboarding.form.shortDescriptionHint}
                        error={errors.shortDescription}
                        label={t.onboarding.form.shortDescription}
                        required
                    >
                        <BuilderTextarea
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
            {/* {toggleTabs} */}
            {formFields}
        </>
    )

    // First thing still missing, in form order — shown under the disabled button.
    const missing = t.onboarding.form.missing
    const missingHint = isGenerating ? null
        : form.businessName.trim().length < 3 ? missing.businessName
        : !form.industry.trim() ? missing.industry
        : form.products.trim().length < 3 ? missing.products
        : form.shortDescription.trim().length < 3 ? missing.shortDescription
        : !slugAvailable ? missing.slug
        : null

    const leftFooter = (
        <div className="flex flex-col gap-2">
            <BuilderSubmitButton
                describedBy={missingHint ? MISSING_HINT_ID : undefined}
                disabled={!isFormReady || isGenerating}
                loading={isGenerating}
                onClick={submitForm}
                type="button"
            >
                {t.onboarding.form.generateButton}
            </BuilderSubmitButton>
            {missingHint ? (
                <p className="text-center text-xs leading-4 text-[#94a3b8]" id={MISSING_HINT_ID} aria-live="polite">
                    {missingHint}
                </p>
            ) : null}
        </div>
    )

    const preview = t.onboarding.form.preview
    const isFood = FOOD_INDUSTRIES.has(form.industry)
    const rightPane = (
        <BuilderSitePreview
            businessName={form.businessName}
            domain={PLATFORM_DOMAIN}
            labels={{
                caption: preview.caption,
                placeholderName: preview.placeholderName,
                placeholderSlug: preview.placeholderSlug,
                textNote: preview.textNote,
                itemsTitle: isFood ? preview.menuTitle : preview.productsTitle,
                nav: [
                    preview.navHome,
                    isFood ? preview.menuTitle : preview.productsTitle,
                    preview.navGallery,
                    preview.navAbout,
                    preview.navContact,
                    preview.navBlog,
                ],
            }}
            products={form.products}
            slug={form.businessName.trim().length >= 3 ? chosenSlug : ''}
        />
    )

    return (
        <BuilderStepScreen
            leftBody={leftBody}
            leftFooter={leftFooter}
            right={rightPane}
            subtitle={t.onboarding.step1Subtitle}
            title={t.onboarding.step1Title}
        />
    )
}

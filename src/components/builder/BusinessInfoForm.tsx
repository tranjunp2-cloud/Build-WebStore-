'use client'

import type { FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react'
import { BuilderField } from '@/components/builder/fields/BuilderField'
import { BuilderOptionCard } from '@/components/builder/fields/BuilderOptionCard'
import { BuilderOptionGrid } from '@/components/builder/fields/BuilderOptionGrid'
import { BuilderSubmitButton } from '@/components/builder/fields/BuilderSubmitButton'
import { BuilderTextInput } from '@/components/builder/fields/BuilderTextInput'
import { BuilderTextarea } from '@/components/builder/fields/BuilderTextarea'
import { BuilderBlueprintPreview } from '@/components/builder/onboarding/BuilderBlueprintPreview'
import type { BlueprintField } from '@/components/builder/onboarding/builder-blueprint-styles'
import { getIndustryIcon } from '@/components/builder/fields/industry-icons'
import { getPreviewSiteHost } from '@/components/builder/builder-site-host'
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

const BUILDER_TEXTAREA_HINT_ICON_URL = '/assets/builder/builder-hint-icon.svg'

interface BusinessInfoFormProps {
    onSubmit?: (info: BusinessInfo) => void
    onRetry?: (info: BusinessInfo) => void
    errorMessage?: string | null
    isGenerating?: boolean
    initialValues?: Partial<BusinessInfo> | null
}

/**
 * The form has no optional facts fields (#2176: matches the approved prototype #2042), so values an
 * older draft may still carry (how customers buy, areas served, shop facts) never leave the form.
 */
function withoutOptionalFacts(info: BusinessInfo): BusinessInfo {
    const { buyingMethods: _buying, serviceArea: _area, shopFacts: _facts, ...rest } = info
    return rest
}

/** How many real items of a list the extraction found on the page. */
function countExtracted(referenceContent: Record<string, unknown> | undefined, key: string): number {
    const list = referenceContent?.[key]
    return Array.isArray(list) ? list.length : 0
}

type ValidatedField = 'businessName' | 'industry' | 'products' | 'shortDescription'

// On-screen order: the first invalid field in this list gets focus when Generate is clicked.
const VALIDATED_FIELDS: ValidatedField[] = ['businessName', 'industry', 'products', 'shortDescription']
const MIN_TEXT_LENGTH = 3

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
    const { t, ti } = useI18n()

    const industryLabel = (value: string) => {
        const i18nLabels = (t.onboarding.form as Record<string, unknown>).industryOptions as Record<string, string> | undefined
        return i18nLabels?.[value] || industryOptions.find((option) => option.value === value)?.label || value
    }

    const [form, setForm] = useState<BusinessInfo>({ ...DEFAULT_FORM, ...initialValues })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [industryOptions, setIndustryOptions] = useState<IndustryOption[]>([])
    const [isLoadingIndustries, setIsLoadingIndustries] = useState(true)
    // Drives the live blueprint on the right: focused field glows, hovered industry previews.
    const [focusedField, setFocusedField] = useState<BlueprintField | null>(null)
    // Only a real mouse hovering the industry grid previews an option (see previewIndustry below).
    const [hoveredIndustry, setHoveredIndustry] = useState<string | null>(null)
    const blurField = () => setFocusedField(null)

    // Slug picker state (F23)
    const [chosenSlug, setChosenSlug] = useState('')
    const [slugAvailable, setSlugAvailable] = useState(true) // true by default — slug is optional

    // Stable callback so SlugPicker's checkAvailability useCallback doesn't
    // invalidate on every BusinessInfoForm re-render (causing redundant API calls).
    const handleSlugChange = useCallback((slug: string, available: boolean) => {
        setChosenSlug(slug)
        setSlugAvailable(available)
    }, [])

    // URL extraction state. Hidden on purpose (5fac488e9, #1357, #2176): nothing switches `inputMode` to 'url', so the
    // import section below (`urlInputSection`, `handleSwitchToManual`, ExtractionReview) is kept but never rendered.
    // To bring the link import back, render a tab that calls setInputMode('url') and show `urlInputSection` for it.
    const [inputMode, setInputMode] = useState<'manual' | 'url'>('manual')
    const [urlValue, setUrlValue] = useState('')
    const [urlExtracting, setUrlExtracting] = useState(false)
    const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)
    const [extractionError, setExtractionError] = useState<string | null>(null)
    const [showReview, setShowReview] = useState(false)
    const abortControllerRef = useRef<AbortController | null>(null)

    const formRef = useRef<HTMLFormElement>(null)

    // Empty or spaces only → the field's "required" message; 1–2 characters → the min-length message.
    const getFieldError = (field: ValidatedField, value: string): string | undefined => {
        const messages = t.onboarding.form.errors
        const trimmed = value.trim()
        if (!trimmed) return messages[field]
        if (field !== 'industry' && trimmed.length < MIN_TEXT_LENGTH) return messages.minLength.replace('{count}', String(MIN_TEXT_LENGTH))
        return undefined
    }

    const setFieldError = (field: ValidatedField, value: string) => {
        const message = getFieldError(field, value)
        setErrors((current) => {
            if (current[field] === message) return current
            const next = { ...current }
            if (message) next[field] = message
            else delete next[field]
            return next
        })
    }

    // Leaving a text field shows its error right away (#2159).
    const handleTextBlur = (field: ValidatedField, value: string) => {
        blurField()
        setFieldError(field, value)
    }

    // While typing, only a field that already shows an error is re-checked, so it clears once fixed.
    const handleTextChange = (field: ValidatedField, value: string) => {
        setForm((current) => ({ ...current, [field]: value }))
        if (errors[field]) setFieldError(field, value)
        // SlugPicker unmounts below the minimum, so its last answer no longer applies. Without this reset a
        // stale "taken" could block Generate with no message once the picker skips its first check again.
        if (field === 'businessName' && value.trim().length < MIN_TEXT_LENGTH) {
            setSlugAvailable(true)
            setChosenSlug('')
        }
    }

    const focusField = (field: ValidatedField | 'slug') => {
        const wrapper = formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)
        if (!wrapper) return
        // Text fields carry data-field themselves; the industry grid and slug picker wrap their controls.
        const control = wrapper.matches('input, textarea') ? wrapper : wrapper.querySelector<HTMLElement>('input, button')
        if (control) control.focus()
        else wrapper.scrollIntoView?.({ block: 'center' }) // e.g. industry options not loaded
    }

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
        // New values (e.g. a recovered draft) — drop messages that described the old ones.
        setErrors({})
    }, [
        initialValues?.businessName,
        initialValues?.shortDescription,
        initialValues?.industry,
        initialValues?.products,
        initialValues?.language,
    ])

    /** Shows every field error at once; returns the first invalid field (on-screen order), or null. */
    const validate = (): ValidatedField | null => {
        const nextErrors: Record<string, string> = {}

        for (const field of VALIDATED_FIELDS) {
            const message = getFieldError(field, form[field])
            if (message) nextErrors[field] = message
        }

        setErrors(nextErrors)
        return VALIDATED_FIELDS.find((field) => nextErrors[field]) ?? null
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        submitForm()
    }

    const submitForm = () => {
        if (isGenerating) return

        const firstInvalid = validate()
        if (firstInvalid) {
            focusField(firstInvalid)
            return
        }
        // A taken/invalid slug: SlugPicker shows its own message — bring it into view.
        if (!slugAvailable) {
            focusField('slug')
            return
        }

        const payload: BusinessInfo = withoutOptionalFacts({
            ...form,
            ...(extractionResult ? { businessUrl: urlValue, source: 'url' as const } : { source: 'form' as const }),
            ...(chosenSlug ? { slug: chosenSlug } : {}),
        })

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

    // No input-method tabs: the URL import tab stays hidden (5fac488e9, #1357) and a lone
    // "Describe business" tab did nothing, so the form starts at the first field (#2176).
    // Kept for the hidden link import (see `inputMode`): defined, not rendered.
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
                        faqCount={countExtracted(extractionResult.referenceContent, 'faqItems')}
                        testimonialCount={countExtracted(extractionResult.referenceContent, 'testimonials')}
                        onApply={(data) => {
                            const payload: BusinessInfo = withoutOptionalFacts({
                                ...form,
                                ...data,
                                businessUrl: urlValue,
                                source: 'url',
                                ...(chosenSlug ? { slug: chosenSlug } : {}),
                            })
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
            {/* focus moving anywhere in the form (Tab, a field, a card) ends an industry hover preview */}
            <form onFocusCapture={() => setHoveredIndustry(null)} onSubmit={handleSubmit} ref={formRef}>
                <div className="flex flex-col gap-6">
                    {errorMessage ? (
                        <div className="rounded-2xl border border-[rgba(248,113,113,0.35)] bg-[rgba(127,29,29,0.18)] px-4 py-3 text-sm text-[#fecaca]">
                            <p>{errorMessage}</p>
                            {onRetry ? (
                                <button
                                    className="mt-3 text-sm font-semibold text-white transition-colors hover:text-[#bfdbfe]"
                                    onClick={() => onRetry(withoutOptionalFacts(form))}
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
                            data-field="businessName"
                            onBlur={(e) => handleTextBlur('businessName', e.target.value)}
                            onChange={(e) => handleTextChange('businessName', e.target.value)}
                            onFocus={() => setFocusedField('businessName')}
                            placeholder={t.onboarding.form.businessNamePlaceholder}
                            type="text"
                            value={form.businessName}
                        />
                    </BuilderField>

                    {/* F23: Slug picker — auto-generate from business name */}
                    {form.businessName.trim().length >= MIN_TEXT_LENGTH && (
                        <div data-field="slug">
                            <SlugPicker
                                businessName={form.businessName}
                                onSlugChange={handleSlugChange}
                                skipInitialCheck={!!initialValues?.businessName}
                            />
                        </div>
                    )}

                    <BuilderField
                        error={errors.industry}
                        label={t.onboarding.form.industry}
                        required
                    >
                        <div data-field="industry">
                            <BuilderOptionGrid onPointerLeave={() => setHoveredIndustry(null)}>
                                {industryOptions.map((option) => (
                                    <BuilderOptionCard
                                        icon={getIndustryIcon(option.value)}
                                        key={option.value}
                                        label={industryLabel(option.value)}
                                        onClick={() => {
                                            setForm((current) => ({ ...current, industry: option.value }))
                                            setFieldError('industry', option.value)
                                            setHoveredIndustry(null)
                                        }}
                                        // touch/pen taps fire emulated hover that never clears — only a mouse previews
                                        onPointerEnter={(event) => {
                                            if (event.pointerType === 'mouse') setHoveredIndustry(option.value)
                                        }}
                                        onPointerLeave={() => setHoveredIndustry((current) => (current === option.value ? null : current))}
                                        selected={form.industry === option.value}
                                    />
                                ))}
                            </BuilderOptionGrid>
                        </div>
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
                        label={t.onboarding.form.products}
                        required
                    >
                        <BuilderTextarea
                            invalid={!!errors.products}
                            data-field="products"
                            onBlur={(e) => handleTextBlur('products', e.target.value)}
                            onChange={(e) => handleTextChange('products', e.target.value)}
                            onFocus={() => setFocusedField('products')}
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
                        label={t.onboarding.form.shortDescription}
                        required
                    >
                        <BuilderTextarea
                            invalid={!!errors.shortDescription}
                            data-field="shortDescription"
                            onBlur={(e) => handleTextBlur('shortDescription', e.target.value)}
                            onChange={(e) => handleTextChange('shortDescription', e.target.value)}
                            onFocus={() => setFocusedField('shortDescription')}
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
            {formFields}
        </>
    )

    const leftFooter = (
        <BuilderSubmitButton
            // Clickable while invalid on purpose: a click shows every field error (US-F01-05 AC-2, #2159).
            disabled={isGenerating}
            loading={isGenerating}
            onClick={submitForm}
            type="button"
        >
            {t.onboarding.form.generateButton}
        </BuilderSubmitButton>
    )

    // A mouse over the grid previews that industry in the blueprint; otherwise (touch, pointer elsewhere,
    // after a click or a focus change) the selection shows — never a stale hover (#2103 A6).
    const previewIndustry = hoveredIndustry && hoveredIndustry !== form.industry ? hoveredIndustry : form.industry
    const siteHost = getPreviewSiteHost(form.businessName, chosenSlug)

    const rightPane = (
        <BuilderBlueprintPreview
            businessName={form.businessName}
            caption={t.onboarding.form.blueprintCaption}
            countLabel={(count) => ti(t.onboarding.form.blueprintCount, { count })}
            description={t.onboarding.form.promoDescription}
            errors={errors}
            focus={focusedField}
            industry={form.industry}
            industryHovered={!!hoveredIndustry && hoveredIndustry !== form.industry}
            industryIcon={getIndustryIcon(previewIndustry)}
            industryLabel={previewIndustry ? industryLabel(previewIndustry) : t.onboarding.form.industry}
            labels={{
                businessName: t.onboarding.form.businessName,
                products: t.onboarding.form.products,
                shortDescription: t.onboarding.form.shortDescription,
            }}
            products={form.products}
            readyCaption={t.onboarding.form.blueprintReady}
            shortDescription={form.shortDescription}
            siteHost={siteHost}
            steps={[t.onboarding.form.promoStep1, t.onboarding.form.promoStep2, t.onboarding.form.promoStep3]}
            title={t.onboarding.form.promoTitle}
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

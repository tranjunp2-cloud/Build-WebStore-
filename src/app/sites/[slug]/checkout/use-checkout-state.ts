'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'
import { trackEvent } from '@/lib/analytics/track-event'
import { type CheckoutForm, validateEmail, validatePhone, validatePaymentProof } from '@/lib/storefront'
import { resolveTheme, generateThemeCSS } from '@/lib/theme/resolve'

export type GeoState = { id: number; name: string; state_code: string; zone: string }
export type GeoDistrict = { id: number; name: string }

export type ShippingConfig = {
    westRate: number | null
    eastRate: number | null
    freeAbove: number | null
}

export type InitialSiteData = {
    siteId: string
    tenantId: string
    enableCod: boolean
    enableQrBanking: boolean
    shippingConfig: ShippingConfig | null
    stripeEnabled: boolean
}

export const initialForm: CheckoutForm = {
    name: '', email: '', phone: '', line1: '', line2: '', city: '', state: '', postcode: '',
}

type UseCheckoutStateArgs = {
    slug: string
    initialThemeCSS: string
    initialFontHeading: string
    initialFontBody: string
    initialSiteData: InitialSiteData | null
}

export function useCheckoutState({
    slug,
    initialThemeCSS,
    initialFontHeading,
    initialFontBody,
    initialSiteData,
}: UseCheckoutStateArgs) {

    const router = useRouter()
    const { items, subtotal, clearCart } = useCartStore()

    const [siteId, setSiteId] = useState(initialSiteData?.siteId ?? '')
    const [isOwner, setIsOwner] = useState(false)

    const sc = initialSiteData?.shippingConfig
    const [enableCod, setEnableCod] = useState(initialSiteData?.enableCod ?? true)
    const [enableQrBanking, setEnableQrBanking] = useState(initialSiteData?.enableQrBanking ?? true)
    const [shippingWestRM, setShippingWestRM] = useState((sc?.westRate ?? 800) / 100)
    const [shippingEastRM, setShippingEastRM] = useState((sc?.eastRate ?? 1500) / 100)
    const [freeAboveRM, setFreeAboveRM] = useState<number | null>(
        sc?.freeAbove != null ? sc.freeAbove / 100 : null
    )
    const [showStripe, setShowStripe] = useState(initialSiteData?.stripeEnabled ?? false)

    const [form, setForm] = useState<CheckoutForm>(initialForm)
    const [states, setStates] = useState<GeoState[]>([])
    const [statesLoading, setStatesLoading] = useState(true)
    const [selectedStateId, setSelectedStateId] = useState('')
    const [districts, setDistricts] = useState<GeoDistrict[]>([])
    const [districtsLoading, setDistrictsLoading] = useState(false)
    const [selectedDistrictId, setSelectedDistrictId] = useState('')
    const [postcodeOpts, setPostcodeOpts] = useState<string[]>([])
    const [postcodesLoading, setPostcodesLoading] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bank_transfer' | 'stripe'>('cod')
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [proofPreview, setProofPreview] = useState<string | null>(null)
    const [proofError, setProofError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [mounted, setMounted] = useState(false)
    const [isPlacing, setIsPlacing] = useState(false)
    const [showOverlay, setShowOverlay] = useState(false)
    const [overlayTakingLong, setOverlayTakingLong] = useState(false)
    const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const longTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({})
    const [themeCSS, setThemeCSS] = useState(initialThemeCSS)
    const [fontHeading, setFontHeading] = useState(initialFontHeading)
    const [fontBody, setFontBody] = useState(initialFontBody)

    useEffect(() => { setMounted(true) }, [])

    useEffect(() => {
        fetch('/api/geo/states')
            .then(r => r.json())
            .then(data => setStates(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setStatesLoading(false))
    }, [])

    useEffect(() => {
        if (!slug) return

        const checkOwner = async (tenantId: string) => {
            try {
                const meRes = await fetch('/api/users/me')
                if (meRes.ok) {
                    const meData = await meRes.json()
                    const tenantIds = (meData.user?.tenants ?? []).map(
                        (tnt: { tenant: string | { id: string } }) =>
                            typeof tnt.tenant === 'object' ? String(tnt.tenant.id) : String(tnt.tenant)
                    )
                    setIsOwner(tenantIds.includes(tenantId))
                }
            } catch { }
        }

        if (initialSiteData) {
            checkOwner(initialSiteData.tenantId)
            return
        }

        async function fetchSite() {
            try {
                const res = await fetch(`/api/storefront/site-by-slug?slug=${encodeURIComponent(slug)}`)
                if (!res.ok) { setError('Unable to load store. Please refresh.'); return }
                const data = await res.json()
                if (data.siteId) setSiteId(String(data.siteId))
                if (data.enableCod === false) { setEnableCod(false); setPaymentMethod('bank_transfer') }
                if (data.enableQrBanking === false) setEnableQrBanking(false)
                if (data.shippingConfig) {
                    const s = data.shippingConfig
                    if (s.westRate != null) setShippingWestRM(s.westRate / 100)
                    if (s.eastRate != null) setShippingEastRM(s.eastRate / 100)
                    setFreeAboveRM(s.freeAbove != null ? s.freeAbove / 100 : null)
                }
                if (data.stripeEnabled === true) setShowStripe(true)
                if (data.theme) {
                    if (data.theme.fontHeading) setFontHeading(data.theme.fontHeading)
                    if (data.theme.fontBody) setFontBody(data.theme.fontBody)
                    const resolved = resolveTheme({
                        primaryColor: data.theme.primaryColor,
                        secondaryColor: data.theme.secondaryColor,
                        accentColor: data.theme.accentColor,
                        surfaceColor: data.theme.surfaceColor,
                        textColor: data.theme.textColor,
                        mutedColor: data.theme.mutedColor,
                        fontPairingId: data.theme.fontPairingId,
                        fontHeading: data.theme.fontHeading,
                        fontBody: data.theme.fontBody,
                        colorMode: data.theme.colorMode,
                        backgroundColor: data.theme.backgroundColor,
                    })
                    setThemeCSS(generateThemeCSS(resolved))
                }
                checkOwner(String(data.tenantId))
            } catch { }
        }
        fetchSite()
    }, [slug, initialSiteData])

    // ── Computed values ──────────────────────────────────────────────
    const currency = items[0]?.currency || 'MYR'
    const sub = subtotal()
    const selectedState = states.find(s => s.id === Number(selectedStateId))
    const baseShipping = sub > 0 ? (selectedState?.zone === 'east' ? shippingEastRM : shippingWestRM) : 0
    const shippingFee = freeAboveRM !== null && sub >= freeAboveRM ? 0 : baseShipping
    const tax = Math.round(sub * 0.06 * 100) / 100
    const total = sub + shippingFee + tax

    // ── Field handlers ───────────────────────────────────────────────
    const updateField = useCallback((field: keyof CheckoutForm, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
        if (field === 'email' || field === 'phone') {
            setFieldErrors(prev => ({ ...prev, [field]: undefined }))
        }
    }, [])

    const handleEmailBlur = useCallback(() => {
        const err = validateEmail(form.email)
        if (err) setFieldErrors(prev => ({ ...prev, email: err }))
    }, [form.email])

    const handlePhoneBlur = useCallback(() => {
        const err = validatePhone(form.phone)
        if (err) setFieldErrors(prev => ({ ...prev, phone: err }))
    }, [form.phone])

    const handleStateChange = useCallback((stateId: string) => {
        setSelectedStateId(stateId)
        const st = states.find(s => s.id === Number(stateId))
        setForm(prev => ({ ...prev, state: st?.name || '', city: '', postcode: '' }))
        setSelectedDistrictId('')
        setDistricts([])
        setPostcodeOpts([])
        if (!stateId) return
        setDistrictsLoading(true)
        fetch(`/api/geo/districts?stateId=${stateId}`)
            .then(r => r.json())
            .then(data => setDistricts(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setDistrictsLoading(false))
    }, [states])

    const handleDistrictChange = useCallback((districtId: string) => {
        setSelectedDistrictId(districtId)
        const d = districts.find(dist => dist.id === Number(districtId))
        setForm(prev => ({ ...prev, city: d?.name || '', postcode: '' }))
        setPostcodeOpts([])
        if (!districtId) return
        setPostcodesLoading(true)
        fetch(`/api/geo/postcodes?districtId=${districtId}`)
            .then(r => r.json())
            .then(data => setPostcodeOpts(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setPostcodesLoading(false))
    }, [districts])

    const handleProofUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, invalidImageMsg: string, fileTooLargeMsg: string) => {
        const file = e.target.files?.[0]
        setProofError(null)
        if (!file) return
        const proofErr = validatePaymentProof(file)
        if (proofErr === 'INVALID_TYPE') {
            setProofError(invalidImageMsg); setProofFile(null); setProofPreview(null); return
        }
        if (proofErr === 'FILE_TOO_LARGE') {
            setProofError(fileTooLargeMsg); setProofFile(null); setProofPreview(null); return
        }
        setProofFile(file)
        const reader = new FileReader()
        reader.onloadend = () => setProofPreview(reader.result as string)
        reader.readAsDataURL(file)
    }, [])

    const removeProof = useCallback(() => {
        setProofFile(null); setProofPreview(null); setProofError(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }, [])

    // ── Derived booleans ─────────────────────────────────────────────
    const contactVerified = form.name.trim().length > 0 && form.email.trim().length > 0 && !fieldErrors.email && !fieldErrors.phone

    const canPlaceOrder = Boolean(
        siteId && form.name.trim() && form.email.trim() &&
        form.line1.trim() && form.city && form.postcode && items.length > 0 &&
        (paymentMethod === 'cod' || paymentMethod === 'bank_transfer' || paymentMethod === 'stripe')
    )

    // ── Overlay helpers ──────────────────────────────────────────────
    const dismissOverlay = useCallback(() => {
        if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current)
        if (longTimerRef.current) clearTimeout(longTimerRef.current)
        setShowOverlay(false)
        setOverlayTakingLong(false)
    }, [])

    // ── Place order ──────────────────────────────────────────────────
    const handlePlaceOrder = useCallback(async (networkErrorMsg: string) => {
        if (!canPlaceOrder) return
        setIsPlacing(true)
        let navigatedToConfirm = false
        overlayTimerRef.current = setTimeout(() => {
            setShowOverlay(true)
            longTimerRef.current = setTimeout(() => setOverlayTakingLong(true), 10000)
        }, 300)
        try {
            if (paymentMethod === 'stripe') {
                const stripePayload = {
                    siteId,
                    items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
                    customer: {
                        name: form.name, email: form.email, phone: form.phone,
                        address: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, postcode: form.postcode, country: 'Malaysia' },
                    },
                }
                const res = await fetch('/api/orders/stripe-checkout', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stripePayload),
                })
                const data = await res.json()
                dismissOverlay()
                if (res.ok && data.success && data.data.sessionUrl) {
                    clearCart()
                    navigatedToConfirm = true
                    window.location.href = data.data.sessionUrl
                } else {
                    toast.error(data.error?.message || 'Failed to initialize payment')
                }
                return
            }

            const checkoutPayload: Record<string, unknown> = {
                siteId,
                items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
                customer: {
                    name: form.name, email: form.email, phone: form.phone,
                    address: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, postcode: form.postcode, country: 'Malaysia' },
                },
                paymentMethod,
            }

            const res = await fetch('/api/orders/checkout', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(checkoutPayload),
            })
            const data = await res.json()

            if (res.ok && data.success) {
                if (siteId) {
                    trackEvent({ siteId, event: 'purchase', isOwner, metadata: {
                        orderNumber: data.data.orderNumber, total: data.data.total,
                        currency: data.data.currency, itemCount: items.length,
                    }})
                }
                const confirmUrl = `/sites/${slug}/order/${data.data.orderId}/confirm`
                dismissOverlay()
                navigatedToConfirm = true
                clearCart()
                if ('startViewTransition' in document) {
                    document.startViewTransition(() => { router.push(confirmUrl) })
                } else {
                    router.push(confirmUrl)
                }
            } else {
                dismissOverlay()
                toast.error(data.error?.message || 'Failed to place order')
            }
        } catch (err: unknown) {
            dismissOverlay()
            toast.error(err instanceof Error ? err.message : networkErrorMsg)
        } finally {
            if (!navigatedToConfirm) setIsPlacing(false)
        }
    }, [canPlaceOrder, paymentMethod, siteId, items, form, slug, isOwner, clearCart, dismissOverlay, router])

    return {
        // state
        siteId, isOwner, mounted, isPlacing, showOverlay, overlayTakingLong, error,
        // form
        form, fieldErrors, contactVerified, canPlaceOrder,
        // payment
        paymentMethod, setPaymentMethod, showStripe, enableCod, enableQrBanking,
        // address
        states, statesLoading, selectedStateId, districts, districtsLoading,
        selectedDistrictId, postcodeOpts, postcodesLoading,
        // shipping computed
        currency, sub, selectedState, shippingFee, tax, total, freeAboveRM,
        // proof upload
        proofFile, proofPreview, proofError, fileInputRef,
        // theme
        themeCSS, fontHeading, fontBody,
        // handlers
        updateField, handleEmailBlur, handlePhoneBlur,
        handleStateChange, handleDistrictChange,
        handleProofUpload, removeProof,
        dismissOverlay, handlePlaceOrder,
        setIsPlacing,
    }
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { Tag, Loader2, Check, X, Info } from 'lucide-react'
import { useI18n } from '@/i18n'

type AppliedDiscount = { code: string; type: 'percentage' | 'fixed'; value: number }
type Phase = 'empty' | 'applying' | 'applied' | 'rejected'

type Props = {
    siteSlug: string
    /** Resolved site id — lets the preview honour site-scoped discounts (matches the checkout routes). */
    siteId?: string | number
    subtotalSen: number
    onApplied: (discount: AppliedDiscount, discountSen: number) => void
    onRemoved: () => void
    appliedDiscount: AppliedDiscount | null
    /** Rejection pushed from the parent (e.g. Place Order returned DISCOUNT_EXHAUSTED): the discount the
     *  buyer applied sold out at checkout. When set, the field shows it inline below the input (#10). */
    externalReject?: string | null
}

export function CheckoutDiscountField({ siteSlug, siteId, subtotalSen, onApplied, onRemoved, appliedDiscount, externalReject }: Props) {
    const { t, ti } = useI18n()
    const dc = t.storefront.checkout.discount
    const [code, setCode] = useState('')
    const [phase, setPhase] = useState<Phase>(appliedDiscount ? 'applied' : 'empty')
    const [rejectMsg, setRejectMsg] = useState<string | null>(null)
    const [flash, setFlash] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Reason-specific warning. Backend collapses every non-`at-limit` reason to 'unavailable'
    // (no code enumeration), so only these two messages are possible.
    const rejectMessage = (reason?: string) => (reason === 'at-limit' ? dc.atLimit : dc.unavailable)

    // Parent-driven rejection: Place Order found the applied code sold out (DISCOUNT_EXHAUSTED). The parent
    // has already cleared the applied discount; surface the warning inline below the input so the buyer sees
    // it right where the code lives (not just a toast) and can review the new total before re-submitting.
    useEffect(() => {
        if (externalReject) {
            setRejectMsg(externalReject)
            setPhase('rejected')
        }
    }, [externalReject])

    // Clear the flash timer on unmount (e.g. checkout navigates away mid-flash) — avoids a stray
    // setState on an unmounted component.
    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

    const apply = async () => {
        const key = code.trim()
        if (!key) return
        setPhase('applying')
        if (timerRef.current) clearTimeout(timerRef.current)

        try {
            const res = await fetch('/api/storefront/discounts/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteSlug, siteId, code: key, subtotalSen }),
            })
            const data = await res.json()

            if (data.ok) {
                onApplied(data.discount, data.discountSen)
                setPhase('applied')
                setRejectMsg(null)
                setCode('')
            } else {
                // Reject with a reason-specific warning below the input. Order still proceeds at full price
                // (the code just isn't applied) — this is a warning, not a hard checkout failure.
                onRemoved()
                setRejectMsg(rejectMessage(data.reason))
                setPhase('rejected')
                setCode('')
                setFlash(true)
                timerRef.current = setTimeout(() => setFlash(false), 1400)
            }
        } catch {
            onRemoved()
            setRejectMsg(dc.unavailable)
            setPhase('rejected')
            setCode('')
        }
    }

    const remove = () => {
        onRemoved()
        setPhase('empty')
        setRejectMsg(null)
        setCode('')
    }

    const rmStr = (sen: number) => `RM ${(sen / 100).toFixed(2)}`

    return (
        <div className="ck-discount">
            {phase !== 'applied' ? (
                <>
                    <div className={`ck-dc-input${flash ? ' flash' : ''}`}>
                        <Tag size={14} />
                        <input
                            placeholder={dc.placeholder}
                            value={code}
                            onChange={e => { setCode(e.target.value); if (phase === 'rejected') { setPhase('empty'); setRejectMsg(null) } }}
                            onKeyDown={e => e.key === 'Enter' && apply()}
                            disabled={phase === 'applying'}
                            spellCheck={false}
                            autoCapitalize="characters"
                            maxLength={32}
                            aria-invalid={phase === 'rejected'}
                            aria-describedby={phase === 'rejected' ? 'ck-discount-error' : undefined}
                        />
                        <button
                            className="ck-dc-apply"
                            onClick={apply}
                            disabled={phase === 'applying' || !code.trim()}
                        >
                            {phase === 'applying'
                                ? <Loader2 size={13} className="spin" />
                                : dc.apply}
                        </button>
                    </div>
                    {phase === 'rejected' && rejectMsg && (
                        <div id="ck-discount-error" role="alert" className="ck-dc-hint error">
                            <Info size={12} />
                            {rejectMsg}
                        </div>
                    )}
                    {phase === 'empty' && (
                        <div className="ck-dc-hint subtle">
                            <Info size={12} />
                            {dc.oneCodePerOrder}
                        </div>
                    )}
                </>
            ) : appliedDiscount ? (
                <div className="ck-dc-applied">
                    <span className="ck-dc-tick"><Check size={13} /></span>
                    <div className="ck-dc-body">
                        <div className="ck-dc-code">
                            <span className="ck-dc-chip">{appliedDiscount.code}</span> {dc.applied}
                        </div>
                        <div className="ck-dc-sub">
                            {appliedDiscount.type === 'percentage'
                                ? ti(dc.percentOff, { value: appliedDiscount.value })
                                : ti(dc.fixedOff, { amount: rmStr(appliedDiscount.value) })}
                        </div>
                    </div>
                    <button className="ck-dc-remove" onClick={remove}>
                        <X size={13} />{dc.remove}
                    </button>
                </div>
            ) : null}
        </div>
    )
}

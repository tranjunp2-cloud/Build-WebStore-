'use client'

import { useState, useRef } from 'react'
import { Tag, Loader2, Check, X, Info } from 'lucide-react'

type AppliedDiscount = { code: string; type: 'percentage' | 'fixed'; value: number }
type Phase = 'empty' | 'applying' | 'applied' | 'rejected'

type Props = {
    siteSlug: string
    subtotalSen: number
    onApplied: (discount: AppliedDiscount, discountSen: number) => void
    onRemoved: () => void
    appliedDiscount: AppliedDiscount | null
}

export function CheckoutDiscountField({ siteSlug, subtotalSen, onApplied, onRemoved, appliedDiscount }: Props) {
    const [code, setCode] = useState('')
    const [phase, setPhase] = useState<Phase>(appliedDiscount ? 'applied' : 'empty')
    const [flash, setFlash] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const apply = async () => {
        const key = code.trim()
        if (!key) return
        setPhase('applying')
        if (timerRef.current) clearTimeout(timerRef.current)

        try {
            const res = await fetch('/api/storefront/discounts/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteSlug, code: key, subtotalSen }),
            })
            const data = await res.json()

            if (data.ok) {
                onApplied(data.discount, data.discountSen)
                setPhase('applied')
                setCode('')
            } else {
                onRemoved()
                setPhase('rejected')
                setCode('')
                setFlash(true)
                timerRef.current = setTimeout(() => setFlash(false), 1400)
            }
        } catch {
            setPhase('rejected')
            setCode('')
        }
    }

    const remove = () => {
        onRemoved()
        setPhase('empty')
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
                            placeholder="Promo or gift card code"
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && apply()}
                            disabled={phase === 'applying'}
                            spellCheck={false}
                            autoCapitalize="characters"
                            maxLength={32}
                        />
                        <button
                            className="ck-dc-apply"
                            onClick={apply}
                            disabled={phase === 'applying' || !code.trim()}
                        >
                            {phase === 'applying'
                                ? <Loader2 size={13} className="spin" />
                                : 'Apply'}
                        </button>
                    </div>
                    {phase === 'rejected' && (
                        <div className="ck-dc-hint error">
                            <Info size={12} />
                            That code couldn't be applied — your order continues at full price.
                        </div>
                    )}
                    {phase === 'empty' && (
                        <div className="ck-dc-hint subtle">
                            <Info size={12} />
                            One code per order.
                        </div>
                    )}
                </>
            ) : appliedDiscount ? (
                <div className="ck-dc-applied">
                    <span className="ck-dc-tick"><Check size={13} /></span>
                    <div className="ck-dc-body">
                        <div className="ck-dc-code">
                            <span className="ck-dc-chip">{appliedDiscount.code}</span> applied
                        </div>
                        <div className="ck-dc-sub">
                            {appliedDiscount.type === 'percentage'
                                ? `${appliedDiscount.value}% off subtotal`
                                : `${rmStr(appliedDiscount.value)} off`}
                        </div>
                    </div>
                    <button className="ck-dc-remove" onClick={remove}>
                        <X size={13} />Remove
                    </button>
                </div>
            ) : null}
        </div>
    )
}

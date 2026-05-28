'use client'

import { useState, useRef } from 'react'
import { Lock, ShieldCheck, MapPin, QrCode, Landmark, AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n'

type Props = {
    paymentMethod: 'cod' | 'bank_transfer' | 'stripe'
    setPaymentMethod: (m: 'cod' | 'bank_transfer' | 'stripe') => void
    enableCod: boolean
    enableQrBanking: boolean
    /** Seller has connected Stripe account (may still be disabled/pending) */
    stripeConnected: boolean
    /** Stripe is fully ready to accept payments */
    showStripe: boolean
}

export function CheckoutPaymentSection({
    paymentMethod, setPaymentMethod,
    enableCod, enableQrBanking, stripeConnected, showStripe,
}: Props) {
    const [stripeTooltipOpen, setStripeTooltipOpen] = useState(false)
    const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const { t } = useI18n()
    const ck = t.storefront.checkout

    return (
        <div className="ck-card">
            <div className="ck-ch">
                <span className="ck-num">03</span>
                <h2 className="ck-ct">{ck.paymentMethod}</h2>
                <span className="ck-aux"><Lock size={12} /> {ck.encrypted}</span>
            </div>
            <div className="pm-list">
                {stripeConnected && showStripe && (
                    <div className={`pm${paymentMethod === 'stripe' ? ' active' : ''}`} onClick={() => setPaymentMethod('stripe')}>
                        <div className="pm-row">
                            <div className={`pm-rad${paymentMethod === 'stripe' ? ' on' : ''}`} />
                            <div className="pm-body">
                                <h3 className="pm-title">{ck.stripeBoth}</h3>
                                <p className="pm-desc">{ck.stripeBothDesc}</p>
                                <div className="pm-brands">
                                    <span className="pm-brand visa">VISA</span>
                                    <span className="pm-brand mc"><span className="mc-c"><span /><span /></span></span>
                                    <span className="pm-brand amex">AMEX</span>
                                    <span className="pm-brand fpx">FPX</span>
                                </div>
                                <div className="pm-pills">
                                    <span className="pm-pill teal"><ShieldCheck size={11} /> {ck.stripeSecure}</span>
                                    <span className="pm-pill"><Lock size={11} /> {ck.stripePoweredBy}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {stripeConnected && !showStripe && (
                    <div className="pm pm-disabled" style={{ position: 'relative' }}>
                        <div className="pm-row">
                            <div className="pm-rad" style={{ opacity: 0.3 }} />
                            <div className="pm-body" style={{ opacity: 0.55 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <h3 className="pm-title" style={{ margin: 0 }}>{ck.stripeBoth}</h3>
                                    <span style={{
                                        fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                                        padding: '2px 8px', borderRadius: 20,
                                        background: 'rgba(234,179,8,0.15)', color: '#ca8a04',
                                        border: '1px solid rgba(234,179,8,0.3)',
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                    }}>
                                        <AlertCircle size={10} /> {ck.stripeUnderMaintenance}
                                    </span>
                                </div>
                                <p className="pm-desc">{ck.stripeBothDesc}</p>
                                <div className="pm-brands">
                                    <span className="pm-brand visa">VISA</span>
                                    <span className="pm-brand mc"><span className="mc-c"><span /><span /></span></span>
                                    <span className="pm-brand amex">AMEX</span>
                                    <span className="pm-brand fpx">FPX</span>
                                </div>
                                <div className="pm-pills">
                                    <span className="pm-pill" style={{ opacity: 0.6 }}>
                                        <AlertCircle size={11} /> {ck.stripeTemporarilyUnavailable}
                                    </span>
                                </div>
                            </div>
                            {/* Tooltip — hover trigger */}
                            <div
                                onMouseEnter={() => {
                                    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
                                    setStripeTooltipOpen(true)
                                }}
                                onMouseLeave={() => {
                                    tooltipTimer.current = setTimeout(() => setStripeTooltipOpen(false), 150)
                                }}
                                style={{ position: 'absolute', top: 10, right: 10 }}
                            >
                                <div style={{ padding: 4, color: 'var(--ck-text-muted, #6b7280)', cursor: 'default' }}>
                                    <AlertCircle size={16} />
                                </div>
                                {stripeTooltipOpen && (
                                    <div style={{
                                        position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 20,
                                        background: 'var(--ck-bg, #fff)', border: '1px solid var(--ck-border, #e5e7eb)',
                                        borderRadius: 10, padding: '14px 16px', width: 280, maxWidth: 280,
                                        boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)',
                                    }}>
                                        <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#ca8a04', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <AlertCircle size={13} /> {ck.stripeUnavailableTitle}
                                        </p>
                                        <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.5, color: 'var(--ck-text-muted, #6b7280)' }}>
                                            {ck.stripeUnavailableDesc}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setStripeTooltipOpen(false)}
                                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ck-primary, #16a34a)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                        >
                                            {ck.stripeChooseAnother} →
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {enableCod && (
                    <div className={`pm${paymentMethod === 'cod' ? ' active' : ''}`} onClick={() => setPaymentMethod('cod')}>
                        <div className="pm-row">
                            <div className={`pm-rad${paymentMethod === 'cod' ? ' on' : ''}`} />
                            <div className="pm-body">
                                <h3 className="pm-title">{ck.cod}</h3>
                                <p className="pm-desc">{ck.codDetail}</p>
                                <div className="pm-pills">
                                    <span className="pm-pill"><MapPin size={11} /> {ck.westMalaysiaOnly}</span>
                                    <span className="pm-pill">{ck.noExtraFee}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {enableQrBanking && (
                    <div className={`pm${paymentMethod === 'bank_transfer' ? ' active' : ''}`} onClick={() => setPaymentMethod('bank_transfer')}>
                        <div className="pm-row">
                            <div className={`pm-rad${paymentMethod === 'bank_transfer' ? ' on' : ''}`} />
                            <div className="pm-body">
                                <h3 className="pm-title">{ck.bankTransferName}</h3>
                                <p className="pm-desc">{ck.bankTransferDetail}</p>
                                <div className="pm-mini-marks">
                                    <span className="pm-mini-mark mark-qr"><QrCode size={12} /></span>
                                    <span className="pm-mini-mark mark-bnk"><Landmark size={12} /></span>
                                </div>
                                <div className="pm-pills">
                                    <span className="pm-pill teal"><ShieldCheck size={11} /> {ck.sellerVerified}</span>
                                    <span className="pm-pill">{ck.noExtraFee}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

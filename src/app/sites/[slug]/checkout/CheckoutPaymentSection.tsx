'use client'

import { Lock, ShieldCheck, MapPin, QrCode, Landmark } from 'lucide-react'
import { useI18n } from '@/i18n'

type Props = {
    paymentMethod: 'cod' | 'bank_transfer' | 'stripe'
    setPaymentMethod: (m: 'cod' | 'bank_transfer' | 'stripe') => void
    enableCod: boolean
    enableQrBanking: boolean
    showStripe: boolean
}

export function CheckoutPaymentSection({
    paymentMethod, setPaymentMethod,
    enableCod, enableQrBanking, showStripe,
}: Props) {
    const { t } = useI18n()
    const ck = t.storefront.checkout

    return (
        <div className="ck-card">
            <div className="ck-ch">
                <span className="ck-num">03</span>
                <h2 className="ck-ct">{ck.paymentMethod}</h2>
                <span className="ck-aux"><Lock size={12} /> Encrypted</span>
            </div>
            <div className="pm-list">
                {showStripe && (
                    <div className={`pm${paymentMethod === 'stripe' ? ' active' : ''}`} onClick={() => setPaymentMethod('stripe')}>
                        <div className="pm-row">
                            <div className={`pm-rad${paymentMethod === 'stripe' ? ' on' : ''}`} />
                            <div className="pm-body">
                                <h3 className="pm-title">Pay with Card / FPX</h3>
                                <p className="pm-desc">Card · FPX Online Banking · Secure hosted checkout</p>
                                <div className="pm-brands">
                                    <span className="pm-brand visa">VISA</span>
                                    <span className="pm-brand mc"><span className="mc-c"><span /><span /></span></span>
                                    <span className="pm-brand amex">AMEX</span>
                                    <span className="pm-brand fpx">FPX</span>
                                </div>
                                <div className="pm-pills">
                                    <span className="pm-pill teal"><ShieldCheck size={11} /> Secure</span>
                                    <span className="pm-pill"><Lock size={11} /> Powered by Stripe</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {enableCod && (
                    <div className={`pm${paymentMethod === 'cod' ? ' active' : ''}`} onClick={() => setPaymentMethod('cod')}>
                        <div className="pm-row">
                            <div className={`pm-rad${paymentMethod === 'cod' ? ' on' : ''}`} />
                            <div className="pm-body">
                                <h3 className="pm-title">Cash on Delivery (COD)</h3>
                                <p className="pm-desc">Pay in cash when the courier delivers. Seller confirms receipt.</p>
                                <div className="pm-pills">
                                    <span className="pm-pill"><MapPin size={11} /> West Malaysia only</span>
                                    <span className="pm-pill">No extra fee</span>
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
                                <h3 className="pm-title">Bank Transfer / DuitNow QR</h3>
                                <p className="pm-desc">Transfer to seller&apos;s bank or scan a DuitNow QR. Receipt verified manually.</p>
                                <div className="pm-mini-marks">
                                    <span className="pm-mini-mark mark-qr"><QrCode size={12} /></span>
                                    <span className="pm-mini-mark mark-bnk"><Landmark size={12} /></span>
                                </div>
                                <div className="pm-pills">
                                    <span className="pm-pill teal"><ShieldCheck size={11} /> Seller-verified</span>
                                    <span className="pm-pill">No extra fee</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

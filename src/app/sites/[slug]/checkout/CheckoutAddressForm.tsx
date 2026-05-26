'use client'

import { Truck, Check } from 'lucide-react'
import { type CheckoutForm } from '@/lib/storefront'
import { type GeoState, type GeoDistrict } from './use-checkout-state'
import { useI18n } from '@/i18n'

type Props = {
    form: CheckoutForm
    fieldErrors: { email?: string; phone?: string }
    contactVerified: boolean
    states: GeoState[]
    statesLoading: boolean
    selectedStateId: string
    districts: GeoDistrict[]
    districtsLoading: boolean
    selectedDistrictId: string
    postcodeOpts: string[]
    postcodesLoading: boolean
    selectedStatezone: string | undefined
    shippingFee: number
    currency: string
    formatPrice: (price: number, currency: string) => string
    updateField: (field: keyof CheckoutForm, value: string) => void
    handleEmailBlur: () => void
    handlePhoneBlur: () => void
    handleStateChange: (stateId: string) => void
    handleDistrictChange: (districtId: string) => void
}

export function CheckoutAddressForm({
    form, fieldErrors, contactVerified,
    states, statesLoading, selectedStateId,
    districts, districtsLoading, selectedDistrictId,
    postcodeOpts, postcodesLoading,
    selectedStatezone, shippingFee, currency, formatPrice,
    updateField, handleEmailBlur, handlePhoneBlur,
    handleStateChange, handleDistrictChange,
}: Props) {
    const { t } = useI18n()
    const ck = t.storefront.checkout

    return (
        <>
            {/* 01 Contact */}
            <div className="ck-card">
                <div className="ck-ch">
                    <span className="ck-num">01</span>
                    <h2 className="ck-ct">{ck.contactInfo}</h2>
                    {contactVerified && <span className="ck-aux ck-verified"><Check size={11} /> Verified</span>}
                </div>
                <div className="ck-f">
                    <label className="ck-lb">{ck.fullName}</label>
                    <div className="ck-iw">
                        <input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. Ahmad bin Ibrahim" />
                    </div>
                </div>
                <div className="ck-row c2">
                    <div className="ck-f">
                        <label className="ck-lb">{ck.emailAddress}</label>
                        <div className={`ck-iw${fieldErrors.email ? ' err' : ''}`}>
                            <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} onBlur={handleEmailBlur} placeholder="ahmad@email.com" />
                        </div>
                        {(fieldErrors.email || fieldErrors.phone) && <p className="ck-ferr">{fieldErrors.email}</p>}
                    </div>
                    <div className="ck-f">
                        <label className="ck-lb">{ck.phone} (+60)</label>
                        <div className={`ck-iw${fieldErrors.phone ? ' err' : ''}`}>
                            <input type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} onBlur={handlePhoneBlur} placeholder="+60 12 345 6789" />
                        </div>
                        {(fieldErrors.email || fieldErrors.phone) && <p className="ck-ferr">{fieldErrors.phone}</p>}
                    </div>
                </div>
            </div>

            {/* 02 Shipping */}
            <div className="ck-card">
                <div className="ck-ch">
                    <span className="ck-num">02</span>
                    <h2 className="ck-ct">{ck.shippingAddress}</h2>
                    <span className="ck-aux">
                        <Truck size={12} />
                        {selectedStatezone === 'east' ? 'East Malaysia' : 'West Malaysia'}
                        {' · '}{shippingFee === 0 ? 'Free' : formatPrice(shippingFee, currency)}
                    </span>
                </div>
                <div className="ck-f">
                    <label className="ck-lb">{ck.addressLine1}</label>
                    <div className="ck-iw">
                        <input value={form.line1} onChange={e => updateField('line1', e.target.value)} placeholder="No. 17, Jalan Kenari 22..." />
                    </div>
                </div>
                <div className="ck-f">
                    <label className="ck-lb">{ck.addressLine2}</label>
                    <div className="ck-iw">
                        <input value={form.line2} onChange={e => updateField('line2', e.target.value)} placeholder="Apartment, suite, unit..." />
                    </div>
                </div>
                <div className="ck-row c3">
                    <div className="ck-f">
                        <label className="ck-lb">{ck.state}</label>
                        <div className="ck-iw ck-sel">
                            <select value={selectedStateId} onChange={e => handleStateChange(e.target.value)} disabled={statesLoading}>
                                <option value="">{statesLoading ? 'Loading…' : '— Select State —'}</option>
                                {states.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="ck-f">
                        <label className="ck-lb">{ck.city}</label>
                        <div className="ck-iw ck-sel">
                            <select value={selectedDistrictId} onChange={e => handleDistrictChange(e.target.value)} disabled={!selectedStateId || districtsLoading}>
                                <option value="">{districtsLoading ? 'Loading…' : '— Select City —'}</option>
                                {districts.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="ck-f">
                        <label className="ck-lb">{ck.postcode}</label>
                        <div className="ck-iw ck-sel">
                            <select value={form.postcode} onChange={e => updateField('postcode', e.target.value)} disabled={!selectedDistrictId || postcodesLoading}>
                                <option value="">{postcodesLoading ? 'Loading…' : '— Select —'}</option>
                                {postcodeOpts.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

'use client'

import React, { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'

interface MissingWeightFormProps {
  orderId: string | number
  shippingFee?: number | null
  onSuccess: (awbNo: string, labelUrl: string | null) => void
  onError: (code: string) => void
}

/**
 * Shown when EP is on + courier selected but order has no parcelWeight.
 * Collects weight (grams), then calls create-label with parcelWeightGrams.
 * Schema has no L/W/H fields — weight only per spec.
 */
export function MissingWeightForm({ orderId, shippingFee, onSuccess, onError }: MissingWeightFormProps) {
  const { t } = useI18n()
  const mw = t.dashboard.orders.missingWeight
  const [weight, setWeight] = useState(500)
  const [step, setStep] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (weight < 1) return
    setStep('submitting')
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/create-label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelWeightGrams: weight }),
      })
      const data = await res.json()
      if (!res.ok) {
        const code = data?.error?.code ?? 'EASYPARCEL_ERROR'
        const msg = data?.error?.message ?? 'Failed to create label'
        setErrorMsg(msg)
        setStep('error')
        onError(code)
        return
      }
      const { awbNo, labelUrl } = data.data ?? data
      toast.success(mw.labelCreated)
      onSuccess(awbNo, labelUrl ?? null)
    } catch {
      const msg = mw.networkError
      setErrorMsg(msg)
      setStep('error')
    }
  }

  return (
    <div className="parcel-missing">
      <div className="pm-head">
        <span className="pm-ico">
          <TriangleAlert style={{ width: 16, height: 16 }} />
        </span>
        <div>
          <div className="pm-t">{mw.title}</div>
          <div className="pm-d">{mw.body}</div>
        </div>
      </div>

      <div className="pm-fields pm-fields-row">
        <div className="od-field" style={{ width: 160, flexShrink: 0 }}>
          <label className="lbl" htmlFor="pm-weight">{mw.weightLabel}</label>
          <div className="inp">
            <input
              id="pm-weight"
              type="number"
              min={1}
              max={30000}
              value={weight}
              onChange={e => setWeight(Math.max(1, Number(e.target.value)))}
              disabled={step === 'submitting'}
            />
            <span className="suf">g</span>
          </div>
        </div>

        {shippingFee != null && (
          <div className="od-field" style={{ flex: 1 }}>
            <label className="lbl">{mw.quotedFee}</label>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--dash-text)', paddingTop: 10 }}>
              MYR {shippingFee.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {step === 'error' && errorMsg && (
        <div className="alert error" role="alert" style={{ fontSize: 13 }}>
          <div className="a-body">
            <div className="a-t">{mw.failedTitle}</div>
            {errorMsg}
          </div>
          <button
            className="a-link"
            onClick={() => { setStep('idle'); setErrorMsg(null) }}
          >
            {mw.tryAgain}
          </button>
        </div>
      )}

      <button
        className="btn btn-grad btn-block"
        style={{ height: 40 }}
        disabled={weight < 1 || step === 'submitting'}
        onClick={handleSubmit}
      >
        {step === 'submitting' && <span className="spin" />}
        {mw.submit}
      </button>
    </div>
  )
}

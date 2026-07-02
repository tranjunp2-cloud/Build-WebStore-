'use client'

import React from 'react'
import { Printer, Download, X, Info, FileText } from 'lucide-react'
import { useI18n } from '@/i18n'

interface PrintLabelModalProps {
  awbNo: string | null
  labelUrl: string | null
  courierName?: string | null
  courierId?: string | null
  onClose: () => void
}

// Renders the ACTUAL EasyParcel shipping-label PDF (labelUrl) — never a custom-drawn label.
// EP returns a fixed PDF (its own format/layout), so we embed it and expose open/download/print.
export function PrintLabelModal({ awbNo, labelUrl, onClose }: PrintLabelModalProps) {
  const { t, ti } = useI18n()
  const pl = t.dashboard.orders.printLabel

  const handlePrint = () => {
    if (!labelUrl) return
    window.open(labelUrl, '_blank', 'noopener,noreferrer')
  }

  const handleDownload = () => {
    if (!labelUrl) return
    const a = document.createElement('a')
    a.href = labelUrl
    a.download = `label-${awbNo ?? 'unknown'}.pdf`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog plabel-dialog" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="dialog-h">
          <span className="plabel-h-ic">
            <Printer style={{ width: 19, height: 19 }} />
          </span>
          <div className="dialog-h-tx">
            <div className="dialog-t">{pl.title}</div>
            <div className="dialog-sub">{ti(pl.subtitleAwb, { awb: awbNo ?? '—' })}</div>
          </div>
          <button className="dialog-x" onClick={onClose} aria-label="Close">
            <X style={{ width: 17, height: 17 }} />
          </button>
        </div>

        {/* Body — the real EP label PDF */}
        <div className="plabel-body-pdf">
          {labelUrl ? (
            <iframe
              src={labelUrl}
              title="Shipping label PDF"
              className="plabel-pdf-frame"
            />
          ) : (
            <div className="plabel-empty">
              <FileText style={{ width: 28, height: 28, opacity: 0.5 }} />
              <span>{pl.noLabel}</span>
            </div>
          )}
          <div className="plabel-hint">
            <Info style={{ width: 13, height: 13, flexShrink: 0, marginTop: 2 }} />
            {pl.hint}
          </div>
        </div>

        {/* Footer */}
        <div className="dialog-foot">
          <button className="btn btn-ghost" onClick={onClose}>{pl.cancel}</button>
          <button className="btn btn-outline" onClick={handleDownload} disabled={!labelUrl}>
            <Download style={{ width: 15, height: 15 }} /> {pl.download}
          </button>
          <button
            className="btn btn-primary"
            style={{ backgroundColor: 'rgb(59, 130, 246)' }}
            onClick={handlePrint}
            disabled={!labelUrl}
          >
            <Printer style={{ width: 15, height: 15 }} /> {pl.print}
          </button>
        </div>
      </div>
    </div>
  )
}

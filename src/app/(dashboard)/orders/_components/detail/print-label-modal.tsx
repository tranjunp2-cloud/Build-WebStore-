'use client'

import React, { useState, useEffect } from 'react'
import { Printer, Download, X, Info, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'

export interface LabelUrlsByFormat {
  A4?: string | null
  A6?: string | null
}

interface PrintLabelModalProps {
  orderId: string | number
  awbNo: string | null
  labelUrl: string | null
  /** Per-format PDF URLs from EP awb_urls_by_format — enables the A6/A4 toggle. */
  labelUrls?: LabelUrlsByFormat | null
  courierName?: string | null
  courierId?: string | null
  onClose: () => void
  /** Called after labelPrintedAt was stamped — parent refetches so "Printed" shows up. */
  onPrinted?: () => void
}

type LabelFormat = 'A6' | 'A4'
type FormatState = { status: 'loading' | 'ok' | 'unavailable'; blobUrl?: string }

/**
 * Print-label modal (design 260707): LEFT = the ACTUAL EasyParcel PDF, embedded large
 * enough to read (never a custom-drawn label); RIGHT = format toggle (A6 thermal /
 * A4 sheet), copies stepper, "Mark as printed" (stamps labelPrintedAt).
 *
 * PDFs come through OUR proxy (GET /api/orders/[id]/label?format=…), never EP's URL
 * directly: EP's renderer can 400 on a format ("Failed to get label"), and the proxy
 * turns that into a clean unavailable-state instead of raw JSON inside the iframe.
 * Both formats are probed on open — a format is only selectable when its PDF loads.
 * Printing opens the PDF in a new tab (per design note); copies are confirmed in the
 * browser/OS print dialog — JS cannot preset them.
 */
export function PrintLabelModal({ orderId, awbNo, onClose, onPrinted }: PrintLabelModalProps) {
  const { t, ti } = useI18n()
  const pl = t.dashboard.orders.printLabel

  const [format, setFormat] = useState<LabelFormat>('A6')
  const [markPrinted, setMarkPrinted] = useState(true)
  const [formats, setFormats] = useState<Record<LabelFormat, FormatState>>({
    A6: { status: 'loading' },
    A4: { status: 'loading' },
  })
  const markPrintedId = React.useId()
  const formatGroupId = React.useId()

  const proxyUrl = (f: LabelFormat) => `/api/orders/${orderId}/label?format=${f}`

  // Probe both formats once per open: fetch → blob (doubles as the preview source).
  useEffect(() => {
    let cancelled = false
    const created: string[] = []
    ;(['A6', 'A4'] as LabelFormat[]).forEach(async (f) => {
      try {
        const res = await fetch(proxyUrl(f))
        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('pdf')) throw new Error('unavailable')
        const blobUrl = URL.createObjectURL(await res.blob())
        created.push(blobUrl)
        if (!cancelled) setFormats((s) => ({ ...s, [f]: { status: 'ok', blobUrl } }))
      } catch {
        if (!cancelled) {
          setFormats((s) => ({ ...s, [f]: { status: 'unavailable' } }))
          // Active format failed → hop to the other one (its own probe decides usability)
          setFormat((cur) => (cur === f ? (f === 'A6' ? 'A4' : 'A6') : cur))
        }
      }
    })
    return () => {
      cancelled = true
      created.forEach((u) => URL.revokeObjectURL(u))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const active = formats[format]
  const formatDesc = format === 'A4' ? pl.formatA4 : pl.formatThermal
  const bothUnavailable = formats.A6.status === 'unavailable' && formats.A4.status === 'unavailable'

  const handlePrint = () => {
    if (active.status !== 'ok') return
    window.open(proxyUrl(format), '_blank', 'noopener,noreferrer')
    if (markPrinted) {
      // Fire-and-forget audit stamp — printing must never block on it; on success the
      // parent refetches so the "Printed · …" line appears on the fulfillment card.
      fetch(`/api/orders/${orderId}/mark-printed`, { method: 'POST' })
        .then((res) => { if (res.ok) onPrinted?.() })
        .catch(() => null)
    }
  }

  const handleDownload = () => {
    if (active.status !== 'ok') return
    const a = document.createElement('a')
    a.href = proxyUrl(format) // same-origin → download attribute honored, real filename
    a.download = `label-${awbNo ?? 'unknown'}-${format}.pdf`
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
            <div className="dialog-sub">{ti(pl.subtitleAwb, { awb: awbNo ?? '—' })} · {formatDesc}</div>
          </div>
          <button className="dialog-x" onClick={onClose} aria-label="Close">
            <X style={{ width: 17, height: 17 }} />
          </button>
        </div>

        {/* Body — real EP PDF preview (left) + print options (right) */}
        <div className="plabel-grid">
          <div className="plabel-preview-pane">
            {active.status === 'ok' && active.blobUrl ? (
              <iframe
                key={active.blobUrl}
                // #toolbar=0&navpanes=0&scrollbar=0: hide the browser PDF viewer's
                // print/download/rotate controls → preview is view-only, funnel printing
                // through the "Print label" button (which also stamps labelPrintedAt).
                src={`${active.blobUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                title="Shipping label PDF"
                className="plabel-pdf-frame"
              />
            ) : (
              <div className="plabel-empty">
                {active.status === 'loading' ? (
                  <>
                    <Loader2 className="animate-spin" style={{ width: 26, height: 26, opacity: 0.6 }} />
                    <span>{pl.loadingLabel}</span>
                  </>
                ) : (
                  <>
                    <FileText style={{ width: 28, height: 28, opacity: 0.5 }} />
                    <span>{bothUnavailable ? pl.noLabel : pl.formatUnavailable}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="plabel-side">
            {/* Label format — a format is only selectable when its PDF actually loads */}
            <div className="plabel-field">
              <span
                id={`${formatGroupId}-label`}
                className="text-[12px] font-semibold text-[var(--dash-text-muted)]"
              >
                {pl.formatLabel}
              </span>
              {/* delayDuration 0: the default 700ms feels broken on a disabled control —
                  the "why can't I click this" answer must be instant */}
              <TooltipProvider delayDuration={0}>
                <div
                  role="radiogroup"
                  aria-labelledby={`${formatGroupId}-label`}
                  className="grid h-11 w-full grid-cols-2 items-center justify-center rounded-lg border border-solid border-[var(--dash-border)] bg-[var(--dash-secondary-bg)] p-1 text-muted-foreground"
                >
                  {(['A6', 'A4'] as LabelFormat[]).map((f) => {
                    const status = formats[f].status
                    const label = f === 'A6' ? pl.formatA6 : pl.formatA4
                    const option = (
                      <label
                        className={`flex h-9 w-full min-w-0 rounded-md ${
                          status === 'ok' ? 'cursor-pointer' : 'cursor-not-allowed'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${formatGroupId}-format`}
                          value={f}
                          checked={format === f}
                          onChange={() => setFormat(f)}
                          aria-label={label}
                          aria-describedby={
                            status === 'unavailable'
                              ? `${formatGroupId}-unavailable`
                              : undefined
                          }
                          // Selectable ONLY once its probe confirmed a real PDF — while loading
                          // the input stays locked too, so an unverified format can't be picked.
                          disabled={status !== 'ok'}
                          className="peer sr-only"
                        />
                        <span
                          className={`inline-flex h-9 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-md px-2 text-[12.5px] font-semibold text-[var(--dash-text-muted)] shadow-none transition-all peer-checked:bg-[hsl(var(--primary))] peer-checked:!text-white peer-checked:shadow-none peer-disabled:opacity-50 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background ${
                            status === 'ok' ? 'hover:text-[var(--dash-text)]' : ''
                          }`}
                        >
                          {status === 'loading'
                            ? <Loader2 aria-hidden="true" className="h-[13px] w-[13px] animate-spin" />
                            : label}
                        </span>
                      </label>
                    )

                    // The non-focusable label wrapper keeps the unavailable tooltip hoverable
                    // without adding a tab stop outside the native radio-group keyboard model.
                    return status === 'unavailable' ? (
                      <Tooltip key={f}>
                        <TooltipTrigger asChild>
                          {option}
                        </TooltipTrigger>
                        {/* z-[9100]: the tooltip portals to <body>, and its default z-50 sits
                            UNDER the .dialog-backdrop (z-index 9000) — bump it above the modal */}
                        <TooltipContent side="top" className="z-[9100] max-w-[220px] text-center">
                          {pl.formatUnavailable}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <React.Fragment key={f}>{option}</React.Fragment>
                    )
                  })}
                </div>
                <span id={`${formatGroupId}-unavailable`} className="sr-only">
                  {pl.formatUnavailable}
                </span>
              </TooltipProvider>
            </div>

            {/* No Copies control — printing happens in the browser/OS dialog which has its
                own copies field; a stepper here could not drive it (removed 260707). */}

            {/* Mark as printed */}
            <div className="flex min-h-11 items-center gap-2.5">
              <Checkbox
                id={markPrintedId}
                checked={markPrinted}
                onCheckedChange={(checked) => setMarkPrinted(checked === true)}
                aria-labelledby={`${markPrintedId}-label`}
                style={{ borderColor: markPrinted ? 'hsl(var(--primary))' : 'var(--dash-border)' }}
                className="h-[18px] w-[18px] rounded-[4px] border border-solid bg-transparent data-[state=checked]:bg-[hsl(var(--primary))] data-[state=checked]:!text-white"
              />
              <label
                id={`${markPrintedId}-label`}
                htmlFor={markPrintedId}
                className="flex min-h-11 cursor-pointer items-center text-[13px] font-medium text-[var(--dash-text)]"
              >
                {pl.markAsPrinted}
              </label>
            </div>

            <div className="plabel-hint">
              <Info style={{ width: 13, height: 13, flexShrink: 0, marginTop: 2 }} />
              {pl.hint}
            </div>
          </div>
        </div>

        {/* Footer — Cancel pushed left, Download + Print grouped right (content-width) */}
        <div className="dialog-foot plabel-foot">
          <Button type="button" variant="dashSecondary" className="mr-auto h-10 flex-none px-4" onClick={onClose}>
            {pl.cancel}
          </Button>
          <Button
            type="button"
            variant="dashSecondary"
            className="h-10 flex-none px-4"
            onClick={handleDownload}
            disabled={active.status !== 'ok'}
          >
            <Download style={{ width: 15, height: 15 }} /> {pl.download}
          </Button>
          <Button
            type="button"
            variant="dashPrimary"
            className="h-10 flex-none px-4 !text-white"
            onClick={handlePrint}
            disabled={active.status !== 'ok'}
          >
            <Printer style={{ width: 15, height: 15 }} /> {pl.print}
          </Button>
        </div>
      </div>
    </div>
  )
}

'use client'

import React, { useEffect, useState, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
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

function subscribeToDeviceClassification() {
  // The browser/device classification is stable for the lifetime of the page.
  return () => undefined
}

function getDeviceClassificationSnapshot() {
  const userAgent = navigator.userAgent
  return (
    /(Android|iPhone|iPad|iPod|Mobile)/i.test(userAgent) ||
    // iPadOS 13+ may request the desktop site and identify itself as macOS.
    (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1)
  )
}

function getServerDeviceClassificationSnapshot() {
  return false
}

function PdfPreviewLoading() {
  const { t } = useI18n()
  return (
    <div className="plabel-empty" role="status">
      <Loader2 className="animate-spin" aria-hidden="true" />
      <span>{t.dashboard.orders.printLabel.loadingLabel}</span>
    </div>
  )
}

const PdfLabelPreview = dynamic(
  () => import('./pdf-label-preview').then((module) => module.PdfLabelPreview),
  { ssr: false, loading: PdfPreviewLoading },
)

/**
 * Print-label modal (design 260707): LEFT = the ACTUAL EasyParcel PDF, embedded large
 * enough to read (never a custom-drawn label); RIGHT = format toggle (A6 thermal /
 * A4 sheet), copies stepper, "Mark as printed" (stamps labelPrintedAt).
 *
 * PDFs come through OUR proxy (GET /api/orders/[id]/label?format=…), never EP's URL
 * directly: EP's renderer can 400 on a format ("Failed to get label"), and the proxy
 * turns that into a clean unavailable-state. Desktop keeps the existing native PDF
 * embed; mobile/tablet use PDF.js canvas because their iframe PDF viewers are unreliable.
 * Printing opens the PDF in a new tab (per design note); copies are confirmed in the
 * browser/OS print dialog — JS cannot preset them.
 */
export function PrintLabelModal({ orderId, awbNo, onClose, onPrinted }: PrintLabelModalProps) {
  const { t, ti } = useI18n()
  const pl = t.dashboard.orders.printLabel

  const useCanvasPreview = useSyncExternalStore(
    subscribeToDeviceClassification,
    getDeviceClassificationSnapshot,
    getServerDeviceClassificationSnapshot,
  )
  const [format, setFormat] = useState<LabelFormat>('A6')
  const [markPrinted, setMarkPrinted] = useState(true)
  const [formats, setFormats] = useState<Record<LabelFormat, FormatState>>({
    A6: { status: 'loading' },
    A4: { status: 'loading' },
  })
  const markPrintedId = React.useId()
  const formatGroupId = React.useId()

  const proxyUrl = (f: LabelFormat) => `/api/orders/${orderId}/label?format=${f}`

  // Keep the deployed desktop behavior: probe both formats and feed its native
  // PDF viewer a Blob URL. The same probe also prevents a renderer error from
  // being confused with an unavailable EasyParcel format on mobile/tablet.
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const created = new Set<string>()

    ;(['A6', 'A4'] as LabelFormat[]).forEach(async (candidate) => {
      try {
        const response = await fetch(proxyUrl(candidate), { signal: controller.signal })
        if (
          !response.ok ||
          !(response.headers.get('content-type') ?? '').includes('pdf')
        ) {
          throw new Error('unavailable')
        }

        const blobUrl = URL.createObjectURL(await response.blob())
        if (cancelled) {
          URL.revokeObjectURL(blobUrl)
          return
        }

        created.add(blobUrl)
        setFormats((current) => ({
          ...current,
          [candidate]: { status: 'ok', blobUrl },
        }))
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return
        setFormats((current) => ({
          ...current,
          [candidate]: { status: 'unavailable' },
        }))
        setFormat((current) => (
          current === candidate ? (candidate === 'A6' ? 'A4' : 'A6') : current
        ))
      }
    })

    return () => {
      cancelled = true
      controller.abort()
      created.forEach((blobUrl) => URL.revokeObjectURL(blobUrl))
    }
  // The modal remounts for each order; proxyUrl is intentionally local to this render.
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
    <div className="dialog-backdrop plabel-backdrop" onClick={onClose}>
      <div
        className="dialog plabel-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-label-dialog-title"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="dialog-h">
          <span className="plabel-h-ic">
            <Printer style={{ width: 19, height: 19 }} />
          </span>
          <div className="dialog-h-tx">
            <div className="dialog-t" id="print-label-dialog-title">{pl.title}</div>
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
              useCanvasPreview ? (
                <PdfLabelPreview
                  key={format}
                  url={proxyUrl(format)}
                  loadingLabel={pl.loadingLabel}
                  errorLabel={pl.previewFailed}
                  openPdfLabel={pl.openPdf}
                  previousPageLabel={pl.previousPage}
                  nextPageLabel={pl.nextPage}
                  pageLabel={(page, pages) => ti(pl.pageCount, { page, pages })}
                />
              ) : (
                <iframe
                  key={active.blobUrl}
                  src={`${active.blobUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  title="Shipping label PDF"
                  className="plabel-pdf-frame"
                />
              )
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
                          className={`plabel-format-option inline-flex h-9 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-md px-2 text-[12.5px] font-semibold text-[var(--dash-text-muted)] shadow-none transition-all peer-checked:bg-[hsl(var(--primary))] peer-checked:text-[hsl(var(--primary-foreground))] peer-checked:shadow-none peer-disabled:opacity-50 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background ${
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
                className="plabel-mark-checkbox h-[18px] w-[18px] rounded-[4px] border border-solid bg-transparent data-[state=checked]:bg-[hsl(var(--primary))] data-[state=checked]:text-[hsl(var(--primary-foreground))]"
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

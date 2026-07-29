'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, FileWarning, Loader2 } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api.js'

// React-PDF requires the worker configuration in the same module as Document/Page.
// new URL() makes Next emit the matching local worker instead of relying on a CDN.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const PDF_OPTIONS = {
  standardFontDataUrl: '/pdfjs-standard-fonts/',
} satisfies DocumentInitParameters

const WEBKIT_PDF_OPTIONS = {
  ...PDF_OPTIONS,
  // WebKit exposes these APIs before every ImageBitmap/OffscreenCanvas path is
  // reliable. Carrier barcodes use transparent image XObjects, so decode them
  // to plain RGBA data in the worker and paint them on the visible canvas.
  isImageDecoderSupported: false,
  isOffscreenCanvasSupported: false,
} satisfies DocumentInitParameters

interface PdfImageObject {
  width: number
  height: number
  data?: Uint8Array | Uint8ClampedArray
  bitmap?: ImageBitmap
}

function isPdfImageObject(value: unknown): value is PdfImageObject {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PdfImageObject>
  return (
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    (
      candidate.data instanceof Uint8Array ||
      candidate.data instanceof Uint8ClampedArray ||
      (typeof ImageBitmap !== 'undefined' && candidate.bitmap instanceof ImageBitmap)
    )
  )
}

function imageObjectToCanvas(image: PdfImageObject) {
  const imageCanvas = document.createElement('canvas')
  imageCanvas.width = image.width
  imageCanvas.height = image.height
  const context = imageCanvas.getContext('2d')
  if (!context) return null

  if (image.bitmap) {
    context.drawImage(image.bitmap, 0, 0)
    return imageCanvas
  }

  if (!image.data || image.data.byteLength !== image.width * image.height * 4) {
    return null
  }

  const rgba = new Uint8ClampedArray(
    image.data.buffer,
    image.data.byteOffset,
    image.data.byteLength,
  )
  context.putImageData(new ImageData(new Uint8ClampedArray(rgba), image.width, image.height), 0, 0)
  return imageCanvas
}

/**
 * WebKit can finish PDF.js rendering without compositing small transparent image
 * XObjects (carrier barcodes and QR codes). The decoded page objects are intact,
 * so repaint only those small images using the PDF operator transforms.
 */
async function repairWebKitCarrierImages(page: PDFPageProxy, canvas: HTMLCanvasElement) {
  const operatorList = await page.getOperatorList()
  if (!canvas.isConnected) return

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Shipping-label canvas context is unavailable')

  const unitViewport = page.getViewport({ scale: 1 })
  const renderViewport = page.getViewport({ scale: canvas.width / unitViewport.width })
  let repairableImages = 0
  let repairedImages = 0

  context.save()
  context.setTransform(
    ...(renderViewport.transform as [number, number, number, number, number, number])
  )

  try {
    for (let index = 0; index < operatorList.fnArray.length; index += 1) {
      const operation = operatorList.fnArray[index]
      const args = operatorList.argsArray[index] as unknown[]

      if (operation === pdfjs.OPS.save) {
        context.save()
        continue
      }
      if (operation === pdfjs.OPS.restore) {
        context.restore()
        continue
      }
      if (
        operation === pdfjs.OPS.transform &&
        args.length === 6 &&
        args.every((value) => typeof value === 'number')
      ) {
        context.transform(...(args as [number, number, number, number, number, number]))
        continue
      }
      if (operation !== pdfjs.OPS.paintImageXObject || typeof args[0] !== 'string') {
        continue
      }

      const image = page.objs.get(args[0]) as unknown
      if (
        !isPdfImageObject(image) ||
        image.width * image.height > 100_000
      ) {
        continue
      }

      repairableImages += 1
      const imageCanvas = imageObjectToCanvas(image)
      if (!imageCanvas) {
        throw new Error('Shipping-label image data could not be repaired')
      }

      context.save()
      context.scale(1 / image.width, -1 / image.height)
      context.drawImage(
        imageCanvas,
        0,
        0,
        image.width,
        image.height,
        0,
        -image.height,
        image.width,
        image.height,
      )
      context.restore()
      repairedImages += 1
    }
  } finally {
    context.restore()
  }

  if (repairedImages !== repairableImages) {
    throw new Error('Shipping-label barcode image repair was incomplete')
  }

  canvas.dataset.repairedPdfImages = String(repairedImages)
}

interface PdfLabelPreviewProps {
  url: string
  loadingLabel: string
  errorLabel: string
  openPdfLabel: string
  previousPageLabel: string
  nextPageLabel: string
  pageLabel: (page: number, pages: number) => string
}

interface PreviewFallbackProps {
  url: string
  errorLabel: string
  openPdfLabel: string
}

function PreviewFallback({ url, errorLabel, openPdfLabel }: PreviewFallbackProps) {
  return (
    <div className="plabel-render-error" role="alert">
      <FileWarning aria-hidden="true" />
      <span>{errorLabel}</span>
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
        <ExternalLink aria-hidden="true" />
        {openPdfLabel}
      </a>
    </div>
  )
}

export function PdfLabelPreview({
  url,
  loadingLabel,
  errorLabel,
  openPdfLabel,
  previousPageLabel,
  nextPageLabel,
  pageLabel,
}: PdfLabelPreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [previewWidth, setPreviewWidth] = useState(0)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [renderFailed, setRenderFailed] = useState(false)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const updateWidth = (width: number) => {
      // Leave a small gutter around the paper and never ask PDF.js to render 0px.
      setPreviewWidth(Math.max(1, Math.floor(width - 16)))
    }

    updateWidth(viewport.clientWidth)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) updateWidth(entry.contentRect.width)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setNumPages(0)
    setPageNumber(1)
    setRenderFailed(false)
  }, [url])

  const handleDocumentLoad = (pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages)
    setPageNumber(1)
    setRenderFailed(false)
  }

  const handleDocumentError = () => {
    setRenderFailed(true)
  }

  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const usesWebKit = /AppleWebKit/i.test(userAgent)
    && !/(Android|Chrome|Chromium|Edg|OPR)/i.test(userAgent)
  // WebKit corrupts this courier PDF's soft-mask barcode at a 2× backing
  // canvas. Keep Safari/iOS at 1×; printing and downloading still use the
  // original PDF, while Chromium keeps the sharper 2× preview.
  const pixelRatio = usesWebKit
    ? 1
    : (typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2))

  return (
    <div className="plabel-pdf-preview">
      <div className="plabel-pdf-scroll" ref={viewportRef}>
        {renderFailed ? (
          <PreviewFallback url={url} errorLabel={errorLabel} openPdfLabel={openPdfLabel} />
        ) : (
          <Document
            key={url}
            file={url}
            options={usesWebKit ? WEBKIT_PDF_OPTIONS : PDF_OPTIONS}
            className="plabel-pdf-document"
            loading={(
              <div className="plabel-pdf-loading" role="status">
                <Loader2 className="animate-spin" aria-hidden="true" />
                <span>{loadingLabel}</span>
              </div>
            )}
            error={<PreviewFallback url={url} errorLabel={errorLabel} openPdfLabel={openPdfLabel} />}
            onLoadSuccess={handleDocumentLoad}
            onLoadError={handleDocumentError}
          >
            {previewWidth > 1 && (
              <Page
                key={`${url}-${pageNumber}`}
                canvasRef={canvasRef}
                pageNumber={pageNumber}
                width={previewWidth}
                devicePixelRatio={pixelRatio}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={(
                  <div className="plabel-pdf-loading" role="status">
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    <span>{loadingLabel}</span>
                  </div>
                )}
                onRenderError={() => setRenderFailed(true)}
                onRenderSuccess={(page) => {
                  const canvas = canvasRef.current
                  if (!usesWebKit || !canvas) return
                  void repairWebKitCarrierImages(page, canvas)
                    .catch(() => {
                      if (canvasRef.current === canvas && canvas.isConnected) {
                        setRenderFailed(true)
                      }
                    })
                }}
              />
            )}
          </Document>
        )}
      </div>

      {!renderFailed && numPages > 1 && (
        <div className="plabel-pages" aria-label={pageLabel(pageNumber, numPages)}>
          <button
            type="button"
            className="plabel-page-btn"
            aria-label={previousPageLabel}
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <span>{pageLabel(pageNumber, numPages)}</span>
          <button
            type="button"
            className="plabel-page-btn"
            aria-label={nextPageLabel}
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber((page) => Math.min(numPages, page + 1))}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

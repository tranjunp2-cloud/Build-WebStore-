import { useEffect, useRef } from 'react'

const FRAME_W = 1280

/**
 * Live template preview: the real /api/templates/preview page in a sandboxed 1280px iframe, scaled to the
 * card width with a ResizeObserver. Without a template it renders an empty (optionally pulsing) frame.
 */
export function TemplateThumb({ id, name, ratio = '16/10', loading = false }: {
  id?: string
  name?: string
  ratio?: '16/9' | '16/10'
  loading?: boolean
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box || !id) return
    const apply = (w: number) => {
      if (frameRef.current && w > 0) frameRef.current.style.transform = `scale(${w / FRAME_W})`
    }
    apply(box.getBoundingClientRect().width)
    const ro = new ResizeObserver((entries) => apply(entries[0]?.contentRect.width ?? 0))
    ro.observe(box)
    return () => ro.disconnect()
  }, [id])

  const cls = `thumb${ratio === '16/10' ? ' r1610' : ''}${!id && loading ? ' skel' : ''}`
  return (
    <div ref={boxRef} className={cls}>
      {id ? (
        <iframe
          ref={frameRef}
          title={name ?? ''}
          src={`/api/templates/preview?id=${encodeURIComponent(id)}`}
          loading="lazy"
          sandbox=""
          tabIndex={-1}
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}

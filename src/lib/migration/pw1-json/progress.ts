/** Metadata only; never pass credentials, source values or full paths. */
export interface ImportProgress {
  phase: string
  file?: string
  storeId?: string
  collection?: string
  completed?: number
  total?: number
  bytes?: number
  totalBytes?: number
}
export type Progress = (event: ImportProgress) => void

export function progressLogger(write: (line: string) => void, now = Date.now) {
  const started = now()
  let last = -Infinity
  let stage = ''
  let latest: ImportProgress | undefined
  function render(event: ImportProgress, heartbeat = false): void {
    const time = now()
    const nextStage = `${event.phase}:${event.file ?? ''}:${event.storeId ?? ''}:${event.collection ?? ''}`
    const done = event.total !== undefined && event.completed === event.total
    if (!heartbeat && nextStage === stage && !done && time - last < 1000) return
    stage = nextStage
    last = time
    const clean = (value: string) => value.replace(/[^a-zA-Z0-9_.:-]/g, '_')
    const parts = [`[PW1 import +${((time - started) / 1000).toFixed(1)}s]`, clean(event.phase)]
    if (event.file) parts.push(`file=${clean(event.file)}`)
    if (event.storeId) parts.push(`store=${clean(event.storeId)}`)
    if (event.collection) parts.push(`collection=${clean(event.collection)}`)
    if (event.completed !== undefined) parts.push(`${event.completed}${event.total !== undefined ? `/${event.total}` : ''}`)
    if (event.bytes !== undefined) {
      parts.push(`MB=${(event.bytes / 1024 / 1024).toFixed(1)}${event.totalBytes !== undefined ? `/${(event.totalBytes / 1024 / 1024).toFixed(1)}` : ''}`)
    }
    if (heartbeat) parts.push('running')
    write(parts.join(' ') + '\n')
  }
  return {
    report: (event: ImportProgress) => { latest = event; render(event) },
    heartbeat: () => { if (latest && now() - last >= 5000) render(latest, true) },
  }
}

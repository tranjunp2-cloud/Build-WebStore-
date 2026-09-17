/** Metadata only: never pass source values or arbitrary file paths to progress logs. */
export interface ExportProgress {
  phase: string
  completed?: number
  total?: number
  table?: string
  rows?: number
  bytes?: number
  storeId?: string
}
export type Progress = (event: ExportProgress) => void

export function progressLogger(
  write: (line: string) => void,
  now = Date.now,
): Progress {
  const started = now()
  let last = -Infinity
  let stage = ''
  return (event) => {
    const time = now()
    const nextStage = `${event.phase}:${event.table ?? ''}`
    const done = event.total !== undefined && event.completed === event.total
    if (nextStage === stage && !done && time - last < 1000) return
    stage = nextStage
    last = time
    const clean = (value: string) => value.replace(/[^a-zA-Z0-9_.:-]/g, '_')
    const parts = [
      `[PW1 +${((time - started) / 1000).toFixed(1)}s]`,
      clean(event.phase),
    ]
    if (event.completed !== undefined)
      parts.push(
        `${event.completed}${event.total !== undefined ? `/${event.total}` : ''}`,
      )
    if (event.table) parts.push(`table=${clean(event.table)}`)
    if (event.storeId) parts.push(`store=${clean(event.storeId)}`)
    if (event.rows !== undefined) parts.push(`rows=${event.rows}`)
    if (event.bytes !== undefined)
      parts.push(`MB=${(event.bytes / 1024 / 1024).toFixed(1)}`)
    write(parts.join(' ') + '\n')
  }
}

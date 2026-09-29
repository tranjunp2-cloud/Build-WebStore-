import type { SourceConfig } from './contracts'

export class ExportError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'ExportError'
  }
}
export function numberValue(raw: string | null | undefined): number {
  if (raw == null || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw))
    throw new ExportError('INVALID_NUMBER')
  const result = Number(raw)
  if (!Number.isFinite(result) || Math.abs(result) > Number.MAX_SAFE_INTEGER)
    throw new ExportError('NUMBER_OUT_OF_RANGE')
  return result
}
export function timestamp(
  raw: string | null | undefined,
  config: Pick<SourceConfig, 'utcOffset' | 'timezone'>,
): string {
  if (!raw) throw new ExportError('MISSING_TIMESTAMP')
  const m =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})?$/.exec(
      raw,
    )
  if (!m) throw new ExportError('INVALID_TIMESTAMP')
  const [, y, mon, d, h, min, sec, fraction, explicitOffset] = m
  const local = `${y}-${mon}-${d}T${h}:${min}:${sec}.${(fraction ?? '').padEnd(3, '0')}`
  const check = new Date(`${local}Z`)
  if (
    !Number.isFinite(check.getTime()) ||
    check.toISOString().slice(0, 23) !== local
  )
    throw new ExportError('INVALID_TIMESTAMP')
  const offset = explicitOffset ?? config.utcOffset
  if (offset !== 'Z' && !/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(offset))
    throw new ExportError('INVALID_OFFSET')
  if (/^[+-]14:(?!00)/.test(offset)) throw new ExportError('INVALID_OFFSET')
  const date = new Date(local + offset)
  if (!Number.isFinite(date.getTime()))
    throw new ExportError('INVALID_TIMESTAMP')
  if (!explicitOffset && config.timezone) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
    const get = (key: string) => parts.find((p) => p.type === key)?.value
    if (
      `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}` !==
      local.slice(0, 19)
    )
      throw new ExportError('TIMEZONE_OFFSET_MISMATCH')
  }
  return date.toISOString()
}
export function safeUrl(raw: string | null | undefined): string {
  if (!raw) throw new ExportError('MISSING_URL')
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new ExportError('INVALID_URL')
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new ExportError('UNSAFE_URL')
  // Only explicitly harmless URL query parameters are accepted; unknown signed/private URLs need review.
  for (const key of url.searchParams.keys())
    if (
      ![
        'width',
        'height',
        'w',
        'h',
        'q',
        'quality',
        'format',
        'fit',
        'v',
      ].includes(key.toLowerCase())
    )
      throw new ExportError('URL_QUERY_REQUIRES_REVIEW')
  return raw.trim()
}
export function compareIds(a: string, b: string): number {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    const x = BigInt(a),
      y = BigInt(b)
    if (x !== y) return x < y ? -1 : 1
  }
  return a < b ? -1 : a > b ? 1 : 0
}

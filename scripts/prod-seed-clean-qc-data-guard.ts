/**
 * Target guard for `prod-seed-clean-qc-data.ts`.
 *
 * The cleanup script deletes data in bulk, so it must only ever run against a
 * disposable Neon branch (`prod-seed`) cut from staging. Pure function: it
 * returns every failed rule instead of exiting, so the CLI decides what to do
 * and unit tests can assert each refusal.
 *
 * The staging endpoint below mirrors `KNOWN_NON_QC_HOSTS` in `qc-guard.ts`
 * (that list is not exported); a unit test keeps the two in sync.
 */

export const REQUIRED_TARGET_LABEL = 'prod-seed'

/** Substring match on the whole URI (endpoint ids and the production project id). */
export const DENIED_ENDPOINT_FRAGMENTS: readonly string[] = [
  'ep-blue-king-a1qufqjg', // old staging branch endpoint
  'ep-tiny-star-a1xy9aka', // live staging DB endpoint (branch pw1-migrated-261010)
  'ep-orange-sea-b3nmsmny', // production Neon endpoint (mirrors qc-guard.ts)
  'dark-glitter-99257254', // production Neon project id
]

/** Defense in depth against renamed endpoints. Same keywords as qc-guard. */
export const DENIED_HOST_KEYWORDS: readonly string[] = ['staging', 'production', '.prod.']

const LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '::1', '[::1]']

export interface GuardInput {
  databaseUri: string | undefined
  targetLabel: string | undefined
  /** Extra URIs (e.g. staging / production DATABASE_URI) whose endpoint must differ from the target. */
  forbiddenUris?: ReadonlyArray<string | undefined>
}

export type GuardResult =
  | { ok: true; host: string; pooled: boolean }
  | { ok: false; reasons: string[]; host: string }

function parseHost(uri: string | undefined): string {
  if (!uri) return ''
  try {
    return new URL(uri).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/** Neon endpoint id: first DNS label without the `-pooler` suffix. */
export function endpointId(host: string): string {
  return (host.split('.')[0] ?? '').replace(/-pooler$/, '')
}

export function evaluateTargetGuard(input: GuardInput): GuardResult {
  const reasons: string[] = []
  const uri = input.databaseUri ?? ''
  const host = parseHost(uri)

  if (input.targetLabel !== REQUIRED_TARGET_LABEL) {
    reasons.push(`--target-label must be exactly "${REQUIRED_TARGET_LABEL}"`)
  }
  if (!host) {
    reasons.push('DATABASE_URI is missing or not a parseable postgres URI')
  } else {
    if (!LOCAL_HOSTS.includes(host) && !host.endsWith('.neon.tech')) {
      reasons.push('host is neither localhost nor a *.neon.tech endpoint')
    }
    for (const fragment of DENIED_ENDPOINT_FRAGMENTS) {
      if (uri.toLowerCase().includes(fragment)) {
        reasons.push(`DATABASE_URI references denied staging/production target "${fragment}"`)
      }
    }
    for (const keyword of DENIED_HOST_KEYWORDS) {
      if (host.includes(keyword)) reasons.push(`host contains denied keyword "${keyword}"`)
    }
    for (const forbidden of input.forbiddenUris ?? []) {
      const forbiddenHost = parseHost(forbidden)
      if (forbiddenHost && endpointId(forbiddenHost) === endpointId(host)) {
        reasons.push('host is the same endpoint as a staging/production DATABASE_URI')
      }
    }
  }

  if (reasons.length > 0) return { ok: false, reasons, host }
  return { ok: true, host, pooled: host.includes('-pooler') }
}

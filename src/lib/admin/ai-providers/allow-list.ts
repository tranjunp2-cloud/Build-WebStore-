/**
 * The only internal-API calls the browser may reach through /api/admin/ai-providers/**.
 * `segments` are the path parts after the proxy prefix; the result is the exact upstream path (never built from raw input).
 */
import { HISTORY_AREAS } from './types'

const PROVIDER = /^(?:openai|anthropic|google|deepseek|openrouter|typesafe|compat-[a-z0-9][a-z0-9-]{0,39})$/
const ENDPOINT = /^[a-z0-9][a-z0-9-]{0,39}$/
const HISTORY_ID = /^[A-Za-z0-9_-]{1,64}$/

export interface AllowedCall {
  path: string
  /** the call may take a while (a provider test) */
  slow: boolean
}

const ROOT = '/internal/settings'

/** Query string for the history list: only `area` (known) and `limit` (1..200) pass. */
export function historyQuery(search: URLSearchParams): string | null {
  const out = new URLSearchParams()
  const area = search.get('area')
  if (area) {
    if (!(HISTORY_AREAS as readonly string[]).includes(area)) return null
    out.set('area', area)
  }
  const limit = search.get('limit')
  if (limit) {
    if (!/^\d{1,3}$/.test(limit) || Number(limit) < 1 || Number(limit) > 200) return null
    out.set('limit', limit)
  }
  const text = out.toString()
  return text ? `?${text}` : ''
}

export function matchCall(method: string, segments: string[], search: URLSearchParams): AllowedCall | null {
  const [a, b, c] = segments
  const n = segments.length
  const ok = (path: string, slow = false): AllowedCall => ({ path: `${ROOT}${path}`, slow })

  if (method === 'GET') {
    if (n === 0) return ok('')
    if (n === 1 && a === 'history') {
      const query = historyQuery(search)
      return query === null ? null : ok(`/history${query}`)
    }
    return null
  }
  if (method === 'PUT') {
    if (n === 1 && (a === 'gateway' || a === 'routing' || a === 'tasks' || a === 'runtime')) return ok(`/${a}`)
    if (n === 2 && a === 'providers' && PROVIDER.test(b)) return ok(`/providers/${b}`)
    if (n === 3 && a === 'providers' && PROVIDER.test(b) && c === 'key') return ok(`/providers/${b}/key`)
    return null
  }
  if (method === 'POST') {
    if (n === 1 && a === 'endpoints') return ok('/endpoints')
    if (n === 3 && a === 'providers' && PROVIDER.test(b) && c === 'test') return ok(`/providers/${b}/test`, true)
    if (n === 3 && a === 'history' && HISTORY_ID.test(b) && c === 'restore') return ok(`/history/${b}/restore`)
    return null
  }
  if (method === 'DELETE') {
    if (n === 3 && a === 'providers' && PROVIDER.test(b) && c === 'key') return ok(`/providers/${b}/key`)
    if (n === 2 && a === 'endpoints' && ENDPOINT.test(b)) return ok(`/endpoints/${b}`)
    return null
  }
  return null
}

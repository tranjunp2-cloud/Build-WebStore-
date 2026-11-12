/** Browser side of /api/admin/ai-providers: one JSON call, never throws. */
import type { FieldError } from './types'

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; errors?: FieldError[] }

const BASE = '/api/admin/ai-providers'

export async function callApi<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    })
    const json = (await res.json().catch(() => null)) as (T & { error?: string; errors?: FieldError[] }) | null
    if (!res.ok) return { ok: false, status: res.status, error: json?.error ?? `Request failed (${res.status})`, errors: json?.errors }
    return { ok: true, data: json as T }
  } catch {
    return { ok: false, status: 0, error: 'Could not reach Prime Web. Check your connection.' }
  }
}

/** First sentence to show for a failed call: the field errors when there are any. */
export function describeFailure(result: { error: string; errors?: FieldError[] }): string {
  const lines = result.errors?.map((item) => (item.path ? `${item.path}: ${item.message}` : item.message))
  return lines?.length ? lines.join(' ') : result.error
}

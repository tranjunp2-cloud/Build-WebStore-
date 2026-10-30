import 'server-only'

import { AiPlatformError, callAiPlatform } from '@/lib/ai-platform/upstream'
import { signSettingsToken, type SettingsActor } from './token'
import type { FieldError } from './types'

export type SettingsResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; errors?: FieldError[] }

export const UNREACHABLE_MESSAGE = 'AI service unreachable'

export interface SettingsCall {
  actor: SettingsActor
  method: string
  /** exact upstream path, e.g. /internal/settings/routing (see allow-list) */
  path: string
  body?: unknown
  timeoutMs?: number
}

const REQUEST_TIMEOUT_MS = 10_000
export const TEST_TIMEOUT_MS = 25_000

function parseFieldErrors(parsed: unknown): FieldError[] | undefined {
  const list = (parsed as { errors?: unknown } | null)?.errors
  if (!Array.isArray(list)) return undefined
  const out = list
    .map((item) => ({ path: String((item as { path?: unknown })?.path ?? ''), message: String((item as { message?: unknown })?.message ?? '') }))
    .filter((item) => item.message)
  return out.length ? out : undefined
}

/** What the browser is told about a failed upstream answer. Upstream text is never forwarded as is (it may echo input). */
function failure(status: number, parsed: unknown): SettingsResult<never> {
  if (status === 400 || status === 422) {
    const errors = parseFieldErrors(parsed)
    const message = (parsed as { error?: unknown } | null)?.error
    return { ok: false, status: 422, error: typeof message === 'string' ? message : 'The AI service refused these values.', errors }
  }
  if (status === 401) return { ok: false, status: 502, error: 'The AI service rejected this request. Check AI_PLATFORM_CONTEXT_SECRET on both sides.' }
  if (status === 404) return { ok: false, status: 404, error: 'Not found' }
  if (status === 429) return { ok: false, status: 429, error: 'Too many tests. Try again in a minute.' }
  if (status === 503) return { ok: false, status: 503, error: 'The AI service is not ready. Try again in a moment.' }
  return { ok: false, status: 502, error: 'The AI service could not do that.' }
}

/** One signed call to the internal settings API. Never logs the body; a transport failure is 503 "AI service unreachable". */
export async function callSettings<T = unknown>(call: SettingsCall): Promise<SettingsResult<T>> {
  let response: Response
  let text: string
  try {
    const token = await signSettingsToken(call.actor)
    response = await callAiPlatform({
      method: call.method,
      path: call.path,
      token,
      body: call.body === undefined ? undefined : JSON.stringify(call.body),
      timeoutMs: call.timeoutMs ?? REQUEST_TIMEOUT_MS,
    })
    text = await response.text()
  } catch (error) {
    if (error instanceof AiPlatformError && error.status === 503) {
      return { ok: false, status: 503, error: 'The AI service is not configured on this deployment.' }
    }
    if (error instanceof AiPlatformError) return { ok: false, status: 503, error: UNREACHABLE_MESSAGE }
    console.error('[ai-providers] call failed', call.method, call.path, error instanceof Error ? error.name : 'error')
    return { ok: false, status: 503, error: UNREACHABLE_MESSAGE }
  }
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = null
  }
  if (!response.ok) return failure(response.status, parsed)
  return { ok: true, status: response.status, data: parsed as T }
}

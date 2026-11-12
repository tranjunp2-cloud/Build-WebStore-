import { vi } from 'vitest'

export type Call = { method: string; path: string; body: unknown }
type Answer = { status?: number; body: unknown }
type Handler = Answer | ((call: Call) => Answer)

/** A fetch stand-in for /api/admin/ai-providers: answers by "METHOD /path" and records every call in order. */
export function fakeApi(routes: Record<string, Handler>) {
  const calls: Call[] = []
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace('/api/admin/ai-providers', '') || '/'
    const call: Call = { method: init?.method ?? 'GET', path, body: init?.body ? JSON.parse(String(init.body)) : undefined }
    calls.push(call)
    const handler = routes[`${call.method} ${path}`]
    if (!handler) return new Response(JSON.stringify({ error: `no route ${call.method} ${path}` }), { status: 404 })
    const answer = typeof handler === 'function' ? handler(call) : handler
    return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 })
  })
  return { fn, calls }
}

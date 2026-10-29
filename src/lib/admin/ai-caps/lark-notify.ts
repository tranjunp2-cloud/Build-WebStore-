/**
 * Posts a short text to the AI-alerts Lark custom bot (`LARK_WEBHOOK_AI_ALERTS`, optional). Never throws: a failed
 * notification must not fail the usage sync. Returns true only when Lark accepted the message.
 */
const TIMEOUT_MS = 5000

export async function postLarkAlert(text: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const url = process.env.LARK_WEBHOOK_AI_ALERTS?.trim()
  if (!url) return false
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) {
      console.warn(`[ai-caps] Lark alert refused: HTTP ${response.status}`)
      return false
    }
    // the custom bot answers 200 with { code: 0 } on success and { code: <n>, msg } when it rejects the message
    const body = (await response.json().catch(() => null)) as { code?: unknown; StatusCode?: unknown } | null
    const code = body?.code ?? body?.StatusCode
    if (code !== undefined && code !== 0) {
      console.warn(`[ai-caps] Lark alert rejected: code ${String(code)}`)
      return false
    }
    return true
  } catch (error) {
    console.warn('[ai-caps] Lark alert failed:', error instanceof Error ? error.message : error)
    return false
  }
}

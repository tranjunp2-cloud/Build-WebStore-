/**
 * The apply receipts (lib/ai-platform/apply-receipts) as a store that never holds anything: every approve starts
 * fresh and every write is accepted. For the proxy tests that are about something else; the receipts themselves
 * are covered by agent-apply-receipts.test.ts (proxy) and integration/ai-apply-receipts-postgres.test.ts (SQL).
 * Plain functions (not vi.fn) so a test's mock reset can't turn them into `undefined`.
 */
export const beginApply = async () => ({ kind: 'started' as const })
export const abandonApply = async () => undefined
export const markApplied = async () => undefined
export const markReverted = async () => undefined
export const markRecorded = async () => undefined
export const markReinstated = async () => undefined
export const readReceipt = async () => null

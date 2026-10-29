import 'server-only'
/**
 * Cap alerts, evaluated by the 5-minute usage-sync cron after the copy.
 * - platform: today's / this month's spend vs the daily / monthly cap at each `alertPercents` level crossed
 * - shop: a shop's rolling-24 h AI battery reaching its own daily budget (100 % only)
 * One `ai-cap-alerts` row per (scope, period, threshold, shop), inserted with ON CONFLICT DO NOTHING, so a re-run or an
 * overlapping run adds nothing. Only a newly inserted row is announced on Lark (when LARK_WEBHOOK_AI_ALERTS is set).
 */
import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'
import type { AiCapAlertScope } from '@/lib/ai-platform/cap-alert-scopes'
import { type ReportsDb, rowsOf } from '@/lib/reports/report-db'
import { resolveCaps } from './caps-config'
import { type LimitContext, limitsFor, loadLimitContext } from './effective-limits'
import { postLarkAlert } from './lark-notify'
import { malaysiaDayKey, malaysiaMonthKey } from './malaysia-time'
import { type PlatformSpend, type ShopSpend, loadPlatformSpend, loadShopSpend } from './spend-queries'
import { loadSavedCaps } from './status'

export interface AlertCandidate {
  scope: AiCapAlertScope
  periodKey: string
  threshold: number
  spentUsd: number
  capUsd: number
  tenantId: number | null
  /** shop name / plan for the message (shop alerts) */
  shopLabel?: string
}

export interface AlertRunResult {
  /** candidates found (thresholds crossed), new or not */
  crossed: number
  /** rows inserted by this run */
  created: number
  /** rows whose Lark message was accepted */
  notified: number
}

const usd = (value: number) => `$${value.toFixed(value < 1 ? 4 : 2)}`

/** Every alert level of the daily and monthly platform caps that today's / this month's spend has reached. */
export function platformCandidates(spend: PlatformSpend, caps: ReturnType<typeof resolveCaps>['effective'], now: number): AlertCandidate[] {
  const out: AlertCandidate[] = []
  const add = (scope: AiCapAlertScope, periodKey: string, spentUsd: number, capUsd: number | null) => {
    if (capUsd === null || capUsd <= 0) return
    const percent = (spentUsd / capUsd) * 100
    for (const threshold of caps.alertPercents) {
      if (percent >= threshold) out.push({ scope, periodKey, threshold, spentUsd, capUsd, tenantId: null })
    }
  }
  add('platform-daily', malaysiaDayKey(now), spend.todayUsd, caps.dailyUsd)
  add('platform-monthly', malaysiaMonthKey(now), spend.monthUsd, caps.monthlyUsd)
  return out
}

/** Shops whose rolling-24 h AI battery reached their effective daily budget (a budget of 0 means AI off, not an alert). */
export function shopCandidates(shops: readonly ShopSpend[], context: LimitContext, now: number): AlertCandidate[] {
  const out: AlertCandidate[] = []
  for (const shop of shops) {
    const limits = limitsFor(context, shop.tenantId, now)
    const budget = limits.aiBudgetUsd
    if (!limits.enabled || budget === null || budget <= 0 || shop.rolling24hUsd < budget) continue
    out.push({
      scope: 'shop-daily',
      periodKey: malaysiaDayKey(now),
      threshold: 100,
      spentUsd: shop.rolling24hUsd,
      capUsd: budget,
      tenantId: shop.tenantId,
      shopLabel: `${shop.name ?? `Shop #${shop.tenantId}`} (#${shop.tenantId}, ${limits.plan})`,
    })
  }
  return out
}

/** Inserts each candidate once; returns the ids of the rows that were new, keyed by candidate. */
export async function insertNewAlerts(handle: ReportsDb, candidates: readonly AlertCandidate[]): Promise<Array<{ candidate: AlertCandidate; id: number }>> {
  const inserted: Array<{ candidate: AlertCandidate; id: number }> = []
  for (const candidate of candidates) {
    const [row] = await rowsOf<{ id: number | string }>(
      handle,
      sql`INSERT INTO ai_cap_alerts (scope, period_key, threshold, spent_usd, cap_usd, tenant_id, notified_lark, created_at, updated_at)
        VALUES (${candidate.scope}, ${candidate.periodKey}, ${candidate.threshold}, ${candidate.spentUsd}, ${candidate.capUsd}, ${candidate.tenantId}, false, now(), now())
        ON CONFLICT DO NOTHING
        RETURNING id`,
    )
    if (row) inserted.push({ candidate, id: Number(row.id) })
  }
  return inserted
}

const MAX_SHOPS_IN_MESSAGE = 10

/** One message per platform scope (its highest new level) and one for all shops that newly hit their budget. */
export function alertMessages(fresh: ReadonlyArray<{ candidate: AlertCandidate; id: number }>): Array<{ text: string; ids: number[] }> {
  const messages: Array<{ text: string; ids: number[] }> = []
  for (const scope of ['platform-daily', 'platform-monthly'] as const) {
    const rows = fresh.filter((row) => row.candidate.scope === scope)
    if (rows.length === 0) continue
    const top = rows.reduce((best, row) => (row.candidate.threshold > best.candidate.threshold ? row : best))
    const { candidate } = top
    const what = scope === 'platform-daily' ? `daily cap (today ${candidate.periodKey}, Malaysia time)` : `monthly cap (${candidate.periodKey})`
    messages.push({
      text: `[AI spend] Platform ${what} is at ${candidate.threshold}%: ${usd(candidate.spentUsd)} of ${usd(candidate.capUsd)}.`,
      ids: rows.map((row) => row.id),
    })
  }
  const shops = fresh.filter((row) => row.candidate.scope === 'shop-daily')
  if (shops.length > 0) {
    const listed = shops.slice(0, MAX_SHOPS_IN_MESSAGE).map(({ candidate }) => `${candidate.shopLabel}: ${usd(candidate.spentUsd)} of ${usd(candidate.capUsd)}`)
    const more = shops.length - listed.length
    messages.push({
      text: `[AI spend] ${shops.length} ${shops.length === 1 ? 'shop reached its' : 'shops reached their'} 24 h AI budget:\n${listed.join('\n')}${more > 0 ? `\nand ${more} more` : ''}`,
      ids: shops.map((row) => row.id),
    })
  }
  return messages
}

/**
 * Evaluates every cap and records / announces the new crossings. Throws on a database failure (the cron logs it and
 * still reports the copy as done); a Lark failure never throws.
 */
export async function runCapAlerts(now: number = Date.now(), notify: (text: string) => Promise<boolean> = postLarkAlert): Promise<AlertRunResult> {
  const handle = (await getPayload({ config })) as unknown as ReportsDb
  const caps = resolveCaps(await loadSavedCaps())
  const [spend, shops] = await Promise.all([loadPlatformSpend(handle, now), loadShopSpend(handle, now)])
  const context = await loadLimitContext(handle, shops.map((shop) => shop.tenantId))
  const candidates = [...platformCandidates(spend, caps.effective, now), ...shopCandidates(shops, context, now)]
  const fresh = await insertNewAlerts(handle, candidates)
  let notified = 0
  for (const message of alertMessages(fresh)) {
    if (!(await notify(message.text))) continue
    try {
      await handle.db.drizzle.execute(
        sql`UPDATE ai_cap_alerts SET notified_lark = true, updated_at = now() WHERE id IN (${sql.join(message.ids.map((id) => sql`${id}`), sql`, `)})`,
      )
      notified += message.ids.length
    } catch (error) {
      console.warn('[ai-caps] could not mark alerts as notified:', error instanceof Error ? error.message : error)
    }
  }
  return { crossed: candidates.length, created: fresh.length, notified }
}

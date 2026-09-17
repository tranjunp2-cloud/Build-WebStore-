import {
  type MappingContext,
  type Row,
  type Doc,
  live,
  ref,
} from '../contracts'
import { timestamp } from '../primitives'

export function sourceTime(
  raw: string | null | undefined,
  ctx: MappingContext,
): string {
  if (!raw) throw new Error('SOURCE_TIMESTAMP_REQUIRED')
  return timestamp(raw, ctx.config)
}
export function times(row: Row, ctx: MappingContext): Doc {
  return {
    createdAt: sourceTime(row.created_at, ctx),
    updatedAt: sourceTime(row.updated_at, ctx),
  }
}
export function membership(
  row: Row,
  ctx: MappingContext,
): 'active' | 'suspended' {
  const now = Date.parse(ctx.config.asOf)
  if (!live(row) || !['0', '1', '2', '3'].includes(row.status ?? ''))
    throw new Error('USER_LIFECYCLE_CONFLICT')
  const ban = row.banned_at ? Date.parse(sourceTime(row.banned_at, ctx)) : null
  const expiry = row.expired_at
    ? Date.parse(sourceTime(row.expired_at, ctx))
    : null
  if (
    (row.status === '3' && (ban === null || ban > now)) ||
    (row.status !== '3' && ban !== null)
  )
    throw new Error('USER_LIFECYCLE_CONFLICT')
  if (row.status === '2' && (expiry === null || expiry > now))
    throw new Error('USER_LIFECYCLE_CONFLICT')
  if (row.status === '1' && expiry !== null && expiry <= now)
    throw new Error('USER_LIFECYCLE_CONFLICT')
  return row.status === '1' ? 'active' : 'suspended'
}
const TIERS: Record<string, string> = {
  FREEMIUM: 'free',
  STARTER_TM_USER: 'starter',
  STARTER_NON_TM_USER: 'starter',
  STANDARD_TM_USER: 'pro',
  STANDARD_NON_TM_USER: 'pro',
  PROFESSIONAL_TM_USER: 'business',
  PROFESSIONAL_NON_TM_USER: 'business',
}
export function mainSubscription(ctx: MappingContext): {
  row: Row
  plan: Row
  doc: Doc
  tier: string
} {
  const matches = (ctx.tables.plan_subscriptions ?? []).filter(
    (row) =>
      row.subscribable_type === 'App\\Models\\Store' &&
      row.subscribable_id === ctx.storeId &&
      live(row) &&
      row.name === 'main',
  )
  if (matches.length !== 1) throw new Error('SUBSCRIPTION_MAIN_AMBIGUOUS')
  const row = matches[0]
  const plan = ctx.find('plans', row.plan_id)
  if (!plan || !live(plan) || !TIERS[plan.code ?? ''])
    throw new Error('SUBSCRIPTION_PLAN_UNRESOLVED')
  const startsAt = sourceTime(row.starts_at, ctx),
    endsAt = sourceTime(row.ends_at, ctx)
  const start = Date.parse(startsAt),
    end = Date.parse(endsAt),
    now = Date.parse(ctx.config.asOf)
  const canceledAt = row.canceled_at ? sourceTime(row.canceled_at, ctx) : null
  const cancel = canceledAt ? Date.parse(canceledAt) : null
  const trial = row.trial_ends_at
    ? Date.parse(sourceTime(row.trial_ends_at, ctx))
    : null
  const emptyCancelFlag = row.canceled_immediately == null || row.canceled_immediately === ''
  if ((!emptyCancelFlag && !['0', '1'].includes(row.canceled_immediately!)) || (emptyCancelFlag && cancel !== null))
    throw new Error('SUBSCRIPTION_CANCEL_FLAG_UNKNOWN')
  // PW1 isCanceledImmediately requires canceled_at AND flag=true. An absent
  // cancellation date resolves that predicate without inventing a false source flag.
  if (emptyCancelFlag)
    ctx.issue('SUBSCRIPTION_CANCEL_FLAG_ABSENT', 'plan_subscriptions', row.id, 'canceled_immediately', 'warning', 'NO_CANCELLATION_DATE')
  const immediate = row.canceled_immediately === '1'
  if (
    start > end ||
    (cancel !== null && cancel > now) ||
    (immediate && cancel === null)
  )
    throw new Error('SUBSCRIPTION_TIME_CONFLICT')
  if (start > now) throw new Error('SUBSCRIPTION_FUTURE_START')
  if (!immediate && end <= now && trial !== null && trial > now)
    throw new Error('SUBSCRIPTION_TRIAL_PARITY')
  const status = immediate
    ? 'canceled'
    : end > now
      ? 'active'
      : cancel !== null
        ? 'canceled'
        : 'ended'
  if (cancel !== null && !immediate && end > now)
    ctx.issue('SUBSCRIPTION_ROUTE_PARITY', 'plan_subscriptions', row.id)
  return {
    row,
    plan,
    tier: TIERS[plan.code!],
    doc: {
      _ref: ref('plan-subscriptions', 'plan_subscriptions', row.id!),
      tenant: ref('tenants', 'stores', ctx.storeId),
      name: 'main',
      plan: plan.code!,
      status,
      startsAt,
      endsAt,
      canceledAt,
      ...(emptyCancelFlag ? {} : { canceledImmediately: immediate }),
      ...times(row, ctx),
    },
  }
}

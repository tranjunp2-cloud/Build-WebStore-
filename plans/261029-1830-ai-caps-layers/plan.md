# AI caps in layers (PR #2060, issue #2061)

Owner asked (2026-10-29): manage AI ceilings deeper — whole platform, per plan (enable/disable), per shop — all editable in
Prime Studio, quick view + edit on the AI usage dashboard. Build everything, E2E evidence, local CI.

## Decisions (defaults chosen by the lead, owner may change)

- Month = calendar month, Malaysia time (UTC+8), same as the existing daily cap's day.
- Effective limit for a call = the strictest of: platform → plan → shop override. Shop override can also *raise* above
  the plan (VIP) — override replaces the plan values it sets; platform caps always apply on top.
- Per plan: AI on/off switch (`ai_enabled`), budget USD per rolling 24 h (exists), pictures per rolling 24 h (exists),
  budget USD per calendar month (new), website-setup budget USD per rolling 24 h (new, tasks `sitegen.*`).
- Platform: daily USD cap, monthly USD cap, alert thresholds (%), "pause Free first" threshold (%). At that share of
  the daily or monthly cap, FREEMIUM shops are paused; at 100 % everyone is paused.
- Alerts: crossing a threshold writes one row to collection `ai-cap-alerts` (shown in Studio) and, when
  `LARK_WEBHOOK_AI_ALERTS` is set, posts to Lark. Once per threshold per period (day / month).
- Seeds: new plan rows insert-only: `ai_enabled=YES`, `ai_budget_usd_monthly=UNLIMITED`, `ai_site_budget_usd_daily=UNLIMITED`.
  Platform caps live in `ai_platform_config.settings.caps`; absent → env `AI_DAILY_BUDGET_USD` (default 20) for daily, no monthly.

## Contract

### Token claim `lim` (prime-web signs, ai-platform `ShopLimitsSchema` parses; all new fields optional for old tokens)

```ts
lim: {
  plan: string,                       // plan code
  aiBudgetUsd: number | null,         // rolling 24 h, null = unlimited (exists)
  picturesPerDay: number | null,      // rolling 24 h (exists)
  enabled?: boolean,                  // false → 403 "AI is not included in this shop's plan." (default true)
  aiBudgetUsdMonthly?: number | null, // calendar month (Malaysia); null/absent = unlimited
  siteBudgetUsd?: number | null,      // rolling 24 h, tasks with prefix "sitegen."; null/absent = unlimited
  source?: "plan" | "shop",           // "shop" when a shop override applied (logging only)
}
```

### `ai_platform_config.settings.caps` (prime-web `AiPlatformConfigSchema`, served by `GET /api/internal/ai-config`)

```ts
caps?: {
  dailyUsd?: number | null,        // null = off; absent = env AI_DAILY_BUDGET_USD
  monthlyUsd?: number | null,      // null/absent = off
  alertPercents?: number[],        // default [50, 80, 100]
  pauseFreeAtPercent?: number | null // e.g. 80; null = off (everyone pauses at 100 %)
}
```

### Shop override — collection `ai-shop-limits` (table `ai_shop_limits`)

`tenant` (rel, unique), `mode` select: `custom | unlimited | blocked`, `aiBudgetUsd` (number, null = keep plan),
`picturesPerDay`, `aiBudgetUsdMonthly`, `siteBudgetUsd` (each null = keep plan value), `reason` (text, required),
`expiresAt` (date, optional; expired = ignored), `setBy` (rel users). Super-admin only. `unlimited` → all budgets null;
`blocked` → `enabled:false`.

### Alerts — collection `ai-cap-alerts` (table `ai_cap_alerts`)

`scope` (`platform-daily | platform-monthly | shop-daily`), `periodKey` (e.g. `2026-10-29` / `2026-10`), `threshold`
(int %), `spentUsd`, `capUsd`, `tenant` (rel, shop-daily only), `notifiedLark` (bool), timestamps. Unique on
(scope, periodKey, threshold, tenant). Written by the existing 5-min cron `/api/cron/ai-usage-sync` after the copy.

## Phases / owners

| Phase | Owner (files) |
|---|---|
| 01 ai-platform enforcement | `services/ai-platform/**` |
| 02 prime-web data + APIs + alerts | `src/collections/**`, `scripts/db-setup.js`, `src/lib/ai-platform/**`, `src/lib/admin/ai-settings/**`, `src/lib/admin/ai-caps/**`, `src/app/api/**`, `src/payload.config.ts`, env examples |
| 03 Studio UI | `src/app/studio/**`, `src/lib/admin/ai-usage/**` |
| 04 E2E evidence, docs, local CI | lead |

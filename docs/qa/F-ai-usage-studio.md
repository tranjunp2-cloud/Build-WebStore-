# F — AI usage in Prime Studio (overview, logs, shop, limits & prices)

Relates to #2061. Super-admin only. Data: `ai_usage_logs` (copied from ai-platform every 5 min, now with `plan`),
`ai_generation_records` (website generation), `plan_features` (limits + `ai_platform_config`).

| Screen | Route |
|---|---|
| Overview | `/studio/performance` (sidebar Intelligence → AI usage) |
| Logs + call drawer | `/studio/performance/logs?log=<id>` |
| Shop | `/studio/performance/shops/<tenantId>` |
| Limits & prices | `/studio/settings/ai` (sidebar Admin → Settings) |

## Automated (vitest)

| TC | What | File |
|---|---|---|
| TC-AIU-SYNC-015 | Log rows carry the shop's active main plan (else FREEMIUM); a re-copy never overwrites it | `unit/ai-platform/ai-usage-sync.test.ts` |
| TC-AIU-SYNC-016 | Log rows carry why a call failed (`error_detail`: status + the provider's message, keys masked by ai-platform); older platforms → null | `unit/ai-platform/ai-usage-sync.test.ts` |
| TC-AIS-OV-001 | Period presets 24h / 7d (default) / 30d / 90d, Malaysia-day buckets | `unit/studio-ai-usage/period.test.ts` |
| TC-AIS-OV-002 | Previous period: same length, directly before | `unit/studio-ai-usage/period.test.ts` |
| TC-AIS-OV-003 | Custom `from` / `to`, clamped; bad range → 7d | `unit/studio-ai-usage/period.test.ts` |
| TC-AIS-OV-004 | Bucket and range labels | `unit/studio-ai-usage/period.test.ts` |
| TC-AIS-OV-005 | Area grouping: each call in exactly one area, SQL CASE in the same order | `unit/studio-ai-usage/groups.test.ts` |
| TC-AIS-OV-006 | Plan grouping; NULL / unknown code → Unknown | `unit/studio-ai-usage/groups.test.ts` |
| TC-AIS-OV-007 | KPI totals + real previous-period deltas, zero-filled series | `unit/studio-ai-usage/overview-queries.test.ts` |
| TC-AIS-OV-008 | p50 / p90 / max cost per shop per active day | `unit/studio-ai-usage/overview-queries.test.ts` |
| TC-AIS-OV-009 | Top shops, task / model breakdown, errors | `unit/studio-ai-usage/overview-queries.test.ts` |
| TC-AIS-OV-010 | Empty and error states, "No earlier data" delta | `unit/studio-ai-usage/screens-render.test.tsx` |
| TC-AIS-GEN-001 | Finished site generations only; success rate, median, cost per success | `unit/studio-ai-usage/generation-queries.test.ts` |
| TC-AIS-GEN-002 | Failure reasons by real code, recent failures | `unit/studio-ai-usage/generation-queries.test.ts` |
| TC-AIS-GEN-003 | Website generation section states and links | `unit/studio-ai-usage/screens-render.test.tsx` |
| TC-AIS-LOG-001 | Filters parsed from search params, unknown values dropped | `unit/studio-ai-usage/log-filters.test.ts` |
| TC-AIS-LOG-002 | Filters → parameterised SQL, LIKE escaped | `unit/studio-ai-usage/log-filters.test.ts` |
| TC-AIS-LOG-003 | Rows, totals of the filtered set, paging | `unit/studio-ai-usage/log-filters.test.ts` |
| TC-AIS-LOG-004 | Drawer: other calls in the same reply (run id) | `unit/studio-ai-usage/log-filters.test.ts` |
| TC-AIS-LOG-005 | CSV escaping and formula defusing | `unit/studio-ai-usage/csv-export.test.ts` |
| TC-AIS-LOG-006 | CSV export is super-admin only, rate limited | `unit/studio-ai-usage/csv-export.test.ts` |
| TC-AIS-LOG-007 | Logs table (no Duration column) and drawer | `unit/studio-ai-usage/screens-render.test.tsx` |
| TC-AIS-LOG-008 | Call drawer shows the failed call's status and provider message; Overview / Shop error tables show the latest one per code | `unit/studio-ai-usage/screens-render.test.tsx` |
| TC-AIS-SHOP-001 | Tenant id validation, shop header | `unit/studio-ai-usage/shop-queries.test.ts` |
| TC-AIS-SHOP-002 | Every shop query scoped to the shop; rolling 24 h spend | `unit/studio-ai-usage/shop-queries.test.ts` |
| TC-AIS-SHOP-003 | Plan limits (UNLIMITED → none, defaults, "varies") | `unit/studio-ai-usage/shop-queries.test.ts` |
| TC-AIS-LIM-001..006 | Plan groups → codes, Unlimited / number, validation, 7-day spread, would-have-hit preview | `unit/studio-ai-settings/plan-groups-and-stats.test.ts` |
| TC-AIS-LIM-009..013 | Editor draft: changes, config round trip, unpriced models, field errors, change lines | `unit/studio-ai-settings/draft.test.ts` |
| TC-AIS-LIM-014..018 | Save writes every code of a group through Payload, creates missing rows, clears caches; load | `unit/studio-ai-settings/settings-store.test.ts` |
| TC-AIS-LIM-019..020 | 7-day per shop per day query (enum-safe), unpriced models | `unit/studio-ai-settings/usage-queries.test.ts` |
| TC-AIS-LIM-021..025 | `/api/admin/ai-settings` auth (401 / 403), GET, PUT validation and results | `unit/studio-ai-settings/route.test.ts` |

## Manual

| TC | Steps | Expected |
|---|---|---|
| TC-AIS-MAN-001 | Studio → AI usage, switch 24h / 7d / 30d / 90d | KPIs, chart, tables change; deltas say "No earlier data" when the earlier period is empty |
| TC-AIS-MAN-002 | Click a shop in Top shops | Shop page: limits, last 24 h spend, cost per day with the dashed budget line (none when Unlimited), recent calls |
| TC-AIS-MAN-003 | Logs → filter Plan / Area / Outcome, click a row | Drawer shows where, who, model, tokens, cost, duration, run / chat id and other calls of that reply |
| TC-AIS-MAN-004 | Settings → switch Free AI budget to Unlimited → Save changes → confirm | `plan_features` FREEMIUM `ai_budget_usd_daily` = `UNLIMITED`; the platform picks it up within ~6 min |
| TC-AIS-MAN-005 | Enter `-1` as a budget, or a chain model with no price, Save | Inline field error, nothing written |
| TC-AIS-MAN-006 | All four screens at 375 px and in dark mode | No sideways scroll on the page; text readable |

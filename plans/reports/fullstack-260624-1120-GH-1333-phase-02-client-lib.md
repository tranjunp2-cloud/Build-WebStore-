# Phase 02 Implementation Report — EasyParcel Client Library

## Phase
- Phase: phase-02-easyparcel-client-lib
- Plan: plans/260624-1036-GH-1333-F36-easyparcel-delivery
- Status: completed

## Files Modified

| File | Lines | Action |
|------|-------|--------|
| `src/lib/shipping/easyparcel/types.ts` | 134 | created |
| `src/lib/shipping/easyparcel/client.ts` | 121 | created |
| `src/lib/shipping/easyparcel/normalize.ts` | 99 | created |
| `src/lib/shipping/easyparcel/status-map.ts` | 44 | created |
| `src/lib/shipping/get-rates.ts` | 105 | created |
| `src/lib/shipping/index.ts` | 10 | modified (+5 export lines) |

## Tasks Completed

- [x] types.ts — 4 actions + domain types (EasyParcelConfig, EasyParcelError, RateOption)
- [x] client.ts — postAction + 4 wrappers, 10s timeout + single retry (no retry on 4xx)
- [x] normalize.ts — mapState / normalizePhone / aggregateWeightKg / earliestPickupDate
- [x] status-map.ts — 12 known EP statuses + unknown fallback → 13 total entries
- [x] get-rates.ts — hybrid router: EP → flat fallback, never throws, degraded flag
- [x] index.ts exports wired
- [x] `npx tsc --noEmit` — clean (zero errors, zero output)

## Tests Status

- Type check: PASS (tsc --noEmit, zero errors)
- Unit tests: not added in this phase (pure functions in normalize.ts are unit-testable; Phase test task owns test files)

## Key Design Decisions

1. **apiKey/authKey safety** — injected into JSON body inside `postAction` only; never interpolated into error messages or logs.
2. **Currency boundary** — all internal domain values in sen (integer); RM↔sen conversion happens at `get-rates.ts` boundary (÷100 before EP, ×100 after).
3. **Retry logic** — `HTTP_ERROR` (4xx/5xx with response) does NOT retry; only network-level errors (AbortError, connection refused) get one retry.
4. **`priceSen` in `EpRateOption`** — EP API sends `price` (RM float); the interface also carries `priceSen` for cases where caller pre-converts. `get-rates.ts` prefers `priceSen` when non-null, falls back to `Math.round(price * 100)`.
5. **`getRates` signature** — accepts `destState` as optional 4th param (matches spec); when null, falls back to `params.destState`.
6. **status-map.ts** — spec says 13 enums; 12 named EP statuses + 1 unknown default = 13 total status enum values. The `STATUS_MAP` object has 12 rows because `unknown` is the fallback, not a mapped key — matches spec intent.

## Issues Encountered

None. No file ownership conflicts; all created files are in the EasyParcel-owned globs.

## Concerns

- **P1: State code verification** — `STATE_CODE_MAP` in `normalize.ts` uses identical string pass-through (e.g. `'Selangor' → 'Selangor'`). Requires sandbox verification that EP accepts these exact strings. Central table ensures single fix point.
- **P0: COD param name** — spec flags `cod` vs `cod_enabled` as unknown. Implementation uses `cod` (RM float) in `EpRateCheckParams` and `EpSubmitOrderParams`. Must verify against EP sandbox before Phase 06 wires COD checkout.
- **Pos Laju cutoff** — set to 12:50 MYT per spec note; marked P1 for sandbox verification.

## Next Steps

Unblocks:
- Phase 03: test-connection endpoint (uses `rateCheck` as auth ping)
- Phase 04: rate API route (calls `getRates`)
- Phase 05: order submission (calls `submitOrder` / `payOrder`)
- Phase 07: tracking cron (calls `parcelStatus` / `mapTrackingStatus`)

# Test Cases — F34 Plan Subscription Management

> **Status:** Phase 04 complete | Phase 05 deferred | Phase 06 pending
> **Test Type:** Unit + API
> **Automated:** ✓ Yes
> **Coverage:** Phases 01–04 fully automated

---

## F34 — Plan Subscription Management

SSO-driven subscription lifecycle: upgrade, downgrade, renew. Feature gating per plan via `plan_features` table.

---

## Test Case Matrix

### Phase 01–03: Core Subscription + SSO Endpoints

| TC-ID | Category | Description | File | Priority |
|-------|----------|-------------|------|----------|
| TC-SUB-001 | getPlanCode | FREEMIUM code regardless of type | `plan-subscription.test.ts` | P1 |
| TC-SUB-002 | getPlanCode | Appends _TM_USER for subscription_type=1 | `plan-subscription.test.ts` | P1 |
| TC-SUB-003 | getPlanCode | Appends _NON_TM_USER for type=2/null | `plan-subscription.test.ts` | P1 |
| TC-SUB-010 | isSubscriptionActive | Returns true for active + future endsAt | `plan-subscription.test.ts` | P1 |
| TC-SUB-011 | isSubscriptionActive | Returns false when endsAt is past | `plan-subscription.test.ts` | P1 |
| TC-SUB-012 | isSubscriptionActive | Returns true when canceledAt set but canceledImmediately=falsy | `plan-subscription.test.ts` | P1 |
| TC-SUB-013 | isSubscriptionActive | Returns false when status=ended | `plan-subscription.test.ts` | P1 |
| TC-SUB-014 | isSubscriptionActive | Returns false when canceledImmediately=true | `plan-subscription.test.ts` | P1 |
| TC-SUB-015 | isSubscriptionActive | Returns true when canceledImmediately=false (period-end cancel) | `plan-subscription.test.ts` | P1 |
| TC-SUB-020 | SSO upgrade auth | Returns 401 without Bearer token | `sso-upgrade.test.ts` | P1 |
| TC-SUB-020b | SSO upgrade auth | Returns 401 for invalid token | `sso-upgrade.test.ts` | P1 |
| TC-SUB-020c | SSO upgrade auth | Returns 403 for non-super-admin | `sso-upgrade.test.ts` | P1 |
| TC-SUB-021 | SSO upgrade | Returns 200 + calls upsertPlanSubscription | `sso-upgrade.test.ts` | P1 |
| TC-SUB-022 | SSO upgrade | Creates subscription if none exists (via upsert) | `sso-upgrade.test.ts` | P1 |
| TC-SUB-023 | SSO downgrade | Identical flow to upgrade, returns 'Subscription downgraded' | `sso-upgrade.test.ts` | P1 |
| TC-SUB-023b | SSO downgrade auth | Returns 401 without token | `sso-upgrade.test.ts` | P1 |
| TC-SUB-040 | recordUsage | Creates new usage record when none exists | `plan-subscription.test.ts` | P1 |
| TC-SUB-041 | recordUsage | Increments existing usage record | `plan-subscription.test.ts` | P1 |
| TC-SUB-042 | reduceUsage | Decrements but floors at 0 | `plan-subscription.test.ts` | P1 |
| TC-SUB-043 | getConsumed | Returns 0 when no usage record | `plan-subscription.test.ts` | P1 |

### Phase 04: Feature Gating

| TC-ID | Category | Description | File | Priority |
|-------|----------|-------------|------|----------|
| TC-SUB-030 | canUse | Returns true for YES value | `plan-features.test.ts` | P1 |
| TC-SUB-031 | canUse | Returns true for UNLIMITED value | `plan-features.test.ts` | P1 |
| TC-SUB-032 | canUse | Returns false for '0' value | `plan-features.test.ts` | P1 |
| TC-SUB-033 | canUse | Returns true for numeric string > 0 (e.g. '3') | `plan-features.test.ts` | P1 |
| TC-SUB-033b | canUse | Returns true for numeric '1' | `plan-features.test.ts` | P2 |
| TC-SUB-034 | canUse | Returns false when feature not found in DB | `plan-features.test.ts` | P1 |
| TC-SUB-034b | canUse | Case-insensitive: 'yes' → true | `plan-features.test.ts` | P2 |
| TC-SUB-035 | getFeatureSettings | Returns null when settings field is null | `plan-features.test.ts` | P1 |
| TC-SUB-035b | getFeatureSettings | Returns null when feature not found | `plan-features.test.ts` | P2 |
| TC-SUB-036 | getFeatureSettings | Returns parsed JSON settings object | `plan-features.test.ts` | P1 |
| TC-SUB-036b | getFeatureSettings | Returns payment code settings for payment_integration | `plan-features.test.ts` | P2 |
| TC-SUB-037 | getFeatureValue | Returns raw string value from plan_features row | `plan-features.test.ts` | P1 |
| TC-SUB-038 | getFeatureValue | Returns null when feature not found | `plan-features.test.ts` | P1 |

---

## Test Files

| File | Tests | Status |
|------|-------|--------|
| `src/__tests__/unit/subscriptions/plan-subscription.test.ts` | 19 | ✓ pass |
| `src/__tests__/api/sso-upgrade.test.ts` | 9 | ✓ pass |
| `src/__tests__/unit/subscriptions/plan-features.test.ts` | 13 | ✓ pass |

**Total automated:** 41 tests

---

## Deferred (Phase 05–06)

- TC-SUB-050..059: ETL migration validation (Phase 05 — F34.2, deferred)
- TC-SUB-060..079: Subscription enforcement layer (Phase 06 — pending)

# F37 LocalBusiness subtype mapping — v2.6

**Snapshot:** `f37-local-business-subtypes-2026-07-29`
**Reviewed by:** `@dominvopc` (Product/SEO approver confirmed for this implementation)
**Runtime policy:** checked-in and dependency-free; never fetched at request time.

**Delivery status (2026-08-03):** Phase 00–02 and Phase 03 local automation are built and synced to `origin/staging`. The per-site revisioned/coalescing serializer retains persisted-snapshot rollback and isolates late failures from a previously active site. The focused run has 219 passing tests plus 3 DB-only checks blocked by unavailable local PostgreSQL; typecheck, lint, diff check, Playwright discovery, and the no-credential skip pass. TC-F37-02-45 still requires the live staging fixture and manual Rich Results evidence. No `E2E_SITE_ID` is used.

## Sources

- [Google LocalBusiness structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- [Schema.org LocalBusiness hierarchy](https://schema.org/LocalBusiness)

Google recommends the most specific applicable LocalBusiness subtype. The
mapping below intentionally exposes one primary subtype only; multiple
`@type` values are outside US-F37-02.

## Snapshot

| Broad `businessCategory` | Allowed `schemaSubtype` options |
|---|---|
| `localBusiness` | None; emit generic `LocalBusiness` |
| `store` | `Store` — Store / Retail |
| `restaurant` | `Restaurant` — Restaurant |
| `foodEstablishment` | `Restaurant` — Restaurant; `Bakery` — Bakery; `CafeOrCoffeeShop` — Cafe or coffee shop; `FastFoodRestaurant` — Fast-food restaurant |
| `healthAndBeautyBusiness` | `BeautySalon` — Beauty salon; `DaySpa` — Day spa; `HairSalon` — Hair salon; `HealthClub` — Health club; `NailSalon` — Nail salon; `TattooParlor` — Tattoo parlour |
| `medicalClinic` | `MedicalClinic` — Medical clinic |
| `professionalService` | `ProfessionalService` — Professional service |
| `homeAndConstructionBusiness` | `Electrician` — Electrician; `GeneralContractor` — General contractor; `HVACBusiness` — HVAC business; `HousePainter` — House painter; `Locksmith` — Locksmith; `MovingCompany` — Moving company; `Plumber` — Plumber; `RoofingContractor` — Roofing contractor |
| `automotiveBusiness` | `AutoBodyShop` — Auto body shop; `AutoDealer` — Auto dealer; `AutoPartsStore` — Auto-parts store; `AutoRental` — Auto rental; `AutoRepair` — Auto repair; `AutoWash` — Auto wash; `GasStation` — Gas station; `MotorcycleDealer` — Motorcycle dealer; `MotorcycleRepair` — Motorcycle repair |
| `financialService` | `AccountingService` — Accounting service; `AutomatedTeller` — Automated teller; `BankOrCreditUnion` — Bank or credit union; `InsuranceAgency` — Insurance agency |

## Reconciliation and fallback

- Before a category is selected, the subtype control is disabled.
- A sole compatible option is auto-selected only after a seller changes the
  category. Legacy hydration never mutates a missing subtype.
- Multiple compatible options require an explicit selection.
- A category change preserves a compatible subtype, auto-selects a sole new
  option, or clears the subtype.
- Empty or incompatible persisted data emits generic `LocalBusiness` and earns
  zero subtype points. Save boundaries reject incompatible non-empty pairs.
- `businessCategory` may still derive `priceRange`; it never directly selects
  JSON-LD `@type`.

## Evolution policy

Additions require a new dated snapshot and tests. Removal or reclassification
requires a compatibility alias or explicit data remediation plan so an
existing valid tenant is never silently downgraded. The snapshot version is
code policy and is not persisted per row.

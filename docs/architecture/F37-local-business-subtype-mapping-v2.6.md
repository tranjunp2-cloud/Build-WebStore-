# F37 LocalBusiness subtype mapping — v2.6

**Snapshot:** `f37-local-business-subtypes-2026-07-29`
**Reviewed by:** `@dominvopc` (Product/SEO approver confirmed for this implementation)
**Runtime policy:** checked-in and dependency-free; never fetched at request time.

**Delivery status (2026-08-04):** Phase 00–02 and Phase 03 local automation are built. The per-site revisioned/coalescing serializer rolls back confirmed HTTP rejections and reconciles response loss against an authoritative, canonically normalized snapshot while ignoring Payload array-row metadata. Reconciliation is bounded to 5 seconds; an unresolved outcome returns failure, removes any never-sent queued revision from visible state, and locks all LocalBusiness Settings mounts until reload. The TC-F37-02-48 targeted gate passes 65/65; typecheck and lint pass. A broader related run has 245 passing assertions, with 3 schema-drift checks blocked only by unavailable local PostgreSQL. TC-F37-02-45 can authenticate locally through a temporary loopback proxy without changing repository configuration, but the current fixture is still `draft`; a published fixture and manual Rich Results evidence remain pending. No `E2E_SITE_ID` is used.

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

- Before a category is selected, or when the generic Local Business category has no compatible subtype, the subtype control is disabled. The generic category shows an explanation that it emits `LocalBusiness` directly.
- A sole compatible option is auto-selected only after a seller changes the
  category. Legacy hydration never mutates a missing subtype.
- Multiple compatible options require an explicit selection.
- A category change preserves a compatible subtype, auto-selects a sole new
  option, or clears the subtype.
- Empty or incompatible persisted data emits generic `LocalBusiness` and earns
  zero subtype points. Save boundaries reject incompatible non-empty pairs.
- Response-loss reconciliation compares server-canonical text and opening-hours values, ignores Payload row metadata, and aborts after 5 seconds.
- If reconciliation remains unknown, only the in-flight snapshot stays visible; later queued edits are rejected and every LocalBusiness form remains disabled until reload.
- `businessCategory` may still derive `priceRange`; it never directly selects
  JSON-LD `@type`.

## Evolution policy

Additions require a new dated snapshot and tests. Removal or reclassification
requires a compatibility alias or explicit data remediation plan so an
existing valid tenant is never silently downgraded. The snapshot version is
code policy and is not persisted per row.

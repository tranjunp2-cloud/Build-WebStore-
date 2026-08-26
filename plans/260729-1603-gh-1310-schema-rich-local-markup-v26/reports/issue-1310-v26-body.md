## US-F37-02: Schema-Rich Local Markup

| Wave | Priority | Size | Feature |
|:----:|:--------:|:----:|:-------:|
| 4 | P0 | M | F37 |

### Story

> **As an SME seller**, I want hours, business category, a compatible schema
> subtype, map coordinates, and price range to power JSON-LD so that search and
> AI systems receive complete LocalBusiness and Organization markup and I earn
> Schema points.

### Acceptance Criteria

#### AC-01: Emit and score complete LocalBusiness markup

```gherkin
GIVEN name+address, business category, a compatible specific schema subtype, at least one open hours row, valid lat/lng, and priceRange
WHEN the storefront homepage is rendered
THEN LocalBusiness JSON-LD includes PostalAddress, openingHoursSpecification, geo, priceRange, and the selected @type
  AND corresponding Schema points are earned
```

#### AC-02: Omit unusable opening hours

```gherkin
GIVEN all opening-hours rows are closed or incomplete
WHEN score calculation and JSON-LD emission run
THEN openingHoursSpecification is omitted
  AND opening-hours points are 0 while other valid Schema points remain earned
```

#### AC-03: Omit incomplete coordinates safely

```gherkin
GIVEN only one of latitude or longitude is set
WHEN score calculation and JSON-LD emission run
THEN geo is omitted from JSON-LD
  AND Geo points are 0 without a crash
```

#### AC-04: Reject an incompatible subtype

```gherkin
GIVEN a schema subtype is incompatible with the selected business category
WHEN the seller saves
THEN the save is rejected and the previous valid pair remains
  AND the invalid @type is not emitted
```

### Definition of Done

- [ ] FR-04..11 emit only valid, safely serialized tenant-storefront schema.
- [ ] Schema score is exactly `10+4+5+4+3+3+3+3=35`.
- [ ] FAQ remains renderable compatibility behavior but is absent from Schema scoring.
- [ ] TC-F37-02-29..46 provide registered automated/manual evidence.
- [ ] Published-fixture and Google Rich Results evidence complete before closure.

### References

- PRD v2.6: `docs/prd/F37-local-seo-search-performance.md`
- Story source: `docs/stories/F37-local-seo-stories.md`
- Mapping snapshot: `docs/architecture/F37-local-business-subtype-mapping-v2.6.md`
- QA registry: `docs/qa/F37-local-seo.md`

This body supersedes the stale FAQ/Schema-40 wording. Implementation PRs must
use `Relates to #1310`.

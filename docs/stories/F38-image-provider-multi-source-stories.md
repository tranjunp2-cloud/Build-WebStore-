# User Stories: Multi-Source Image Selection (F38)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F38 — Multi-Source Image Selection
> **Wave:** 4 | **Priority:** P2 | **Ref PRD:** [F38-image-provider-multi-source.md](../prd/F38-image-provider-multi-source.md)

---

## US-F38-01: Licensed Stock Image Selection

**Wave 4** | **P2** | **L** | **Status:** Ready

### Story

```
As a   site owner
I want a relevant, licensed stock image for every eligible generated block
So that my generated site looks useful and professional without manual image sourcing
```

### Acceptance Criteria

#### AC-1: Wikimedia winner is selected first

```gherkin
GIVEN Wikimedia returns candidates with complete reusable-license and attribution metadata
WHEN Gemini marks one bounded Wikimedia candidate set as relevant for the requested block
THEN the winning candidate is downloaded, validated, uploaded, and assigned to that block
  AND no lower-priority provider is queried for that slot
```

#### AC-2: Pixabay safeguards remain intact

```gherkin
GIVEN a Pixabay query uses the existing raw keywords, category filtering, and relevance gates
WHEN F38 is enabled and Pixabay is reached
THEN the same Pixabay safeguards run before its candidates are rated
  AND existing Pixabay unit and regression tests pass unchanged
```

### Additional Criteria

- [ ] Wikimedia candidates are rejected before rating when the original file URL, source page URL, creator, license, license URL, or attribution is missing.
- [ ] The shared stock-candidate contract includes provider, candidate ID, preview/download URL, source URL, creator, license, attribution, dimensions, and alt seed.
- [ ] Downloading remains limited to verified allowlisted hosts and existing image-byte validation.

### Definition of Done

- [ ] Wikimedia adapter returns normalized, license-valid candidates.
- [ ] Gemini selects only from the bounded, pre-validated candidate set.
- [ ] Existing Pixabay behavior and regression tests remain green.

---

## US-F38-02: Stock Image Provenance

**Wave 4** | **P2** | **M** | **Status:** Ready

### Story

```
As an  operator
I want to trace every selected stock image to its provider, original URL, license, and attribution
So that I can audit its reuse rights after site generation
```

### Acceptance Criteria

#### AC-1: Stock provenance is persisted

```gherkin
GIVEN a Wikimedia or Pixabay candidate wins selection
WHEN its Media record is created
THEN sourceProvider, sourceUrl, licenseName, licenseUrl, and attribution are saved with that record
  AND stock media is not marked as AI-generated
```

#### AC-2: Migration preserves existing media

```gherkin
GIVEN F38 adds provenance fields to Media
WHEN the deployment migration runs
THEN the fields are added without dropping or rebuilding existing Media data
  AND existing Media records remain readable
```

### Additional Criteria

- [ ] The matching `scripts/db-setup.js` migration is additive and uses `ALTER TABLE ADD COLUMN IF NOT EXISTS`.
- [ ] A candidate without complete stock provenance cannot be selected.
- [ ] AI-generated media retains the existing `aiGenerated=true` and prompt behavior instead of stock provenance.

### Definition of Done

- [ ] Media schema and safe SQL migration support all required stock-provenance fields.
- [ ] Automated coverage verifies provenance persistence and existing-media compatibility.

---

## US-F38-03: Non-Blocking Provider Fallback

**Wave 4** | **P2** | **L** | **Status:** Ready

### Story

```
As the generation system
I want to fall through the approved provider order without blocking site generation
So that an unavailable source never prevents a site from completing
```

### Acceptance Criteria

#### AC-1: A rejected Wikimedia result falls through to Pixabay

```gherkin
GIVEN Wikimedia returns no candidate with complete reusable-license metadata or no relevant rated winner
WHEN the image slot is resolved
THEN Pixabay is queried next
  AND site generation continues without failing
```

#### AC-2: Rating failure does not select an unsafe image

```gherkin
GIVEN Wikimedia or Pixabay returns more candidates than the configured top-N
WHEN Gemini returns invalid JSON, times out, is unavailable, or returns no relevant winner
THEN no image is selected solely from Gemini output
  AND the system advances to the next approved source
```

#### AC-3: Provider failure does not regress normal generation

```gherkin
GIVEN a normal generation with valid Pixabay credentials
WHEN Wikimedia is unavailable or has no usable result
THEN the existing Pixabay path still resolves images
  AND a failed provider, download, or rating step does not crash generation
```

### Additional Criteria

- [ ] Source order is fixed: Wikimedia Commons, then Pixabay, then AI generation.
- [ ] Structured logs record the attempted source, rejection reason, selected provider, and fallback stage without keys or full Gemini prompts.
- [ ] Existing timeout and rate-limit handling remains in effect.

### Definition of Done

- [ ] Automated tests cover empty results, license rejection, download failure, Gemini failure, and Pixabay fallback.
- [ ] A failed provider or rating step never aborts site generation.

---

## US-F38-04: AI Image as Final Fallback

**Wave 4** | **P2** | **M** | **Status:** Ready

### Story

```
As a   site owner
I want an AI-generated image only after neither stock source produces a relevant, license-valid candidate
So that AI credits are used only as the final image fallback
```

### Acceptance Criteria

#### AC-1: AI is used only after both stock sources fail

```gherkin
GIVEN Wikimedia and Pixabay have no relevant, license-valid winner
WHEN the image slot is eligible for AI generation
THEN an AI image is generated, uploaded, and assigned with aiGenerated=true and its prompt
  AND no AI image is generated while either stock source has an eligible winner
```

#### AC-2: AI failure remains non-blocking

```gherkin
GIVEN AI generation fails after both stock sources fail
WHEN the image slot is resolved
THEN site generation continues with the existing category-hero fallback where available
  AND otherwise leaves the slot empty without crashing
```

### Additional Criteria

- [ ] F38 does not add a user-facing provider selector, cache, endpoint, or tenant setting.
- [ ] The existing Pixabay-only path remains available as the rollout rollback path.

### Definition of Done

- [ ] Automated coverage verifies the full Wikimedia → Pixabay → AI fallback path.
- [ ] A staging generation demonstrates graceful completion when every image source fails.

# User Stories: Project Content & Template Localization (F26)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F26 — Project Content & Template Localization
> **Wave:** 2 | **Priority:** P0 | **Ref PRD:** [F26-project-content-localization.md](../prd/F26-project-content-localization.md)

---

> [!IMPORTANT]
> **Relationship to F21:** F21 localizes the **CMS/admin chrome** (buttons, menus, labels) and explicitly excludes user/AI-generated content. F26 localizes the **project's own content & the block/template library**, keyed off the existing `Sites.locale` field. F26 **reuses** F21 infra (`useI18n`, `prefer_lang`, dictionaries) — it does **not** introduce a new `project_language` column.

---

## US-F26-01: Confirm project language after AI generate

**Wave 2** | **P1** | **S** | Status: Ready

### Story

```
As a   Malaysian SME store owner
I want to confirm or correct the language the AI detected right after it generates my site
So that my site and all content I add later default to the right language (BM or EN), not a wrong AI guess
```

### Acceptance Criteria

#### AC-1: Show confirmation after generation

```gherkin
GIVEN the AI has finished generating a site and detected locale = ms
WHEN  the generation result is shown to the user
THEN  a lightweight confirmation appears: "AI created your site in Bahasa Melayu — correct?"
  AND it offers [Yes, continue] and [No, switch to English]
  AND the detected language is pre-selected
```

#### AC-2: Apply and persist the choice

```gherkin
GIVEN the confirmation is shown
WHEN  the user confirms or picks a different language
THEN  the project's language is saved to the existing `Sites.locale` field (no new column)
  AND the editor renders subsequent content in that locale
  AND the choice persists across reloads
```

### Additional Criteria
- [ ] Detection reuses existing `guessLanguageFromInput()` — no new detection lib.
- [ ] Phase 1 offers EN + BM only (zh/Tamil deferred).
- [ ] If user skips/dismisses, keep the AI-detected `Sites.locale` as-is.

### MY Market Notes
Malaysian users think bilingually (EN ⇄ BM) and may write the prompt in one language but want the site in another. An explicit confirm step prevents a wrong auto-guess from cascading into all later content.

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] `Sites.locale` persisted + verified after confirm
- [ ] TypeScript clean (`tsc --noEmit`)

---

## US-F26-02: Newly-added blocks render localized default content

**Wave 2** | **P0** | **L** | Status: Ready

### Story

```
As a   store owner customizing my site in the editor
I want blocks I add from the component library to appear in my site's language by default
So that my Malay site doesn't suddenly show English placeholder text and feel half-finished
```

### Business Value
This is the core fix for the "nửa mùa" (half-baked) problem: AI builds a BM site, but every newly dragged-in block currently shows English defaults, breaking trust and raising cognitive load.

### Acceptance Criteria

#### AC-1: Locale-aware default content on insert

```gherkin
GIVEN a site with locale = ms
WHEN  the user adds a new block from the component library
THEN  the block is inserted with its Bahasa Melayu default content (headline, labels, CTA, sample text)
  AND not English placeholder content
```

#### AC-2: English sites unaffected

```gherkin
GIVEN a site with locale = en
WHEN  the user adds a new block
THEN  the block is inserted with its English defaults (current behavior preserved)
```

#### AC-3: Safe fallback when a bundle is missing

```gherkin
GIVEN a block type has no BM default bundle yet
WHEN  it is added to a ms site
THEN  the system falls back to the English default (no crash)
  AND flags the block as "needs translation" (handoff to US-F26-04)
```

### Additional Criteria
- [ ] Build EN + BM default-content bundles per block type (hand-authored, not machine-translated).
- [ ] Central defaults registry keyed by `blockType` + `locale`; covers blocks in `src/blocks/registry.ts`.
- [ ] Reuse `Sites.locale` to resolve the active locale in the editor add-block flow.

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] EN + BM default bundles exist for all library blocks (or fallback flagged)
- [ ] Unit tests: add-block inserts correct locale defaults for en and ms
- [ ] TypeScript clean (`tsc --noEmit`)

---

## US-F26-03: Smart Component Adder — localized previews

**Wave 2** | **P1** | **M** | Status: Ready

### Story

```
As a   store owner browsing the component library
I want each component's title and sample text shown in my site's language
So that I can recognize what I'm adding without mentally translating English previews
```

### Acceptance Criteria

#### AC-1: Previews render in site locale

```gherkin
GIVEN a site with locale = ms
WHEN  the user opens the Block Library panel
THEN  component titles and sample/preview text render in Bahasa Melayu
```

#### AC-2: Auto-translate affordance for un-localized components

```gherkin
GIVEN a component has no hand-translation for the site locale
WHEN  it is displayed in the library
THEN  a small AI "auto-translate" icon is shown next to it
  AND its tooltip reads "Auto-translate this component to [site language]"
```

### Additional Criteria
- [ ] Extend `BlockLibraryPanel.tsx` category labels + previews to honor `Sites.locale`.
- [ ] Reuse F21 i18n (`t.editor.blockLibrary`) for static panel chrome.

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Library previews verified in both en and ms
- [ ] TypeScript clean (`tsc --noEmit`)

---

## US-F26-04: AI on-the-fly translation fallback

**Wave 2** | **P1** | **M** | Status: Ready

### Story

```
As a   store owner
I want components without a ready translation to be auto-translated into my site language when added
So that I am never stuck with English text on a Malay site
```

### Acceptance Criteria

#### AC-1: Trigger when a hand-translation is missing

```gherkin
GIVEN a block lacks a BM default bundle
WHEN  it is added to a ms site OR the user taps the auto-translate icon
THEN  its default content is translated to BM via the AI translate endpoint
  AND the translated content is inserted into the page
```

#### AC-2: Quality and safety

```gherkin
GIVEN an auto-translation request
WHEN  the AI call fails or times out
THEN  the system falls back to the English default
  AND shows a non-blocking notice (no broken page)
```

#### AC-3: Caching

```gherkin
GIVEN a block default has already been auto-translated for a locale
WHEN  the same default is needed again
THEN  the cached translation is reused (no repeat AI cost)
```

### Additional Criteria
- [ ] Server-side translate route (new `src/app/api/ai/translate/route.ts` or reuse `src/lib/ai`).
- [ ] Depends on US-F26-02 (consumes the "needs translation" flag).
- [ ] May be deferred to a later sub-phase if hand-translated coverage is sufficient.

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Failure path falls back to EN default, verified
- [ ] Translation cache verified
- [ ] TypeScript clean (`tsc --noEmit`)

---

## US-F26-05: Quick Language Switcher in editor toolbar

**Wave 2** | **P1** | **M** | Status: Ready

### Story

```
As a   store owner
I want a one-click language switch on the editor toolbar that re-languages the whole page including newly added blocks
So that I can instantly fix a page that ended up mixing English and Malay
```

### Acceptance Criteria

#### AC-1: Toolbar switcher reflects site language

```gherkin
GIVEN the user is editing a site
WHEN  they look at the editor toolbar
THEN  they see the current site language with a switcher (BM / EN)
```

#### AC-2: One-click re-language

```gherkin
GIVEN a page with blocks showing mixed languages
WHEN  the user switches the language on the toolbar
THEN  blocks still holding default/untouched content re-render in the new locale
  AND content the user has manually edited is preserved (not overwritten)
  AND the new locale is saved to `Sites.locale`
```

### Additional Criteria
- [ ] Distinguish user-edited content vs untouched defaults so a switch never destroys manual edits.
- [ ] Reuses the locale default bundles from US-F26-02.

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Switch preserves user-edited fields; swaps only untouched defaults — verified
- [ ] `Sites.locale` persisted on switch
- [ ] TypeScript clean (`tsc --noEmit`)

---

## US-F26-06: Complete block content-injection locale coverage

**Wave 2** | **P1** | **M** | Status: Ready

### Story

```
As a   product team member
I want every block in the AI generation pipeline to have both BM and EN content coverage
So that AI-generated Malay sites have zero English leftovers from the first render
```

### Acceptance Criteria

#### AC-1: Coverage audit matrix

```gherkin
GIVEN the block registry and the content-injection pipeline
WHEN  the audit runs
THEN  a matrix lists every block × {EN, BM} default-content status (present / missing)
```

#### AC-2: Close the gaps

```gherkin
GIVEN the audit matrix shows missing BM coverage
WHEN  the gaps are filled
THEN  every block reachable by AI generation + content-injection has BM content
  AND `src/lib/ai/content/*` is extended accordingly
```

### Additional Criteria
- [ ] ⚠️ Coordinate with branch `fix/ai-gen-locale-ms` (20+ commits already localizing testimonials/features/contact/nav) — merge or rebase first to avoid conflicts.
- [ ] Output the audit matrix into the F26 architecture doc.

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Coverage matrix documented; all generation-path blocks have BM content
- [ ] No regression in `fix/ai-gen-locale-ms` work
- [ ] TypeScript clean (`tsc --noEmit`)

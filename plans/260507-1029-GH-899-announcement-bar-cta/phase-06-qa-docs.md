# Phase 06 — QA registration + Changelog

**Status:** completed
**Effort:** 0.5h
**Owner files:** `docs/qa/F05-ai-editor-testcases.md`, `docs/CHANGELOG.md`
**Blockers:** Phase 05

## Goal

Register TC-IDs in QA doc; add CHANGELOG entry.

## QA doc update — `docs/qa/F05-ai-editor-testcases.md`

Append section:

```md
## GH-899 — Announcement Bar CTA & Configuration

| TC-ID | Description | Type |
|-------|-------------|------|
| TC-F05-899-01 | Gradient default Color 2 | unit |
| TC-F05-899-02 | Gradient custom Color 2 | unit |
| TC-F05-899-03 | Solid variant render | unit |
| TC-F05-899-04 | Minimal variant render | unit |
| TC-F05-899-05 | CTA hidden when linkText empty | unit |
| TC-F05-899-06 | CTA visible + clickable | unit |
| TC-F05-899-07 | paddingY applied | unit |
| TC-F05-899-08 | paddingY default 12 | unit |
| TC-F05-899-09 | dismissible: false hides close | unit |
| TC-F05-899-10 | Schema parses new fields | unit |
| TC-F05-899-11 | Schema rejects out-of-range paddingY | unit |
| TC-F05-899-12 | Preview gradient branch | unit |
| TC-F05-899-13 | Preview solid branch | unit |
| TC-F05-899-14 | Preview minimal branch | unit |
| TC-F05-899-15 | Preview empty linkText | unit |
| TC-F05-899-16 | Editor: edit message field | manual |
| TC-F05-899-17 | Editor: edit linkText/linkUrl | manual |
| TC-F05-899-18 | Editor: switch external/internal URL | manual |
| TC-F05-899-19 | Editor: Color 2 only shown for gradient | manual |
| TC-F05-899-20 | Editor: Layout & Spacing hidden | manual |
```

## CHANGELOG entry — `docs/CHANGELOG.md`

Under upcoming section:

```md
### Fixed
- **announcement-bar:** restore editor support for message and CTA link fields (GH-899)
- **announcement-bar:** preview renderer now respects `variant` (gradient/solid/minimal)
- **announcement-bar:** padding slider no longer shown without effect — replaced by internal vertical padding control

### Added
- **announcement-bar:** dual-color gradient (`backgroundColor2`)
- **announcement-bar:** internal/external URL toggle for CTA link
```

## Acceptance

- [ ] TC table appended; row count matches phase-05
- [ ] CHANGELOG entry under correct version
- [ ] No broken links in QA doc

## Risks

- CHANGELOG version unclear — add to "Unreleased" section if exists, else top of file.

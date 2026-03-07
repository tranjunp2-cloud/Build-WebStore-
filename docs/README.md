# PrimeWeb — Docs

> Feature documentation organized by BMAD workflow phase.

## Structure

```
docs/
├── prd/            ← Product Requirement Documents (PO Agent output)
├── architecture/   ← System design notes (Architect Agent output)
├── stories/        ← User Stories with Gherkin AC
├── qa/             ← QA reports & test checklists
└── decisions/      ← Architecture Decision Records (ADR)
```

## Workflow

1. **PO Agent** creates PRD → `docs/prd/[feature].md`
2. **Architect Agent** creates arch note → `docs/architecture/[feature].md`
3. **Readiness Gate** 4/4 PASS
4. **Dev Agent** implements code
5. **QA Agent** verifies → `docs/qa/[feature].md`

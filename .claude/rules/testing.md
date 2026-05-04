---
name: testing
description: Testing conventions — TC-ID references, AAA pattern, vi.mock, gold-standard files
paths:
  - "src/__tests__/**"
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "tests/**"
  - "docs/TEST_CONVENTION.md"
  - "docs/qa/**"
---

# Testing

Follow `docs/TEST_CONVENTION.md` for all test code. Key rules:

- Every test MUST reference TC-ID from `docs/qa/F*.md`
- Import from source code — NEVER re-implement logic in tests
- AAA pattern: Arrange, Act, Assert
- `vi.mock()` at top of file, never inside test functions
- `beforeEach`/`afterEach` cleanup mandatory

## Gold standard files (copy patterns from)

- `src/__tests__/unit/otp/otp-generate.test.ts` — pure function
- `src/__tests__/unit/builder/builder-store.test.ts` — Zustand store
- `src/__tests__/unit/localization/f21-localization.test.tsx` — component + TC-ID

## Coverage targets

See `docs/TEST_CONVENTION.md` for current thresholds. Targets:
- Lines: 70%
- Branches: 70%
- Functions: 70%

(Raised from 60/50/50 on 2026-04-19. If main currently below, catch-up sprint before hard-gating.)

## Commands

```bash
npm test                 # vitest run
npm run test:watch       # watch mode
npm run test:coverage    # with coverage report
npm run test:e2e         # Playwright
npm run test:all         # unit + e2e
```

## DO NOT

- Use fake data, mocks, cheats, or tricks to pass build or GitHub Actions
- Re-implement source logic inside tests (makes tests meaningless)
- Skip failing tests — fix them, don't bypass
- Place `vi.mock()` inside `describe()` or `it()` — must be top-level

## When tests fail

1. Read error message + stack trace
2. Check if code regression or test is outdated
3. If code bug → fix code, re-run
4. If test outdated (intentional behavior change) → update test + document in PR description
5. If flaky → isolate, rerun, investigate async/timing; never retry-to-green

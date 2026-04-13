# Phase 1: Parallel CI Jobs + Caching

## Context
- Parent: [plan.md](plan.md)
- File: `.github/workflows/ci.yml`
- **Priority:** P1 | **Status:** ⬜

## Current (1 job, sequential): 8.7 min
```
ci job: checkout → setup → install (53s) → lint (15s) → typecheck (31s)
        → test (215s) → build (192s) → docker-check → metrics → notify
```

## Target (4 jobs, parallel): 4.5 min

### Job 1: `quality-check` (1.5 min)
```yaml
steps:
  - Checkout
  - Setup Node + npm cache
  - Install (cached ~30s)
  - Lint + Typecheck (parallel via npm script)
  - Check DB migrations (PR only)
```

### Job 2: `test` (needs: quality-check) (3.5 min)
```yaml
steps:
  - Checkout
  - Setup Node + npm cache
  - Install (cached)
  - Run tests with coverage
  - Upload coverage artifact
```

### Job 3: `build` (needs: quality-check) (3 min)
```yaml
steps:
  - Checkout
  - Setup Node + npm cache
  - Install (cached)
  - Cache .next/cache (Next.js build cache)
  - Build
```

### Job 4: `metrics` (needs: test + build, PR only) (30s)
```yaml
steps:
  - Download coverage artifact
  - Parse coverage + bundle size
  - Comment quality metrics on PR
```

### Job 5: `notify-fail` (needs: all, if failure) (10s)
```yaml
steps:
  - Smart-notify Lark on failure
```

## Caching Strategy

| Cache | Key | Savings |
|-------|-----|---------|
| npm (~/.npm) | `hashFiles('package-lock.json')` | -25s install |
| .next/cache | `hashFiles('src/**')` | -60s build |

## Implementation Steps

- [ ] Split single `ci` job → 5 jobs with `needs:` dependencies
- [ ] Add `.next/cache` caching in build job
- [ ] Create `npm run lint:typecheck` script (parallel lint + typecheck)
- [ ] Move PR metrics to separate job (only runs on PR)
- [ ] Keep docs-only skip (`paths-ignore`)
- [ ] Test: PR → verify parallel execution in Actions tab

## Success Criteria
- [ ] CI total time < 5 min
- [ ] All 3690 tests still pass
- [ ] PR quality comment still works
- [ ] Failure notification still works

## Risk
- Parallel jobs = more runner time (but within free tier since each is shorter)
- Cache miss on first run = same as before (no regression)

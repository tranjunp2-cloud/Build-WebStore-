# PR Review Checklist — 9-Point Done

> Dung cho moi PR truoc khi approve. Reviewer check tung muc.

## Checklist

### 1. Code Quality
- [ ] Khong co `any` type (tru truong hop justified)
- [ ] Khong co `console.log` debug (chi `console.error` cho error handling)
- [ ] Named exports (tru pages/layouts)
- [ ] Error handling ro rang — khong silent catch

### 2. Security
- [ ] Khong hardcode secrets/credentials
- [ ] Input validated (Zod schemas)
- [ ] SQL injection safe (dung ORM/parameterized)
- [ ] XSS safe (sanitize user input)
- [ ] Auth check dung (withAuth, role-based)

### 3. Database
- [ ] Schema changes co migration trong `scripts/db-setup.js`
- [ ] Migration dung naming convention (xem CLAUDE.md)
- [ ] Khong co `DROP TABLE`
- [ ] Index cho query performance

### 4. Testing
- [ ] Unit tests cho logic moi (>80% coverage)
- [ ] TC-ID reference tu `docs/qa/F*.md`
- [ ] Tests pass local (`npm test`)

### 5. TypeScript
- [ ] `tsc --noEmit` pass
- [ ] Khong co lint errors

### 6. Performance
- [ ] Khong co N+1 queries
- [ ] Images co width/height (tranh CLS)
- [ ] Lazy loading cho below-fold content

### 7. PR Format
- [ ] Title theo Conventional Commits (`feat(scope): message`)
- [ ] Story ID trong title: `[US-FXX-YY]`
- [ ] Description day du (changes, test steps)
- [ ] `Relates to #N` (khong `Closes #N`)

### 8. Backward Compatibility
- [ ] Khong break existing APIs
- [ ] Env vars moi co trong `.env.*.example`
- [ ] DB changes backward compatible

### 9. Documentation
- [ ] API changes update trong docs
- [ ] Complex logic co comment giai thich
- [ ] Breaking changes ghi trong PR description

# Phase 05: Block Component Audit & Apply Tokens

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 01-04 (all tokens + validation)
- Priority: P1
- Status: pending

## Mục tiêu
Apply design tokens + typography + color system vào tất cả 47 block components. Đây là phase lớn nhất.

## Approach

### Chia thành 3 batches

**Batch A: Core blocks (5 blocks — highest impact)**
- hero (12 variants) — display heading, CTA buttons, spacing
- features (8 variants) — icon sizes, grid consistency
- testimonials (8 variants) — quote length, avatar, rating
- navigation (6 variants) — sticky, CTA, mobile
- footer (6 variants) — columns, socials, copyright

**Batch B: Secondary blocks (9 blocks)**
- contact, pricing, gallery, cta, stats, faq, team, newsletter, about

**Batch C: Industry + Utility blocks (33 blocks)**
- Tất cả blocks còn lại

### Checklist per block

Mỗi block component cần audit:

```
[ ] SectionWrapper — dùng token padding, container
[ ] Typography — heading dùng TYPE_SCALE, body >= text-base
[ ] Colors — dùng semantic CSS vars (--surface-*, --text-*, --accent)
[ ] Spacing — dùng SPACING tokens, không hardcode px
[ ] Icons — dùng ICON_SIZE tokens (sm/md/lg)
[ ] Cards — CARD_PADDING tokens, không nest cards
[ ] CTA buttons — min 44px height, action verb label
[ ] Responsive — mobile 1-col, touch targets 44px+
[ ] Content validation — wire validateBlockContent()
[ ] Variant min content — wire enforceMinContent()
```

### Parallel execution

Mỗi batch có thể chạy bằng 1 subagent riêng:
```
Agent Batch A: hero, features, testimonials, navigation, footer
Agent Batch B: contact, pricing, gallery, cta, stats, faq, team, newsletter, about
Agent Batch C: 33 remaining blocks
```

## Implementation per block (template)

```typescript
// BEFORE (typical block)
<section className="py-16 px-4">
  <div className="max-w-6xl mx-auto">
    <h2 className="text-3xl font-bold mb-4">{headline}</h2>
    <p className="text-gray-600 mb-8">{subheadline}</p>
    <div className="grid grid-cols-3 gap-6">
      {items.map(item => (
        <div className="p-6 bg-white rounded-lg shadow">
          <div className="w-10 h-10">{icon}</div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-sm text-gray-500">{desc}</p>
        </div>
      ))}
    </div>
  </div>
</section>

// AFTER (with design tokens)
<SectionWrapper padding="default" container="default">
  <Heading level={2}>{headline}</Heading>
  <Body className="text-[var(--text-secondary)] mb-8">{subheadline}</Body>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    {items.map(item => (
      <div className={`${CARD_PADDING.md} bg-[var(--surface-card)] rounded-lg shadow`}>
        <div className={ICON_SIZE.md}>{icon}</div>
        <Heading level={3}>{title}</Heading>
        <Body size="base">{desc}</Body>
      </div>
    ))}
  </div>
</SectionWrapper>
```

## Todo
- [ ] Batch A: Audit + apply tokens to 5 core blocks
- [ ] Batch B: Audit + apply tokens to 9 secondary blocks
- [ ] Batch C: Audit + apply tokens to 33 remaining blocks
- [ ] Run visual regression: screenshot all 142 variants before/after
- [ ] Fix any visual regressions

## Success Criteria
- [ ] 100% blocks dùng SectionWrapper
- [ ] 100% headings dùng TYPE_SCALE tokens
- [ ] 100% body text >= 16px
- [ ] 100% blocks dùng semantic color vars
- [ ] 100% icon sizes dùng ICON_SIZE tokens
- [ ] 100% CTA buttons >= 44px height
- [ ] No visual regressions in existing sites

## Risk Assessment
- **High**: 47 blocks × multiple variants = rất nhiều code changes
- **Mitigation**: Batch approach, visual regression screenshots, incremental PRs
- **Phase 05 nên chia thành 3 PRs riêng** (1 per batch) để dễ review

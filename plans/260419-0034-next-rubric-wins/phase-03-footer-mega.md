# Phase 03 — Footer Mega Variant + Link Columns

## Context links
- Parent: [plan.md](plan.md)

## Overview
Date: 2026-04-19
Description: Evaluator `footerMegaColumns` requires `footer.variant === 'mega'` AND `columns` array ≥4. Current: composer emits default footer without explicit mega structure.
Priority: P1
Status: pending

## Key Insights
- Footer block renderer supports multiple variants — mega structure có 4 link columns (sitemap, support, legal, company)
- Composer buildFooter hiện tại emit simple footer. Upgrade to mega với structured columns.
- Real sitemap links từ page list + canonical support/legal/social stubs

## Requirements
- Composer buildFooter emits variant='mega' + columns ≥4
- Each column có header + list of links

## Architecture
```ts
// template-composer.ts buildFooter:
return {
  blockType: 'footer',
  variant: 'mega',
  logoText: biz.name,
  columns: [
    { title: 'Explore', links: pageNames.map(p => ({ label: p, url: p === '/' ? '/' : `/${p}` })) },
    { title: 'Company', links: [{ label: 'About', url: '/about' }, { label: 'Contact', url: '/contact' }] },
    { title: 'Support', links: [{ label: 'Help Center', url: '/help' }, { label: 'FAQ', url: '/faq' }] },
    { title: 'Legal', links: [{ label: 'Privacy', url: '/privacy' }, { label: 'Terms', url: '/terms' }] },
  ],
  socials: [...],
  copyright: `© ${new Date().getFullYear()} ${biz.name}. All rights reserved.`,
}
```

## Related code files
- `src/lib/ai/template-composer.ts` buildFooter()
- `src/blocks/footer/config.ts` (verify columns shape accepted)
- `src/blocks/footer/index.tsx` (verify mega variant renders columns)

## Implementation Steps
1. Inspect existing buildFooter signature + output
2. Upgrade to mega structure với 4 columns
3. Regen matrix → verify footer.variant === 'mega' + columns.length ≥ 4
4. Typecheck
5. Visual QA 1 fixture

## Success Criteria
- `footer-mega-columns` criterion: 0% → 100%
- density dim 7.5 → 8.5+

## Risk Assessment
- Medium: renderer mega variant có thể không support existing data shape. Verify footer/index.tsx mega rendering.

## Security Considerations
- Static links, no user data

## Next steps
- Phase 04: verify + commit

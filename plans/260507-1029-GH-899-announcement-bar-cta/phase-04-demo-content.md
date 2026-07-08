# Phase 04 — Demo / preview content

**Status:** completed
**Effort:** 0.25h
**Owner file:** `src/lib/admin/block-preview-demo-content-part2.ts`
**Blockers:** Phase 01

## Goal

Showcase new fields in block-preview thumbnail/demo so admins see realistic announcement-bar.

## Change

Update announcement-bar entry in the demo map. Find the existing object (search for `'announcement-bar'` or `announcementBar`) and add new fields:

```ts
'announcement-bar': {
  blockType: 'announcement-bar',
  variant: 'gradient',
  message: 'Free shipping on orders over $50',
  linkText: 'Shop now',
  linkUrl: '/shop',
  dismissible: true,
  backgroundColor: '#7C3AED',
  backgroundColor2: '#EC4899',
  paddingY: 14,
}
```

Adjust to match existing entry style in the file (likely uses object literal in an array/map).

## Acceptance

- [ ] Demo content includes `linkText`, `linkUrl`, `backgroundColor2`, `paddingY`
- [ ] Block preview thumbnail shows gradient with link
- [ ] No type errors

## Risks

- File may export multiple variants — keep parity by also adding `solid` and `minimal` if pattern requires it. Scout file first.

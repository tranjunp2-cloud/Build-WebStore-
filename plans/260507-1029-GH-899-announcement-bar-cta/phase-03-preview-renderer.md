# Phase 03 — Preview renderer variant branches

**Status:** completed
**Effort:** 0.5h
**Owner file:** `src/app/api/preview/renderers/sections.ts` (lines 154-157)
**Blockers:** Phase 01

## Goal

Studio preview HTML must reflect the variant selected, matching component output.

## Current code (lines 154-157)

```ts
if (bt === 'announcement-bar') {
  const message = (block.message as string) || ''
  return '<div style="background:' + t.primary + ';color:#fff;text-align:center;padding:10px 20px;font-size:13px;font-weight:600">' + message + '</div>'
}
```

## Replacement

```ts
if (bt === 'announcement-bar') {
  const message = (block.message as string) || ''
  const linkText = (block.linkText as string) || ''
  const linkUrl = (block.linkUrl as string) || '#'
  const bg1 = (block.backgroundColor as string) || t.primary
  const bg2 = (block.backgroundColor2 as string) || t.secondary
  const paddingY = (block.paddingY as number) || 12

  let bgStyle: string
  let color = '#fff'
  if (variant === 'gradient') {
    bgStyle = 'background:linear-gradient(135deg,' + bg1 + ',' + bg2 + ')'
  } else if (variant === 'minimal') {
    bgStyle = 'background:transparent;border-bottom:1px solid ' + t.primary + '20'
    color = t.text
  } else {
    bgStyle = 'background:' + bg1
  }

  const linkPart = linkText.trim()
    ? ' <a href="' + linkUrl + '" style="color:inherit;text-decoration:underline;font-weight:600">' + linkText + ' &rarr;</a>'
    : ''

  return '<div style="' + bgStyle + ';color:' + color + ';text-align:center;padding:' + paddingY + 'px 20px;font-size:13px;font-weight:600">' + message + linkPart + '</div>'
}
```

## Acceptance

- [ ] `gradient` variant → output contains `linear-gradient(`
- [ ] `solid` variant → output contains `background:` followed by single color
- [ ] `minimal` variant → output contains `background:transparent`
- [ ] Empty `linkText` → no `<a>` tag in output
- [ ] `paddingY` reflected in inline padding

## Risks

- HTML string concatenation — escape user content? Existing renderer doesn't escape in similar branches; out-of-scope for this fix (consistent with file conventions).
- `t.secondary` exists — verify the theme object shape upstream (file already uses `t.primary`, `t.text`, `t.muted`; check for `t.secondary` or use fallback `'#666'`).

## Test prep (consumed by phase-05)

Snapshot tests with 3 variants × CTA on/off = 6 cases.

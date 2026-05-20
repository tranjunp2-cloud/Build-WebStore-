# Phase 01 — Schema + Component

**Status:** completed
**Effort:** 1h
**Owner files:** `src/blocks/announcement-bar/config.ts`, `src/blocks/announcement-bar/index.tsx`

## Goal

Add new optional schema fields and update component to consume them. No editor changes yet (phase-02).

## Schema changes — `config.ts`

Add to `AnnouncementBarConfig` type and `AnnouncementBarConfigSchema`:

```ts
backgroundColor2?: string   // gradient Color 2 (overrides CSS_VARS.secondary)
paddingY?: number           // 4-32 px, default 12 (current py-3 = 12px)
linkIsInternal?: boolean    // editor-only marker; runtime treats linkUrl as plain string
```

Zod additions:
- `backgroundColor2: z.string().optional()`
- `paddingY: z.number().int().min(4).max(32).optional()`
- `linkIsInternal: z.boolean().optional()`

Update `editableFields` meta to include: `'message', 'linkText', 'linkUrl', 'dismissible', 'backgroundColor', 'backgroundColor2', 'paddingY'`.

## Component changes — `index.tsx`

1. Destructure new props: `backgroundColor2, paddingY = 12`.
2. Replace gradient line:
   ```ts
   case 'gradient':
     return { background: `linear-gradient(135deg, ${bg}, ${backgroundColor2 || CSS_VARS.secondary})` }
   ```
3. Replace `className="py-3 px-6"` on the inner div with inline style:
   ```tsx
   <div className="px-6" style={{ ...bgStyle, color: textColor, paddingTop: paddingY, paddingBottom: paddingY }}>
   ```
4. Guard CTA: `linkText && linkText.trim() && linkUrl` (prevents whitespace-only label rendering link).

## Acceptance

- [ ] `npx tsc --noEmit` passes
- [ ] Existing render with no new fields = visually identical (smoke check via storybook/preview)
- [ ] Component prop drilling: `backgroundColor2`, `paddingY` reach inline style
- [ ] CTA hides when `linkText.trim() === ''`

## Files modified

- `src/blocks/announcement-bar/config.ts`
- `src/blocks/announcement-bar/index.tsx`

## Risks

- Inline padding may collide with future blockSpacing support — acceptable: bar is floating, blockSpacing not applied.

## Test prep (consumed by phase-05)

Component contract for tests:
- Default render: `paddingY=12`, gradient with `CSS_VARS.secondary` for Color 2
- With `backgroundColor2='#ff0000'`: linear-gradient contains `#ff0000`
- With `paddingY=24`: inline style `paddingTop: 24px`
- With `linkText='   '`: no `<a>` in output

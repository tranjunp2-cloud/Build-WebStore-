# Phase 02 — SettingsPanel announcement-bar section

**Status:** completed
**Effort:** 1.5h
**Owner file:** `src/components/editor/SettingsPanel.tsx` (additive only)
**Blockers:** Phase 01 (schema fields exist)

## Goal

Add a dedicated `bt === 'announcement-bar'` section so editors can edit message/CTA/colors/padding. Hide generic Layout & Spacing sliders for this block.

## Two edits

### Edit A: Hide Layout & Spacing sliders for announcement-bar (line ~1284)

Current:
```tsx
{block.blockType !== 'navigation' && block.blockType !== 'footer' && (
```

Change to:
```tsx
{block.blockType !== 'navigation' && block.blockType !== 'footer' && block.blockType !== 'announcement-bar' && (
```

### Edit B: Insert announcement-bar section (placement near line ~1450, after generic CTA branch)

```tsx
{bt === 'announcement-bar' && (
  <div className={sectionCls}>
    <label className="text-xs font-medium uppercase text-gray-500">Announcement Bar</label>

    {/* Message */}
    <div className="mt-2">
      <label className={labelCls}>Message</label>
      <Textarea defaultValue={(block.message as string) || ''} rows={2} key={`msg-${bk}`}
        onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'message', e.target.value)}
        variant="editor" className={editorTextareaClassName}
        placeholder="Free shipping on orders over $50" />
    </div>

    {/* CTA Link Group */}
    <div className="mt-3 space-y-2">
      <label className={labelCls}>Link Text (leave empty to hide link)</label>
      <Input defaultValue={(block.linkText as string) || ''} key={`lt-${bk}`}
        onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'linkText', e.target.value)}
        variant="editor" className={editorInputClassName} placeholder="Shop now" />

      {/* External / Internal toggle */}
      <div className="flex gap-2 text-[11px]">
        <button type="button"
          onClick={() => onBlockFieldChange(currentBlockIndex, 'linkIsInternal', false)}
          className={cn('rounded px-2 py-1', !block.linkIsInternal ? 'bg-blue-500/15 text-blue-400' : 'bg-white/5 text-gray-500')}
        >External URL</button>
        <button type="button"
          onClick={() => onBlockFieldChange(currentBlockIndex, 'linkIsInternal', true)}
          className={cn('rounded px-2 py-1', block.linkIsInternal ? 'bg-blue-500/15 text-blue-400' : 'bg-white/5 text-gray-500')}
        >Internal Page</button>
      </div>

      {block.linkIsInternal ? (
        <select
          value={(block.linkUrl as string) || ''}
          onChange={(e) => onBlockFieldChange(currentBlockIndex, 'linkUrl', e.target.value)}
          className={editorInputClassName}
        >
          <option value="">— select page —</option>
          {pages?.map(p => (
            <option key={p.slug} value={`/${p.slug}`}>{p.title || p.slug}</option>
          ))}
        </select>
      ) : (
        <Input defaultValue={(block.linkUrl as string) || ''} key={`lu-${bk}`}
          onBlur={(e: FieldBlurEvent) => onBlockFieldChange(currentBlockIndex, 'linkUrl', e.target.value)}
          variant="editor" className={editorInputClassName} placeholder="https://example.com" />
      )}
    </div>

    {/* Dismissible toggle */}
    <div className="mt-3 flex items-center justify-between">
      <span className={labelCls}>Dismissible</span>
      <input type="checkbox"
        checked={block.dismissible !== false}
        onChange={(e) => onBlockFieldChange(currentBlockIndex, 'dismissible', e.target.checked)}
      />
    </div>

    {/* Colors — Color 2 only shown for gradient variant */}
    <div className="mt-3 space-y-2">
      <label className={labelCls}>Background Color 1</label>
      <input type="color"
        defaultValue={(block.backgroundColor as string) || '#000000'}
        onBlur={(e) => onBlockFieldChange(currentBlockIndex, 'backgroundColor', e.target.value)}
        className="h-8 w-full rounded" />
      {block.variant === 'gradient' && (
        <>
          <label className={labelCls}>Background Color 2 (gradient)</label>
          <input type="color"
            defaultValue={(block.backgroundColor2 as string) || '#000000'}
            onBlur={(e) => onBlockFieldChange(currentBlockIndex, 'backgroundColor2', e.target.value)}
            className="h-8 w-full rounded" />
        </>
      )}
    </div>

    {/* Padding (internal) */}
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <span className={labelCls}>Vertical Padding</span>
        <span className="text-[10px] text-slate-500">{(block.paddingY as number) ?? 12}px</span>
      </div>
      <input type="range" min={4} max={32} step={2}
        defaultValue={(block.paddingY as number) ?? 12}
        onPointerUp={(e) => onBlockFieldChange(currentBlockIndex, 'paddingY', Number((e.target as HTMLInputElement).value))}
        className="mt-1 w-full accent-blue-500" />
    </div>
  </div>
)}
```

## Field write pattern verification

- Pattern: `onBlur` for text, `onChange` for checkbox/select, `onPointerUp` for range — matches existing patterns in file (Layout & Spacing slider at 1298, generic CTA at 1441).
- `pages` prop already destructured in component (line 1531 nav usage confirms availability).

## Acceptance

- [ ] All schema fields editable from panel
- [ ] Editor block rendered in panel only when `bt === 'announcement-bar'`
- [ ] Layout & Spacing section NOT rendered for announcement-bar
- [ ] External/Internal URL toggle preserves linkUrl across switches (don't clear on toggle)
- [ ] Color 2 picker only visible when variant === 'gradient'
- [ ] No regressions on other block types (visual smoke + lint)

## Risks

- `pages` may be undefined on some routes — guard with `pages?.map`
- Color picker `defaultValue` requires hex; if existing data has CSS var (e.g. `var(--brand-primary)`) → use `'#000000'` fallback. Confirm during impl.

## Test prep (consumed by phase-05)

Manual: Open editor → select announcement-bar → verify each field writes through (devtools / store inspection).
Automated: out-of-scope for unit; covered by existing SettingsPanel integration tests if present (scout for `SettingsPanel.test.tsx` first).

# Phase 02: Visual Indicator for Unpublished Changes

## Context
- Parent: [plan.md](./plan.md)
- Depends on: [Phase 01](./phase-01-unpublished-changes-flag.md)

## Overview
- **Date**: 2026-04-12
- **Priority**: P2 (UX polish)
- **Implementation status**: pending
- **Review status**: pending

## Key Insights
- Current "LIVE" badge (EditorToolbar.tsx line 284-289) doesn't indicate if changes are pending
- User needs visual feedback that saved changes aren't live yet

## Related Code Files

| File | Line | Change |
|------|------|--------|
| `src/components/editor/EditorToolbar.tsx` | 284-289 | Update LIVE badge to show pending state |

## Implementation Steps

### Update LIVE badge

```typescript
// Line ~284-289: Add visual indicator
{isPublished && (
    <Badge variant={hasUnpublishedChanges ? "warning" : "success"}>
        {hasUnpublishedChanges ? "Changes pending" : "LIVE"}
    </Badge>
)}
```

When `hasUnpublishedChanges`:
- Badge changes from green "LIVE" to amber/yellow "Changes pending"
- Clear visual feedback that content needs re-publish

## Todo
- [ ] Update LIVE badge to show pending state
- [ ] Use appropriate color (amber/warning)
- [ ] Test visual transition: LIVE → Changes pending → LIVE

## Success Criteria
- Published site with unpublished changes shows "Changes pending" badge
- After re-publish, badge returns to green "LIVE"
- Draft sites unaffected

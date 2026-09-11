# Phase 04 — UI So Sánh Khối trung thực và responsive

## Mục tiêu

Replace the single inferred block status with an evidence-led, readable visual inspector. PW1 preview remains descriptive; PW2 preview is conditional on real data + renderer evidence.

## File targets

- **New:** `src/app/studio/qa/migration-diff/BlockMigrationEvidence.tsx` — presentational badges, placeholder, evidence accordion and status legends.
- **Modify:** `src/app/studio/qa/migration-diff/MigrationDiffClient.tsx` — fetch evidence snapshot on selected store/page, pass only typed evidence into comparison panel, remove `KHỚP 100%` derivation from `PageBlockItem.status` for this view.
- **Modify:** `src/lib/admin/qa/migration-diff-engine.ts` — retain old demo types for other tabs, but stop representing inferred `pw2Preview` as evidence in visual stream; add no new fake mappings.
- **Potentially modify:** `src/components/site-renderer/SiteRenderer.tsx` only if Phase 03 runner requires approved opaque markers.

## UI specification

1. Each block header shows: `Dữ liệu PW2`, `Component`, `Live render`, each badge with icon, label and explicit plain-language explanation. A legend explains green/cam/red/xám.
2. Status color logic: green only 3 verified successes; orange for component unsupported or any unverified layer; red for missing/mismatch data or verified non-render; no `KHỚP 100%` except overall pass.
3. For `migrated + unsupported`: left PW1 preview is shown; right PW2 becomes orange placeholder stating **“Dữ liệu đã migrate; template PW2 chưa hỗ trợ component”**, `layoutBlockId`, actual `blockType`, mapping version and navigation to evidence. It must not call `RichVisualBlockRenderer` with `pw2Preview`.
4. For mapped + supported only, PW2 visual card is labelled **“Preview từ block PW2 đã xác minh”**; this remains separate from live badge.
5. `Bằng chứng dữ liệu` is a collapsed accessible accordion per block containing sanitized mapping, actual IDs/keys, checked timestamp, canonical diff summary, registry result and live evidence ref. No raw secret/PII; screen reader labels show state/reason.
6. `Kiểm tra live` appears only for evidence-eligible blocks. Pending/failed/unavailable UI does not mutate other badges to pass. It displays result timestamp/evidence reference once received.
7. Desktop uses two columns; at 375px stacks PW1 then evidence/placeholder then PW2, keeps badge labels visible (not icon-only), accordion/button keyboard accessible and no horizontal clipping.

## Acceptance / test mapping

- TC-F40-13-04 (E2E, Critical): Case B has migrated data + unsupported component, orange placeholder and no simulated PW2 content.
- TC-F40-13-05 (Unit/component): all three badges show distinct states; no false `100%` text when any is not green.
- TC-F40-13-06 (E2E): evidence accordion opens/closes and contains only safe fields at desktop/375px.

## Exit criteria

- QA can tell “migrated but no component” from “missing PW2 data” without opening raw JSON.
- No presentation branch has fallback from evidence failure to current mock `pw2Preview`.

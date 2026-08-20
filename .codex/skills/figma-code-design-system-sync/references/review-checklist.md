# TM Prime Figma Review Checklist

## Screen and structure

- Correct page, feature, screen name, breakpoint, theme, and state.
- Dimensions and content area match production.
- Shared sidebar has the correct active state.
- Repeated UI uses canonical instances, not detached copies.
- Page-level empty, populated, loading, and error bodies use distinct screens when needed; nested table/card/section states remain organism/component variants unless a composed demonstration is explicitly requested.
- Every proposed state is classified from code as screen-level or component/data-level before it enters the delivery matrix.
- Badges, counts, timestamps, enabled flags, selected rows, and record-presence conditions remain component variants/properties unless they change the whole-screen render boundary.
- A separate screen has evidence that the route/page-layout body is replaced by a distinct route/view, body-swapping tab, page-level early return, or meaningful mutually exclusive full-page state. Classification uses the highest render boundary actually replaced.
- Finished full-screen views, modal/dropdown demonstrations, theme examples, and data/state demonstrations are frames on the intended Screens/feature page—not variants inside a full-screen component set.
- No `Templates/[Feature]/Desktop` family is used as a storage container for completed screens.

## Template eligibility

- An Atomic Template exists only when code defines a reusable layout contract with stable named regions or swap slots.
- Record at least two real consumers, the stable regions, exposed properties/swaps, and why Organism composition alone is insufficient.
- Shared viewport size, toolbar, theme, or feature ownership alone does not qualify a screen family as a Template.
- When no reusable shell API exists, omit the Template level for that feature.
- Before removing a misclassified screen component, detach/migrate all consumers, verify visual parity and nested canonical instances, and confirm the obsolete main component has zero consumers.

## Theme and state matrix

- Production theme support and theme mechanism are identified.
- Every required Light/Dark x state cell exists at the same viewport and with equivalent content.
- Theme-dependent fills, strokes, text, icons, effects, and controls resolve through the correct mode/variant.
- Sidebar active state, status controls, table treatment, and pagination presence/state are checked in every cell.
- The matrix excludes component/data-level axes that can coexist inside one production screen.

## Components

- Search the library before creating.
- Search the entire current Figma file—screens, Components, and existing consumers—before creating; reuse is not limited to the target feature section.
- Resolve code-library aliases to rendered identity before matching (`Edit2` → `lucide/pen`, `CheckCircle` → `lucide/circle-check-big`).
- Compare icon SVG/path geometry; similar names or silhouettes are not proof of equivalence.
- Reuse the original component when structure and behavior match.
- Add a variant when structure is shared and only state/appearance changes.
- Generalize only when multiple real consumers share the structure.
- Use component properties for text, icon, visibility, state, and swaps.
- Reuse is validated by actual props, variants, nested overrides, and computed Light/Dark appearance—not component name alone.
- Missing code props such as status `dot` or missing theme behavior are implemented as justified canonical variants/wrappers or exact nested overrides.
- Every reused component in scope has a completed prop/theme parity table mapping code modifiers to the exact Figma variant/property/override and verification result.
- Mixed item states are demonstrated through canonical variants/instances inside one representative screen, not duplicate screen frames.
- Avoid feature-specific names for generic patterns.
- Functionally and geometrically identical UI across different screens points to one canonical main component.
- Newly created assets include evidence that no equivalent canonical source or consumer exists file-wide.
- Every canonical original lives on `🧩 Components` and follows the existing Atomic hierarchy/naming convention.
- Screens use instances only for reusable UI; each instance's `mainComponent` source is verified.
- No detached or screen-local duplicate is treated as the canonical source.
- Atomic naming applies to components, not typography styles.
- Production React/DOM regions map to semantic Figma components, instances, or Auto Layout frames; renamed frames containing flat absolute children do not pass.
- Report nested canonical-instance coverage for every organism and justify every remaining loose primitive.
- Repeated fields, upload zones, accordion sections, cards, rows, tabs, icon controls, and actions use canonical instances or documented generic extensions.

## Layer hierarchy and Auto Layout

- Every structural row, column, stack, aligned control group, repeated list, field group, and responsive region uses Auto Layout.
- Absolute positioning is limited to documented overlays, iframe/canvas simulations, decorative artwork, and intentional floating controls.
- Report total frame count, Auto Layout frame count, justified absolute frame count, and unjustified absolute frame count. Unjustified absolute frames must be zero.
- Every canonical component direct child has a semantic name and belongs to its production render-tree region.
- Default layer names (`Frame`, `Rectangle`, `Vector`, `Group`) are absent from canonical direct-child hierarchies unless documented as nested decorative primitives.
- A semantic wrapper that leaves its meaningful children as a flat absolute-positioned layer list fails the hierarchy audit.

## Tables

- Match headers, rows, column widths, alignment, dividers, and row height.
- Status badges use shared variants and exact foreground/background alpha.
- Action icons match icon family, stroke width, size, and spacing.
- Each row uses the exact icon mapping from production data/code rather than one placeholder icon repeated across rows.
- When production renders pagination, it uses the canonical component with correct active, ellipsis, arrow, and disabled states; when production does not, its absence is explicitly verified.
- Summary and rows-per-page controls are checked for both exact production presence and exact production absence.
- Use `Table Empty State` only when production supports that rendered state.
- Populated demos use production-supported content and the rendered row count; never fabricate an empty/populated counterpart absent from code.
- Code-derived tables match the evaluated filter/map result exactly: included and excluded records, row order, labels, descriptions, and per-row icon/component mapping. Count-only parity does not pass.
- Email Templates guardrail: `isCustomized = Boolean(row)` and `customizedCount` are row/list data conditions, so `Customized` is a row/badge variant—not a separate screen axis.

## Color

- Compare rendered RGBA, not hex alone.
- Check layer opacity separately from fill/stroke opacity.
- Check Tailwind `/opacity`, CSS variables, `rgba()`, gradients, shadows, and compositing.
- Resolve direct Tailwind palette utilities and `dark:` modifiers to exact primitive colors and alpha.
- Bind only to an exact token in the correct theme/mode.
- Create an exact semantic token when no match exists.
- Never change visible color merely to attach an existing style.
- Audit reusable/theme-dependent fills, strokes, text colors, and effects, including nested instance overrides.
- Verify the exact variable collection + mode or style ID, not only the displayed token name.
- Maintain an explicit raw-value exception list; it must be empty or contain documented true one-offs.
- Audit layer opacity and paint alpha independently in every theme.
- Compare production computed RGBA with rendered Figma RGBA for every changed icon, field, control, card, overlay, and status surface in every supported theme/state; token-name or variable-ID parity alone does not pass.
- When alias plus opacity resolves incorrectly in Figma, use an exact mode-aware alpha token and re-render both themes.
- Verify the canonical source first, then confirm every affected screen instance propagated the corrected paints.

## Fields

- Reuse the canonical input/field component and the exact production variant; do not approximate it with loose primitives.
- Audit container fill, border/stroke, input text, placeholder, label, helper text, prefix/suffix icons, focus ring, disabled treatment, error treatment, and opacity.
- Record expected production RGBA, Figma variable/style ID, resolved RGBA per mode, and pass/fail for every field paint role.
- Eligible unbound field paints and unexplained computed-color mismatches must both be zero.

## Typography

- Match family, weight, size, line-height, tracking, case, and decoration.
- Reuse `Heading/*`, `Body/*`, `Label/*`, or `Code/*` by signature and role.
- Do not name styles after screens, features, or components.
- Do not create split styles such as `fontSize`, `lineHeight`, or `fontWeight`.
- Keep one-offs local unless code defines a reusable token.
- Remap consumers before removing duplicate/obsolete styles.
- Synchronize the Foundations Typography specimen after library changes.
- Every eligible repeated text layer has a text-style ID; audit text color binding separately.
- Include nested instance text overrides in the style audit.
- Report total text layers, eligible repeated text layers, styled eligible layers, unstyled eligible layers, and documented one-offs.
- Unstyled eligible repeated text layers block completion; screenshot parity does not waive this gate.

## Icons and controls

- Match icon library, box, optical alignment, stroke width, cap, and join.
- Verify SVG paint semantics from code: `fill="none"`, `stroke="currentColor"`, inherited color, and any intentionally filled paths. Never bind a root/container fill to recolor a stroke-only icon.
- Confirm icon instance roots do not paint unexpected rectangles or mask descendant stroke colors.
- Center icon and label using Auto Layout rather than manual offsets.
- Verify button text/icon colors for all relevant states and themes.
- Verify toggle knob position, track color, border, and state.
- Audit the icon instance root and every visible SVG/vector descendant separately.
- Confirm icon-root fill count is zero unless production intentionally renders a filled icon/container.
- Confirm hidden default icons remain hidden after instance swaps and label/property overrides.
- Treat any unexpected icon background tile, inherited fill, stale nested override, or wrong stroke/fill channel as a completion blocker.

## Visual verification

- Capture updated Figma nodes at a readable size.
- Compare with rendered code and supplied screenshots.
- Inspect representative components and every changed screen state.
- Include close-up screenshots for every changed small-component variant—icons, status badges/dots, switches, and tab count pills—in every supported theme; a full-screen thumbnail does not prove their paints are correct.
- Confirm no missing fills, overflow, clipping, unexpected wrapping, or detached styles.
- Confirm unrelated frames/shared components were not modified.
- Audit main-component IDs and document-wide consumer counts to detect duplicate sources for the same function.
- Duplicate cleanup includes a per-consumer migration/parity audit covering properties, variants, swap slots, text/visibility, nested overrides, dimensions, layout, and theme/state behavior.
- Every migrated consumer is visually verified in all affected themes/states after the swap; remove the duplicate only when rendering is correct and its document-wide instance count reaches zero.
- Capture production and Figma for every production-supported theme/state matrix cell at the same viewport, zoom, content, and state. For an unsupported requested state, capture evidence that production lacks it and stop for authorization before creating any design.
- Compare geometry and computed appearance side by side; retain node IDs and screenshot evidence.
- Block completion when any matrix cell or binding class remains unverified.

## Completion report

- Screens and states updated.
- Canonical components reused.
- Components/variants created or generalized.
- Tokens/styles created, consolidated, or removed.
- Verification results and remaining exceptions.
- Screen node IDs and original Atomic component IDs.
- Binding reuse/creation counts plus any unbound/raw exceptions.
- Computed-color mismatch count, unintended icon-root fill count, and eligible unbound field-paint count; all must be zero unless explicitly documented and approved.
- Screenshot evidence for every theme/state matrix cell.
- Auto Layout coverage counts and absolute-position exception list.
- Text Style coverage counts and one-off exception list.
- Nested canonical-instance coverage by organism and remaining loose-primitive exceptions.

# PrimeWeb static prototypes

The nine prototypes are now the working UI-adaptation surface. They originated from live Vue templates, but are reviewed and edited directly in this folder before any template-library migration.

Each template is a standalone static site with pre-rendered HTML, local CSS/images/fonts, no Vue runtime, and no API dependency. Internal links provide prototype navigation between the exported routes.

Current phase constraints:

- Review and update every manifest route in each of the nine static template suites directly; homepage-only completion is not template completion.
- Represent only blocks/variants already available in `src/blocks/registry.ts`.
- Do not add production React blocks/components, `TemplatePreset` data, Payload seed records or template-library entries.
- Annotate adapted sections with `data-block-type`, `data-block-variant` and `data-mapping-status`.
- Rebuild each section's visible DOM and CSS from the mapped v2 renderer; annotations alone do not count as adaptation.
- Use [`../component-adaptation-mapping.md`](../component-adaptation-mapping.md) as the authoritative legacy → v2 replacement guide.
- Static JavaScript may demonstrate an interaction, but the mapping must name the existing production runtime component that will own it later.

Template review order: `pa101`, `f102`, `fb101`, `fn104`, `fn103`, `c102`, `c101`, `fn102`, `fn101`.

Current review state:

| Template                      | Manifest status   | Static UI scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`pa101`](./pa101/index.html) | `needs-ui-review` | Full 9-route suite rebuilt: Home, Products, Articles and Contact use mapped v2 block anatomy; Cart, Checkout, Orders lookup, PDP and article detail are labeled static storefront-runtime mirrors. Automated responsive/asset/a11y checks pass; human viewport approval remains open.                                                                                                                                                                                                                        |
| [`f102`](./f102/index.html)   | `needs-ui-review` | Full 10-route manifest plus 2 compatibility details rebuilt: Home and listing/content routes use mapped v2 block anatomy; Cart, Checkout, Orders lookup, two PDPs and two article details are labeled static storefront-runtime mirrors. Shop collection/sort controls are styled HTML disclosure menus for consistent prototype rendering; they update labels only and do not implement production filtering. The compatibility slugs remain outside `manifest.json`; human viewport approval remains open. |
| [`fb101`](./fb101/index.html) | `needs-ui-review` | Homepage rebuilt with mapped v2 block anatomy and all six required homepage capabilities represented. The other 9 manifest routes are still pending adaptation and are not counted as complete; human viewport approval remains open.                                                                                                                                                                                                                                                                        |

Run locally from this directory:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173/`.

Rebuild all prototypes:

```bash
node scripts/export-static-prototypes.cjs
```

Export selected templates only:

```bash
node scripts/export-static-prototypes.cjs pa101 f102
```

Verify all exported routes while JavaScript is disabled (run the local server first):

```bash
node scripts/verify-static-prototypes.cjs
```

Remove unavailable optional/placeholder media after an export:

```bash
node scripts/cleanup-static-prototype-media.cjs
```

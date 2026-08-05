# GH-1701 Translation Dev View Reconciliation

## Source Verification

| Check | Result |
|---|---|
| Source | Issue #1701 body attachment ID `30530246` |
| Repo path | `docs/translation-dev-view.csv` |
| SHA-256 | `85c0bc5829ed256e390393879b5d31dddf02dd67f00edfa7dbf839614e2bc0dd` |
| Records | 3,386 |
| Columns | 12 |
| Duplicate `key_or_element` | 0 |
| Missing key/EN/MS suggestion | 0 |

The CSV has 3,422 physical lines because some quoted fields are multiline. It must be parsed as CSV, not line-by-line.

## Baseline Against Current Staging

Re-audited against staging commit `76793a02cb3a02846b30857d7f4ee06b1f5385b2`
on 2026-08-05.

| Classification | Count |
|---|---:|
| Existing scalar paths | 3,298 |
| Existing array paths | 33 |
| Missing current paths | 55 |
| Scalar rows where current EN differs from CSV snapshot | 52 |
| Existing EN/MS recursive primitive leaves | 4,129 each |
| Existing EN/MS key/type mismatch | 0 |

## Scalar Drift

### Same Context: Approved Copy Can Apply

These 14 keys retain the same UI meaning. Differences are wording, capitalization, or formatting:

- `dashboard.blog.categoryModal.removeConfirmMsg`
- `dashboard.products.quickView.deleteProduct`
- `dashboard.settings.payments.uploadError`
- `help.overview.needHelpDesc`
- `dashboard.products.bulkCreate.table.name`
- `dashboard.products.bulkCreate.table.variants`
- `dashboard.products.categories.form.newTitle`
- `dashboard.products.quickView.editProduct`
- `editor.settings.pricingFeaturesPlaceholder`
- `storefront.checkout.payNow`
- `dashboard.customers.colProfile`
- `dashboard.products.list.fromPrefix`
- `dashboard.sites.lastEdited`
- `Staff.actions.you`

Contract notes:

- English `dashboard.settings.payments.uploadError` deliberately keeps a
  trailing space; Malay already has one. The consumer concatenates the prefix
  directly with an error.
- `dashboard.blog.categoryModal.removeConfirmMsg` keeps the approved
  locale-specific formatting: English is one line and Malay is multiline. The
  consumer uses `whitespace-pre-line`.

### Context Changed: Do Not Auto-Apply

| Key | Context difference |
|---|---|
| `dashboard.products.bulkCreate.saveEmptyError` | Drawer no longer has selected rows; all remaining drafts are saved. |
| `dashboard.products.bulkCreate.title` | Current UI is a draft-review drawer, not a create-confirmation modal. |
| `dashboard.products.categories.deleteModal.subCategoryWarning` | Current delete reparents children to top level; approved copy incorrectly says only unlinked. |
| `auth.passwordPlaceholder` | Current value instructs the user; bullets remove the instruction. |
| `dashboard.blog.editor.uploadHint` | Current value exposes 4:3 and minimum 1200px requirements; approved copy removes them. |
| `dashboard.customers.subtitle` | Current page is scoped to website-form inquiries; approved copy reintroduces newsletter subscribers. |
| `dashboard.customers.timelineEntry` | Current UI presents a message, not a generic contact submission. |
| `dashboard.products.bulkCreate.subtitle` | Current value explains drafts are not published; approved copy drops that guarantee. |
| `dashboard.products.bulkCreate.table.price` | Current label identifies RM; approved copy drops currency context. |
| `dashboard.products.list.aiChatBtn` | Current action generates drafts; Create suggests immediate creation. |
| `dashboard.products.list.aiChatPlaceholder` | Current example documents RM and stock input; approved copy uses ambiguous `500k/50k`. |
| `dashboard.customers.timeline` | Current UI is Message History, not the broader Activity Timeline. |
| `dashboard.overview.seo.fixAll` | Staging intentionally renamed the scoped action to `AI Fix Issues`; the CSV restores the removed all-issues wording. |
| `dashboard.seo.fixAllButton` | Staging intentionally renamed the scoped action to `AI Fix Issues`; the CSV restores the removed all-issues wording. |
| `help.qna.categories.aDashboardSeo` | The live help answer must match the staging CTA label `AI Fix Issues`; the CSV still references `AI Fix All Issues`. |

### Branding Conflict: Product Decision Required

Commit `9727de2e` explicitly rebranded PrimeWeb to Web Store. The CSV would reverse that decision for these 23 keys:

- `dashboard.overview.welcomeTitle`
- `dashboard.settings.payments.stripeConnectDesc`
- `dashboard.settings.payments.xenditConnectDesc`
- `dashboard.settings.payments.xenditModalSubtitle`
- `email.forgotPassword.body`
- `email.otp.copyright`
- `email.welcome.body`
- `landing.platform.cta`
- `email.forgotPassword.footer`
- `email.forgotPassword.subject`
- `email.order.footer`
- `email.otp.footer`
- `email.otp.subject`
- `email.passwordChanged.body`
- `email.passwordChanged.footer`
- `email.passwordChanged.subject`
- `email.welcome.footer`
- `email.welcome.subheading`
- `email.welcome.subject`
- `landing.heroDemo.homeCrumb`
- `landing.platform.subtitle`
- `landing.why.title`
- `onboarding.welcome.title`

Recommendation: preserve Web Store until Product explicitly confirms the CSV is intended to reverse the rebrand.

## Missing Paths

No missing path is a safe one-to-one rename.

| Group | Count | Evidence | Decision |
|---|---:|---|---|
| Removed editor suggestion chips | 26 | `e5082ce0` | Obsolete; do not recreate |
| Profile single-page/SSO consolidation | 13 | `cc5dd32f` | Superseded context; do not map old many-to-one copy |
| Removed discount top actions/toasts | 4 | `b81a3c94` | Obsolete; current save bar/dialog messages are more specific |
| Bulk-create drawer redesign | 4 | `7f1bc0c5` | Superseded selected-row flow |
| Bulk-create singular/plural split | 1 | `db390c96` | Old key replaced by `saveSuccessOne/Many` |
| Removed Category Image field | 1 | `02a6b024` | Obsolete field |
| Variant master-field contract | 1 | `edd181d2` | Replaced by `masterLockedTooltip` with broader meaning |
| Removed customer last-saved label | 1 | `47ec2794` | Explicit dead-key removal |
| Removed blog editor breadcrumbs | 2 | `d230fafa` | Obsolete UI labels |
| Live courier COD rules | 1 | `f13905b8` | West-Malaysia hardcode superseded |
| Structured SEO overwrite dialog | 1 | `cb4a9ddd` | Single confirmation string replaced by structured current/proposed review dialog |

All 55 keys and replacement paths are enumerated in `scripts/i18n/issue-1701-reconciliation.json`.

### Complete Missing-Key List

Removed editor suggestion-chip UI (`e5082ce0`):

- `editor.addSection.banner`
- `editor.addSection.bannerCompact`
- `editor.addSection.bannerPrompt`
- `editor.addSection.cta`
- `editor.addSection.ctaCompact`
- `editor.addSection.ctaPrompt`
- `editor.addSection.faq`
- `editor.addSection.faqCompact`
- `editor.addSection.faqPrompt`
- `editor.addSection.features`
- `editor.addSection.featuresCompact`
- `editor.addSection.featuresPrompt`
- `editor.addSection.gallery`
- `editor.addSection.galleryCompact`
- `editor.addSection.galleryPrompt`
- `editor.addSection.newsletter`
- `editor.addSection.newsletterCompact`
- `editor.addSection.newsletterPrompt`
- `editor.addSection.team`
- `editor.addSection.teamCompact`
- `editor.addSection.teamPrompt`
- `editor.addSection.testimonials`
- `editor.addSection.testimonialsCompact`
- `editor.addSection.testimonialsPrompt`
- `editor.aiChat.addSectionPrompt`
- `editor.aiChat.changeColorPrompt`

Profile redesign and SSO consolidation (`cc5dd32f`):

- `profile.errors.unsavedChanges`
- `profile.sso.generalNotice`
- `profile.sso.generalTitle`
- `profile.sso.manageButton`
- `profile.sso.notice`
- `profile.sso.securityNotice`
- `profile.banner.activeNow`
- `profile.banner.status`
- `profile.sso.generalLink`
- `profile.sso.securityLink`
- `profile.sso.securityTitle`
- `profile.tabs.general`
- `profile.tabs.security`

Removed discount actions/toasts (`b81a3c94`):

- `dashboard.discounts.header.deleteBtn`
- `dashboard.discounts.toast.deleted`
- `dashboard.discounts.toast.deleteFailed`
- `dashboard.discounts.header.save`

Bulk-create redesign and plural split (`7f1bc0c5`, `db390c96`):

- `dashboard.products.bulkCreate.note.label`
- `dashboard.products.bulkCreate.productsItem`
- `dashboard.products.bulkCreate.saveButton`
- `dashboard.products.bulkCreate.note.description`
- `dashboard.products.bulkCreate.saveSuccess`

Other removed or superseded contracts:

- `dashboard.products.categories.form.image` - Category Image field removed in `02a6b024`.
- `dashboard.products.form.sections.autoFilledFromVariants` - replaced by the broader `masterLockedTooltip` contract in `edd181d2`.
- `dashboard.shopCustomers.detail.lastSaved` - explicitly removed as dead in `47ec2794`.
- `dashboard.blog.editor.blog` - breadcrumb label removed in `d230fafa`.
- `dashboard.blog.editor.home` - breadcrumb label removed in `d230fafa`.
- `storefront.checkout.westMalaysiaOnly` - replaced by live route/COD rules in `f13905b8`.
- `editor.settingsValidation.seoConfirmReplace` - replaced by the structured `editor.settings.seoOverwriteDialog` contract in `cb4a9ddd`.

## Arrays

| Classification | Count | Decision |
|---|---:|---|
| String arrays with confident per-item mapping | 28 | Mapping recorded in manifest |
| String array with ambiguous Malay item boundary | 1 | Product/translation confirmation required |
| Object arrays exported as `[object Object]` | 4 | Preserve current structure and content |

Ambiguous key:

- `landing.solutions.industries.retail.points`: current structure has 4 items, but the proposed Malay value contains 5 semantic lines. Likely the first two lines belong to one item, but the CSV does not prove that.

Unusable object-array rows:

- `help.modules.data.blog.steps`
- `help.modules.data.builder.steps`
- `help.modules.data.dashboard.steps`
- `help.modules.data.settings.steps`

## Runtime Contract Conflict

`dashboard.settings.emailTemplates.lastEdited` currently requires `{time}`. The proposed Malay value removes it, changing a relative-time message into a static label. Phase 2 must retain `{time}` or hold this row for corrected copy.

No HTML tag mismatches were detected in directly resolvable scalar rows.

## Phase 1 Hold Policy

Phase 2 applies all unambiguous rows and preserves the current locale value
for these unresolved decisions:

1. Preserve `Web Store` or intentionally restore `PrimeWeb` for the 23 branding keys.
2. Preserve current behavior-aware copy or force CSV wording for the 15 context-changed keys.
3. Confirm the four-item Malay split for `landing.solutions.industries.retail.points`.
4. Confirm preserving the four help object arrays because the CSV contains no usable nested copy.

## Phase 2 Application Result

An external one-off mapper applied the source CSV without adding a parser,
script, runtime dependency, or lockfile change to the project.

| Result | Count |
|---|---:|
| Source rows accounted for | 3,386 |
| Scalar rows changed | 2,147 |
| Scalar rows already matching the approved suggestion | 1,112 |
| String arrays mapped | 28 |
| Context-changed scalar rows held | 15 |
| Branding-conflict scalar rows held | 23 |
| Missing obsolete/superseded rows held | 55 |
| Ambiguous string arrays held | 1 |
| Unusable object arrays held | 4 |
| Runtime-contract conflicts held | 1 |

The mapper preserved the locale key tree, value types, array lengths, key
order, interpolation placeholders, HTML tags, intentional whitespace, and
multiline values. Both locale files retain identical structures.

### Latest Staging Re-audit

The full Phase 1 and Phase 2 audit was rerun after fast-forwarding this branch
to staging commit `76793a02cb3a02846b30857d7f4ee06b1f5385b2`.

| Re-audit check | Result |
|---|---:|
| CSV SHA-256 matches pinned source | Yes |
| Source records accounted for | 3,386 / 3,386 |
| Duplicate CSV paths | 0 |
| Phase 1 scalar drift set matches manifest | Yes |
| Phase 1 missing-path set matches manifest | Yes |
| Phase 1 array classifications match manifest | Yes |
| Phase 2 EN/MS structure matches baseline | Yes |
| Phase 2 EN/MS structure parity | Yes |
| Placeholder and HTML contracts | Pass |
| Runtime contract exceptions | Pass |

The staging comparison found five relevant source changes:

- Three existing scalar keys now intentionally use `AI Fix Issues`; all three
  remain in the context-changed hold group.
- `help.modules.data.dashboard.steps` changed as a structured object array and
  remains preserved because the CSV contains only `[object Object]`.
- `editor.settingsValidation.seoConfirmReplace` was removed and replaced by
  the structured `editor.settings.seoOverwriteDialog`; it is now included in
  the missing/superseded group.

The re-audit also caught and corrected one Phase 2 contract issue before
handoff: the approved English `dashboard.settings.payments.uploadError`
prefix now retains its required trailing space. No additional consumer/context
conflicts were found in the staging changes.

The latest staging sync added 12 scalar locale leaves outside the source CSV.
They remain untouched by the mapper; all CSV-target classifications and Phase
2 application counts remain unchanged.

Validation snapshot:

- Full reconciliation audit: pass.
- `git diff --check`: pass.
- TypeScript `tsc --noEmit`: pass.
- Focused localization tests: 31 passed. The two existing assertions for the
  dashboard label now match the approved British English `Customise` copy.

### Local QA Matrix

The complete old/new copy matrix is available at
`docs/issue-1701-phase2-qa-matrix.csv`. It contains one row for every value
that changed, with these columns:

- `area`
- `location`
- `key`
- `value_type`
- `old_en`
- `new_en`
- `old_ms`
- `new_ms`

The matrix contains `2,169` changed rows: `2,147` scalar values and `22`
arrays that produced an actual locale diff.

| Local surface | Filter/prefix | Changed rows |
|---|---|---:|
| `/` and `/templates` | areas `landing`, `hero`, `features`, `gallery`, `cta`, `nav` | 119 |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-otp` | area `auth` | 78 |
| `/dashboard` | prefix `dashboard.overview` | 24 |
| `/products`, product forms and categories | prefix `dashboard.products` | 261 |
| `/settings` and settings subpages | prefix `dashboard.settings` | 195 |
| `/settings/domains` | area `Domains` | 44 |
| `/settings/profile` | areas `profile`, `accountSettings` | 56 |
| `/settings/staff` | area `Staff` | 64 |
| `/blog` and blog editor | prefix `dashboard.blog` | 128 |
| `/orders` and order details | prefix `dashboard.orders` | 110 |
| `/discounts` and discount forms | prefix `dashboard.discounts` | 75 |
| `/customers` and customer details | prefixes `dashboard.customers`, `dashboard.shopCustomers` | 85 |
| `/editor/[siteId]` | area `editor` | 379 |
| `/onboarding` | area `onboarding` | 114 |
| `/help`, `/help/modules`, `/help/qna` | area `help` | 47 |
| `/sites/[slug]/checkout` | prefix `storefront.checkout` | 61 |
| Storefront confirmation, receipt upload, order lookup, products, cart and blog | area `storefront`, excluding checkout | 51 |
| Transactional email output | area `email` | 88 |

For modal, toast, validation, empty-state, and email copy, use the `location`
column to trigger the exact state. Opening the parent page alone is not enough.

## Phase 2 Decisions Required

### 1. Context-changed copy

Affected: the 15 keys listed under **Context-Changed Drift**.

- Option A: keep the current behavior-aware copy.
- Option B: force the CSV copy even though it describes an older workflow.
- Recommended: Option A. If Product wants new wording, create replacement
  copy against the current UI instead of restoring the stale text.

### 2. Branding conflict

Affected: the 23 keys listed under **Branding Conflict**.

- Option A: retain `Web Store`.
- Option B: restore `PrimeWeb`.
- Recommended: Option A because commit `9727de2e` explicitly introduced the
  current product branding.

### 3. Missing obsolete or superseded paths

Affected: all 55 keys in **Complete Missing-Key List**.

- Option A: keep them absent.
- Option B: revive the removed UI/flow and then add appropriate copy.
- Recommended: Option A. None has a safe one-to-one replacement; adding these
  keys alone would create dead translations.

### 4. Ambiguous retail array

Affected: `landing.solutions.industries.retail.points`.

- Option A: confirm that the first two Malay semantic lines form item one,
  preserving the current four-item structure.
- Option B: provide a corrected four-item Malay list.
- Recommended: Option B because it leaves no inferred content boundary.

### 5. Unusable help object arrays

Affected:

- `help.modules.data.blog.steps`
- `help.modules.data.builder.steps`
- `help.modules.data.dashboard.steps`
- `help.modules.data.settings.steps`

The CSV contains only `[object Object]`.

- Option A: preserve current nested EN/MS content.
- Option B: provide a structured replacement for every step object.
- Recommended: Option A until structured copy is supplied.

### 6. Runtime placeholder conflict

Affected: `dashboard.settings.emailTemplates.lastEdited`.

Current EN/MS require `{time}`. Proposed Malay is `Kemaskini yang terakhir`
and removes the runtime value.

- Option A: retain the current Malay copy with `{time}`.
- Option B: approve a corrected Malay sentence containing `{time}`.
- Option C: change the UI contract to a static label.
- Recommended: Option B. Option C is a runtime change and is outside this
  translation-only issue.

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(root, '../../../../..')
const input = JSON.parse(readFileSync(join(root, 'renderer-input.json'), 'utf8'))
const manifestPath = join(root, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const qaEvidencePath = join(root, 'browser-qa-evidence.json')
const failures = []
const sha256 = value => createHash('sha256').update(value).digest('hex')
const git = args => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim()
const NAV_ITEMS = [
  ['Home', 'index.html'],
  ['Products', 'products/index.html'],
  ['Articles', 'articles/index.html'],
  ['Contact', 'contact/index.html'],
  ['Order Tracking', 'order-tracking/index.html'],
]
const NAV_ROUTES = new Map([
  ['index.html', { active: 'Home', announcement: false }],
  ['products/index.html', { active: 'Products', announcement: false }],
  ['articles/index.html', { active: 'Articles', announcement: false }],
  ['contact/index.html', { active: 'Contact', announcement: false }],
  ['products/the-saem-cover-perfection-fixealer/index.html', { active: 'Products', announcement: false }],
  ['articles/ideal-skincare-routine-oily-skin/index.html', { active: 'Articles', announcement: false }],
  ['order-tracking/index.html', { active: 'Order Tracking', announcement: false }],
])
const STANDALONE_NAV_EXCEPTIONS = ['cart/index.html', 'checkout/index.html']

// Authoritative export: every review HTML is recreated byte-for-byte from source/templates.
const routeDigests = {}
for (const file of input.routes) {
  const templatePath = join(root, 'source/templates', file)
  const outputPath = join(root, file)
  if (!existsSync(templatePath)) {
    failures.push(`Missing source template: ${file}`)
    continue
  }
  const html = readFileSync(templatePath, 'utf8')
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, html)
  routeDigests[file] = sha256(html)
}

// Record the exact code inputs, including local dirty state (not just a nominal commit).
const gitHead = git(['rev-parse', 'HEAD'])
const sourceDigests = {}
const dirtySources = []
for (const source of input.rendererSources) {
  const absolute = join(repoRoot, source)
  if (!existsSync(absolute)) {
    failures.push(`Missing renderer source: ${source}`)
    continue
  }
  const porcelain = git(['status', '--short', '--', source])
  const dirty = porcelain.length > 0
  if (dirty) dirtySources.push(source)
  sourceDigests[source] = { sha256: sha256(readFileSync(absolute)), dirty, gitStatus: porcelain || null }
}
const provenance = { gitHead, worktreeDirty: git(['status', '--porcelain']).length > 0, dirtySources, sourceDigests }
const qaEvidence = JSON.parse(readFileSync(qaEvidencePath, 'utf8'))
const qaEvidenceDigest = sha256(readFileSync(qaEvidencePath))
for (const width of ['390', '768', '1024', '1440']) {
  const viewport = qaEvidence.viewports?.[width]
  if (!viewport || viewport.routesMeasured !== input.routes.length) failures.push(`Incomplete browser QA at ${width}px`)
}
const navigationEvidence = qaEvidence.navigationContract
for (const field of ['allStatus200', 'exactLabelsAndOrder', 'depthCorrectHrefs', 'exactlyOneAriaCurrentPerRoute', 'mobileMenuOpenedAllRoutes', 'mobileMenuClosedWithEscapeAllRoutes', 'mobileMenuFocusRestoredAllRoutes', 'orderLookupHierarchyPreserved']) {
  if (navigationEvidence?.[field] !== true) failures.push(`Browser QA navigation evidence missing/false: ${field}`)
}
if (navigationEvidence?.routesMeasured !== NAV_ROUTES.size || navigationEvidence?.routeViewportChecks !== NAV_ROUTES.size * 4 || JSON.stringify(navigationEvidence?.viewportsMeasured) !== JSON.stringify([390, 768, 1024, 1440]) || navigationEvidence?.announcementBlocksFound !== 0 || navigationEvidence?.allNavigationTopPx !== 0 || navigationEvidence?.maximumHeaderContentOverlapPx !== 0 || JSON.stringify(navigationEvidence?.standaloneNavigationExceptions) !== JSON.stringify(STANDALONE_NAV_EXCEPTIONS)) failures.push('Browser QA canonical navigation geometry/scope contract mismatch')
const expectedActiveRoutes = Object.fromEntries([...NAV_ROUTES].map(([file, contract]) => [file, contract.active]))
if (JSON.stringify(navigationEvidence?.activeRoutes) !== JSON.stringify(expectedActiveRoutes)) failures.push('Browser QA canonical navigation active-route evidence mismatch')
const productDetailEvidence = qaEvidence.productDetailContract
for (const field of ['allStatus200', 'breadcrumbUsesRuntimeDiv', 'galleryUsesRelativeWrapper', 'addToCartUsesPresentationWrapper', 'priceOwnedByVariantSelector', 'pricePrecedesVariantGroup', 'descriptionUsesPlainDivAndH3', 'mixedPdpParentMarkedApproximation', 'runtimeSubtreeMetadataScopedTruthfully', 'quantityMappingStatusApproximation', 'quantityDecrementDisabledAtMinimum', 'quantityClickIncremented', 'quantityClickDecremented', 'quantityKeyboardIncremented', 'quantityKeyboardDecremented', 'quantityPersistedAcrossVariantSwitching', 'quantityStatusAnnouncedSelectedValue', 'quantityLabelVisibleWithoutCartOverlap', 'variantSelectorMarkedApproximation', 'initialFirstVariantSelected', 'initialAddToCartEnabled', 'activeVariantClickKeptSelection', 'variantSwitchSelectedOther', 'alwaysExactlyOneVariantSelected', 'keyboardEnterSwitchedSelection', 'keyboardSpaceKeptSelection', 'addToCartRemainedEnabledThroughout', 'previewStatusAnnounced', 'previewCartCountUnchanged', 'previewCartDrawerRemainedClosed', 'unsupportedMerchantFieldsAbsent']) {
  if (productDetailEvidence?.[field] !== true) failures.push(`Browser QA product detail evidence missing/false: ${field}`)
}
if (JSON.stringify(productDetailEvidence?.viewportsMeasured) !== JSON.stringify([390, 768, 1024, 1440]) || productDetailEvidence?.maximumHorizontalOverflowPx !== 0 || JSON.stringify(productDetailEvidence?.responsiveColumns) !== JSON.stringify({ 390: 1, 768: 1, 1024: 2, 1440: 2 }) || JSON.stringify(productDetailEvidence?.responsiveGapPx) !== JSON.stringify({ 390: 24, 768: 24, 1024: 48, 1440: 48 }) || productDetailEvidence?.singleImageAspectRatio !== 1 || productDetailEvidence?.galleryNavigationControlCount !== 0 || productDetailEvidence?.quantityInitialValue !== 1) failures.push('Browser QA product detail responsive/gallery/quantity contract mismatch')
const articlesListEvidence = qaEvidence.articlesListContract
if (articlesListEvidence?.allStatus200 !== true || articlesListEvidence?.newsletterCopyAbsent !== true || articlesListEvidence?.blogListDirectlyPrecedesFooter !== true || articlesListEvidence?.articlesNavigationRemainedActive !== true || JSON.stringify(articlesListEvidence?.viewportsMeasured) !== JSON.stringify([390, 768, 1024, 1440]) || JSON.stringify(articlesListEvidence?.orderedMainBlocks) !== JSON.stringify(['hero', 'blog-list']) || articlesListEvidence?.newsletterBlockCount !== 0 || JSON.stringify(articlesListEvidence?.responsiveCardColumns) !== JSON.stringify({ 390: 1, 768: 2, 1024: 3, 1440: 3 }) || articlesListEvidence?.maximumHorizontalOverflowPx !== 0) failures.push('Browser QA articles-list newsletter-removal contract mismatch')
const requiredProductFilterEvidence = ['dialogInitialFocus', 'mobileOpenAriaModal', 'backdropVisible', 'bodyScrollLocked', 'backgroundInert', 'sameSectionToolbarInert', 'sameSectionGridPanelInert', 'backgroundRestoredOnClose', 'backgroundRestoredOnDesktopResize', 'cancelPreservedAppliedState', 'saveAppliedDraft', 'escapeClosed', 'focusRestored', 'desktopAriaModalAbsent', 'resizeSemanticSync', 'singleChipRemovalPreservedOtherFilters', 'stickyNoOverlapWithFullNav', 'stickyNoOverlapWithShrunkNav', 'unrelatedQueryParamPreserved', 'listViewHydrated']
for (const field of requiredProductFilterEvidence) {
  if (qaEvidence.interactions?.productFilters?.[field] !== true) failures.push(`Browser QA productFilters evidence missing/false: ${field}`)
}
if (qaEvidence.interactions?.productFilters?.mobileOpenRole !== 'dialog' || qaEvidence.interactions?.productFilters?.desktopRole !== 'complementary') failures.push('Browser QA product filter role evidence mismatch')
const productCardTypographyEvidence = qaEvidence.interactions?.productCardTypography
if (JSON.stringify(productCardTypographyEvidence?.viewportsMeasured) !== JSON.stringify([390, 768, 1024, 1440]) || JSON.stringify(productCardTypographyEvidence?.gridTitleFontSizePx) !== JSON.stringify({ 390: 12, 768: 16, 1024: 16, 1440: 16 }) || productCardTypographyEvidence?.gridTitleLineHeightRatio !== 1.3 || productCardTypographyEvidence?.desktopListTitleFontSizePx !== 20 || productCardTypographyEvidence?.titlesChecked !== 8 || productCardTypographyEvidence?.titlesWrappedWithoutOverflow !== true || productCardTypographyEvidence?.homeFeaturedProductsUnaffected !== true || productCardTypographyEvidence?.filterHeadingsUnaffected !== true) failures.push('Browser QA product card typography evidence mismatch')
if (input.navigationOffsetContract?.announcementAbsentAllNavRoutes !== true || input.navigationOffsetContract?.navigationTopPx !== 0 || input.navigationOffsetContract?.navigationRouteCount !== NAV_ROUTES.size) failures.push('All-navigation zero-offset input contract mismatch')
manifest.rendererRevision = gitHead
manifest.rendererSources = input.rendererSources
manifest.rendererProvenance = provenance
manifest.browserQaEvidence = { file: 'browser-qa-evidence.json', sha256: qaEvidenceDigest }
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

// Validate generated outputs, not templates, so export drift fails immediately.
for (const file of input.routes) {
  const absolute = join(root, file)
  if (!existsSync(absolute)) continue
  const html = readFileSync(absolute, 'utf8')
  if (!html.includes('<meta name="viewport"')) failures.push(`Missing viewport: ${file}`)
  if (!html.includes('data-mapping-status=')) failures.push(`Missing mapping status: ${file}`)
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const value = match[1]
    if (/^(?:https?:|mailto:|tel:|#)/.test(value)) continue
    const target = resolve(dirname(absolute), value.split(/[?#]/)[0])
    if (!existsSync(target)) failures.push(`Broken local ref in ${file}: ${value}`)
  }
  if (sha256(html) !== routeDigests[file]) failures.push(`Generated output drift: ${file}`)
}

const home = readFileSync(join(root, 'index.html'), 'utf8')
if (home.includes('data-block-type="announcement-bar"')) failures.push('Homepage announcement-bar is intentionally excluded')
if (!home.includes('<body data-no-announcement>')) failures.push('Homepage must declare its zero-offset navigation state')
const expectedMainSequence = ['hero', 'features', 'carousel', 'products-featured', 'about', 'blog-list']
const mainMarkup = home.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? ''
const actualMainSequence = [...mainMarkup.matchAll(/<section\b[^>]*data-block-type="([^"]+)"/g)].map(match => match[1])
if (JSON.stringify(actualMainSequence) !== JSON.stringify(expectedMainSequence)) {
  failures.push(`Homepage main block sequence mismatch: expected ${expectedMainSequence.join(' > ')}, received ${actualMainSequence.join(' > ')}`)
}
for (const [type, variant] of Object.entries(input.homepageContracts)) {
  if (!home.includes(`data-block-type="${type}"`) || !home.includes(`data-block-variant="${variant}"`)) failures.push(`Homepage contract missing: ${type}/${variant}`)
}
for (const file of input.routes) {
  const html = readFileSync(join(root, file), 'utf8')
  const sourceHtml = readFileSync(join(root, 'source/templates', file), 'utf8')
  if (/announcement-bar|data-dismiss-announcement|Complimentary delivery on orders over RM 100/.test(`${html}\n${sourceHtml}`)) failures.push(`Announcement markup/text must be absent from source and output: ${file}`)
}
for (const [file, owner] of Object.entries(input.runtimeContracts)) {
  const owners = [...readFileSync(join(root, file), 'utf8').matchAll(/data-runtime-component="([^"]+)"/g)].flatMap(match => match[1].split(/\s+/))
  if (!owners.includes(owner)) failures.push(`Runtime contract missing: ${file} -> ${owner}`)
}
const expectedRouteIdentities = [['/', 'index.html'], ['/products', 'products/index.html'], ['/articles', 'articles/index.html'], ['/cart', 'cart/index.html'], ['/checkout', 'checkout/index.html'], ['/contact', 'contact/index.html'], ['/order-tracking', 'order-tracking/index.html'], ['/products/the-saem-cover-perfection-fixealer', 'products/the-saem-cover-perfection-fixealer/index.html'], ['/articles/ideal-skincare-routine-oily-skin', 'articles/ideal-skincare-routine-oily-skin/index.html']]
const actualRouteIdentities = manifest.routes.map(({ route, file }) => [route, file])
if (JSON.stringify(actualRouteIdentities) !== JSON.stringify(expectedRouteIdentities)) failures.push('Manifest route identities/files do not match the exact C102 contract')
if (JSON.stringify(input.routes) !== JSON.stringify(expectedRouteIdentities.map(([, file]) => file))) failures.push('Renderer input routes do not match the exact C102 file contract')
const shellComposition = input.navigationShellComposition
if (shellComposition?.userAuthorized !== true || shellComposition?.canonicalSourceRoute !== 'index.html' || shellComposition?.navigationRouteCount !== NAV_ROUTES.size || shellComposition?.orderTrackingRoute !== 'order-tracking/index.html' || shellComposition?.preservedRuntimeHierarchy !== 'OrderLookupClient > order-lookup-card' || JSON.stringify(shellComposition?.standaloneExceptions) !== JSON.stringify(STANDALONE_NAV_EXCEPTIONS)) failures.push('User-authorized canonical navigation shell composition contract mismatch')

const footerShellRoutes = ['index.html', 'products/index.html', 'articles/index.html', 'contact/index.html', 'products/the-saem-cover-perfection-fixealer/index.html', 'articles/ideal-skincare-routine-oily-skin/index.html']
const footerlessRoutes = ['cart/index.html', 'checkout/index.html', 'order-tracking/index.html']
if (input.footerContent?.copyrightText !== 'Copyright © 2022 IAM' || input.footerContent?.visibleCopyrightYear !== 2026) failures.push('Footer copyright input/current-year contract mismatch')
if ([...NAV_ROUTES.values()].some(contract => contract.announcement !== false)) failures.push('All canonical navigation routes must declare announcement false')
for (const [file, routeContract] of NAV_ROUTES) {
  const html = readFileSync(join(root, file), 'utf8')
  const sourceHtml = readFileSync(join(root, 'source/templates', file), 'utf8')
  const headers = [...html.matchAll(/<header\b[\s\S]*?<\/header>/g)]
  const header = headers[0]?.[0] ?? ''
  const headerOpen = header.match(/<header\b[^>]*>/)?.[0] ?? ''
  const navMarkup = header.match(/<nav class="nav-links" data-nav-links aria-label="Primary">([\s\S]*?)<\/nav>/)?.[1] ?? ''
  const navLinks = [...navMarkup.matchAll(/<a\b([^>]*)>([^<]+)<\/a>/g)].map(match => ({ attrs: match[1], label: match[2] }))
  const expectedLinks = NAV_ITEMS.map(([label, target]) => ({ label, href: relative(dirname(file), target) || 'index.html', current: label === routeContract.active }))
  const actualLinks = navLinks.map(({ attrs, label }) => ({ label, href: attrs.match(/href="([^"]+)"/)?.[1] ?? '', current: /aria-current="page"/.test(attrs) }))
  const expectedBrandHref = relative(dirname(file), 'index.html') || 'index.html'
  const brandHref = header.match(/<a class="brand" href="([^"]+)">GlowBeauty<\/a>/)?.[1]
  const menuButton = header.match(/<button\b(?=[^>]*class="menu-btn")(?=[^>]*data-menu-button)(?=[^>]*aria-expanded="false")(?=[^>]*aria-label="Toggle navigation")[^>]*>/s)
  if (headers.length !== 1 || !/data-cart-background/.test(headerOpen) || !/class="nav"/.test(headerOpen) || !/data-block-type="navigation"/.test(headerOpen) || !/data-block-variant="centered"/.test(headerOpen) || !/data-mapping-status="approximation"/.test(headerOpen)) failures.push(`Canonical centered navigation header mismatch: ${file}`)
  if (brandHref !== expectedBrandHref || JSON.stringify(actualLinks) !== JSON.stringify(expectedLinks) || !menuButton || (navMarkup.match(/aria-current="page"/g) || []).length !== 1) failures.push(`Canonical navigation links/current contract mismatch: ${file}`)
  if (sourceHtml !== html || /class="icon-btn"|>About<|>Blog</.test(sourceHtml)) failures.push(`Authoritative navigation source/output drift: ${file}`)
  const announcementCount = (html.match(/data-block-type="announcement-bar"/g) || []).length
  if (announcementCount !== 0 || !/<body[^>]*data-no-announcement/.test(html)) failures.push(`No-announcement navigation offset contract mismatch: ${file}`)
}
for (const file of footerShellRoutes) {
  const html = readFileSync(join(root, file), 'utf8')
  const footerChecks = [
    'data-block-variant="dark-gradient"', 'e032d5bceb62-JeEczkJbGs2bYT2Bx_hyCQuHh21iaXtF66Q5Gfz3BxQ.jpeg',
    'Quality Products', 'Support Policy', 'Introduce', 'https://primecommerce.asia/en/support',
    'Business Suite 19A-24-3', 'tel:02866542688', 'mailto:c102@primeweb.asia',
    'aria-label="Facebook"', 'aria-label="YouTube"', 'aria-label="Instagram"', 'Copyright © 2026 IAM',
  ]
  if ((html.match(/<footer\b/g) || []).length !== 1 || footerChecks.some(check => !html.includes(check))) failures.push(`Dark-gradient footer contract mismatch: ${file}`)
}
const articlesListInput = input.articlesListAdaptation
const articlesListFile = 'articles/index.html'
const articlesListSource = readFileSync(join(root, 'source/templates', articlesListFile), 'utf8')
const articlesListHtml = readFileSync(join(root, articlesListFile), 'utf8')
const articlesMain = articlesListHtml.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? ''
const articlesMainBlocks = [...articlesMain.matchAll(/<section\b[^>]*data-block-type="([^"]+)"/g)].map(match => match[1])
if (articlesListInput?.sourceRoute !== articlesListFile || articlesListInput?.userAuthorizedNewsletterRemoval !== true || JSON.stringify(articlesListInput?.orderedMainBlocks) !== JSON.stringify(['hero', 'blog-list']) || articlesListInput?.newsletterBlockCount !== 0 || articlesListInput?.blogListDirectlyPrecedesFooter !== true) failures.push('Articles-list removal input contract mismatch')
if (articlesListSource !== articlesListHtml || JSON.stringify(articlesMainBlocks) !== JSON.stringify(['hero', 'blog-list']) || /data-block-type="newsletter"|Glow letters|Product edits and beauty notes|you@example\.com|>Subscribe</i.test(`${articlesListSource}\n${articlesListHtml}`)) failures.push('Articles list must render Hero > BlogList directly before Footer with no newsletter section')
if (input.rendererSources.includes('src/blocks/newsletter/index.tsx')) failures.push('Unused NewsletterBlock source must not remain in C102 provenance after Articles removal')
const articlesCss = readFileSync(join(root, '_assets/c102-v2.css'), 'utf8')
if (!/@media\s*\(min-width:\s*768px\)\s*and\s*\(max-width:\s*1023px\)[\s\S]*?section\[data-block-type="blog-list"\]\s*\.blog-grid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(articlesCss)) failures.push('Articles BlogList must preserve Prime responsive columns: 1 mobile, 2 tablet, 3 desktop')
const productsHtml = readFileSync(join(root, 'products/index.html'), 'utf8')
for (const contract of ['data-block-variant="grid-4"', 'data-filter-panel', 'role="complementary"', 'data-filter-backdrop', 'data-filter-save', 'data-filter-search-form', 'data-filter-category', 'aria-pressed="false"', 'data-filter-range-output', 'data-filter-range-track', 'aria-label="Minimum price"', 'aria-label="Maximum price"', 'data-filter-min', 'data-filter-max', 'data-active-filter-chips', 'data-view="grid"', 'data-view="list"', 'data-products-empty']) {
  if (!productsHtml.includes(contract)) failures.push(`Products filter contract missing: ${contract}`)
}
const productFilterMarkup = productsHtml.match(/<aside class="product-filter-sidebar"[\s\S]*?<\/aside>/)?.[0] ?? ''
const productFilterOrder = ['filter-categories', 'filter-price', 'filter-search'].map(className => productFilterMarkup.indexOf(className))
if (productFilterOrder.some(index => index < 0) || !(productFilterOrder[0] < productFilterOrder[1] && productFilterOrder[1] < productFilterOrder[2])) failures.push('Products filter hierarchy must match ProductFilterSidebar: Categories > Price Range > Search')
if (/type="checkbox"/.test(productFilterMarkup)) failures.push('Products category filter must use CategoryTree-style aria-pressed buttons, not checkboxes')
const productsCss = readFileSync(join(root, '_assets/c102-v2.css'), 'utf8')
for (const contract of ['border-radius:28px', 'gap:40px', '.category-tree button[aria-pressed="true"]', '.price-range-control input[type="range"]', '.filter-search-control input[type="search"]', '.filter-card-heading{margin-bottom:24px}', '.filter-categories .filter-card-heading{margin-bottom:20px}', '.filter-search-control{border-color:rgba(189,99,119,.125)}', '--product-filter-sticky-top']) {
  if (!productsCss.includes(contract)) failures.push(`Products filter visual contract missing: ${contract}`)
}
if (!/section\[data-block-type="products-grid"\]\s*\.product-grid:not\(\.is-list\)\s*\.product-info\s*h3\s*\{\s*font-size:\s*16px;\s*line-height:\s*1\.3;\s*\}/s.test(productsCss) || !/@media\s*\(max-width:\s*639px\)[\s\S]*?section\[data-block-type="products-grid"\][\s\S]*?\.product-grid:not\(\.is-list\)[\s\S]*?\.product-info[\s\S]*?h3\s*\{\s*font-size:\s*12px;\s*\}/.test(productsCss)) failures.push('Products grid card title typography must remain 12px below 640px and 16px otherwise')
const productsScript = readFileSync(join(root, '_assets/c102-v2.js'), 'utf8')
for (const contract of ['syncProductFilterStickyTop', 'navHeight + 16', 'requestAnimationFrame(syncProductFilterStickyTop)', 'ResizeObserver(syncProductFilterStickyTop)']) {
  if (!productsScript.includes(contract)) failures.push(`Products filter sticky behavior contract missing: ${contract}`)
}
if (/announcement|data-dismiss-announcement|Complimentary delivery on orders over RM 100/i.test(`${productsCss}\n${productsScript}`)) failures.push('Unused announcement CSS/JS contract must be fully removed')
if (/\.product-filter-sidebar input\s*\{[^}]*width:\s*100%/.test(productsCss)) failures.push('Products filter broad input selector regression: scope sizing by input type')
const productDetailFile = 'products/the-saem-cover-perfection-fixealer/index.html'
const productDetailHtml = readFileSync(join(root, productDetailFile), 'utf8')
const productDetailInput = input.productDetailAdaptation
if (productDetailInput?.mixedParentMappingStatus !== 'approximation' || JSON.stringify(productDetailInput?.preciseRuntimeSubtrees) !== JSON.stringify(['ProductImageGallery', 'AddToCartButton', 'ProductDetailPage.description']) || productDetailInput?.singleImageState !== true || productDetailInput?.variantSelectionInitiallyFirst !== '01 Clear Beige' || productDetailInput?.variantLabel !== 'Phân loại' || productDetailInput?.variantSelectorMappingStatus !== 'approximation' || productDetailInput?.variantSelectorStructuralReference !== 'src/components/storefront/ProductVariantSelector.tsx' || productDetailInput?.variantSelectorAcceptedLoss !== 'First variant is preselected and selection cannot be cleared so AddToCart remains safely enabled' || productDetailInput?.previewAddToCartLossAccepted !== true || productDetailInput?.previewAddToCartBehavior !== 'accessible-status-without-cart-mutation' || productDetailInput?.quantitySelectorMappingStatus !== 'approximation' || productDetailInput?.quantitySelectorStructuralReference !== 'src/components/storefront/CartDrawer.tsx' || productDetailInput?.quantitySelectorAcceptedLoss !== 'PDP owner has no quantity control; preview quantity is not persisted to cart' || productDetailInput?.merchantShortDescriptionPreserved !== true || JSON.stringify(productDetailInput?.unsupportedFieldsOmitted) !== JSON.stringify(['comparePrice', 'sku', 'specifications', 'inventory'])) failures.push('Product detail renderer adaptation input contract mismatch')
for (const contract of ['<div class="pd-breadcrumb" role="navigation" aria-label="Breadcrumb">', 'href="../index.html">Products</a>', '<div class="pd-grid" data-mapping-status="approximation">', 'data-product-image-gallery data-image-count="1" data-runtime-component="ProductImageGallery" data-mapping-status="runtime"', 'class="product-image-relative"', 'class="product-image-main"', 'class="pd-category">Complexion', 'data-product-variant-selector data-mapping-status="approximation" data-structural-reference="ProductVariantSelector"', 'data-product-price aria-live="polite" aria-atomic="true">RM 24.00', 'id="variant-label">Phân loại', 'role="group" aria-labelledby="variant-label"', 'data-product-variant data-price="24.00" aria-pressed="true">01 Clear Beige', 'data-product-variant data-price="24.00" aria-pressed="false">1.5 Natural Beige', 'class="product-quantity" data-mapping-status="approximation" data-structural-reference="CartDrawer quantity stepper"', 'id="quantity-label">Quantity', 'class="quantity-stepper" role="group" aria-labelledby="quantity-label"', 'data-quantity-decrement aria-label="Decrease quantity" disabled', 'data-product-quantity aria-live="polite" aria-atomic="true">1</output>', 'data-quantity-increment aria-label="Increase quantity"', 'class="product-add-to-cart-wrapper" data-runtime-component="AddToCartButton" data-mapping-status="runtime"', 'data-product-add>Add to cart', 'data-product-action-status role="status" aria-live="polite" hidden', 'class="pd-description" aria-labelledby="product-description-title" data-runtime-component="ProductDetailPage" data-mapping-status="runtime"', '<h3 id="product-description-title">Description</h3>', 'data-block-type="cartWidget"', 'data-cart-drawer']) {
  if (!productDetailHtml.includes(contract)) failures.push(`Product detail renderer contract missing: ${contract}`)
}
const productVariantButtons = [...productDetailHtml.matchAll(/<button\b(?=[^>]*data-product-variant)[^>]*aria-pressed="(true|false)"[^>]*>/g)]
if (productVariantButtons.length !== 2 || JSON.stringify(productVariantButtons.map(match => match[1])) !== JSON.stringify(['true', 'false'])) failures.push('Product detail must initialize with exactly the first of two variants selected')
const productGalleryMarkup = productDetailHtml.match(/<div class="product-image-gallery"[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? ''
if ((productGalleryMarkup.match(/<img\b/g) || []).length !== 1 || /gallery-nav|thumbnail|aria-selected/.test(productGalleryMarkup)) failures.push('Product detail single-image gallery state must omit arrows and thumbnails')
const addToCartIndex = productDetailHtml.indexOf('data-product-add')
const descriptionIndex = productDetailHtml.indexOf('class="pd-description"')
const variantOptionsIndex = productDetailHtml.indexOf('class="variant-options"')
const quantityIndex = productDetailHtml.indexOf('class="product-quantity"')
if (addToCartIndex < 0 || descriptionIndex <= addToCartIndex) failures.push('Product merchant description must render below AddToCart CTA')
if (variantOptionsIndex < 0 || quantityIndex <= variantOptionsIndex || addToCartIndex <= quantityIndex) failures.push('Approximate quantity selector must render after variants and before AddToCart CTA')
if (!/data-product-variant-selector[^>]*>\s*<div class="pd-price"[^>]*data-product-price[^>]*>[\s\S]*?<p id="variant-label">/.test(productDetailHtml)) failures.push('ProductVariantSelector must own price as its first child before the variant label/group')
if (/<nav class="pd-breadcrumb"|<section class="pd-description"|<h2 id="product-description-title"/.test(productDetailHtml)) failures.push('Product breadcrumb/description must use runtime div hierarchies')
if (/<div class="pd-grid"[^>]*data-mapping-status="runtime"|<div class="pd-grid"[^>]*data-runtime-component=/.test(productDetailHtml)) failures.push('Mixed PDP parent must remain approximation and must not claim a runtime owner')
if (/data-product-variant-selector[^>]*(?:data-mapping-status="runtime"|data-runtime-component=)/.test(productDetailHtml) || /aria-pressed="false">01 Clear Beige/.test(productDetailHtml)) failures.push('Preselected non-clearable variant adaptation must not claim runtime fidelity or lose its initial selection')
if (/runtime-note|class="pdp(?:\s|"|-)|Product details|compareAtPrice|\bSKU\b|Specifications|In Stock|Only \d+ left|Out of Stock|data-quantity-max|quantity maximum|type="number"[^>]*data-product-quantity/i.test(productDetailHtml)) failures.push('Product detail contains forbidden legacy approximation, unsupported merchant data, or invented quantity limit')
for (const contract of ['.pd-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;max-width:1200px', '@media(max-width:768px){.pd-breadcrumb{padding:12px 16px}.pd-grid{grid-template-columns:1fr;gap:24px', '.product-image-relative{position:relative}', '.product-image-main{position:relative', 'aspect-ratio:1', 'border-radius:16px', 'object-fit:cover', '.pd-info h1{', 'font-size:32px', '.pd-price{', 'font-size:28px', '.variant-options button{min-height:38px;padding:8px 16px;border:1.5px', 'border-radius:8px', '.product-quantity{', '.quantity-stepper button{width:44px;height:44px', '.quantity-stepper output{', '@media(max-width:768px){.product-quantity{padding-left:64px}}', '.product-add-to-cart{width:100%;margin:0 0 24px;padding:14px 32px', 'border-radius:12px', '.pd-description h3{']) {
  if (!productsCss.includes(contract)) failures.push(`Product detail CSS contract missing: ${contract}`)
}
for (const contract of ['const productVariants', 'const selectedButton = requestedButton || productVariants[0]', 'button.addEventListener("click", () => selectVariant(button))', 'productVariants.find(', 'Number.isSafeInteger(value)', 'current < Number.MAX_SAFE_INTEGER', 'quantity ${readQuantity()}; your cart was not changed.']) {
  if (!productsScript.includes(contract)) failures.push(`Product detail interaction contract missing: ${contract}`)
}
for (const file of footerlessRoutes) {
  if (/<footer\b/.test(readFileSync(join(root, file), 'utf8'))) failures.push(`Standalone route must remain footerless: ${file}`)
}
for (const file of STANDALONE_NAV_EXCEPTIONS) {
  if (/data-block-type="navigation"|data-nav-links|data-menu-button/.test(readFileSync(join(root, file), 'utf8'))) failures.push(`Standalone route must remain navigation-free: ${file}`)
}
if (!/<main\b(?=[^>]*data-runtime-component="OrderLookupClient")[^>]*>[\s\S]*?<section class="order-lookup-card">/.test(readFileSync(join(root, 'order-tracking/index.html'), 'utf8'))) failures.push('Order Tracking shell must preserve OrderLookupClient card hierarchy')

const output = {
  schemaVersion: 2,
  template: input.template,
  routeCount: input.routes.length,
  homepageContracts: input.homepageContracts,
  homepageMainSequence: expectedMainSequence,
  navigationOffsetContract: input.navigationOffsetContract,
  runtimeContracts: input.runtimeContracts,
  routeDigests,
  provenance,
  browserQaEvidence: { file: 'browser-qa-evidence.json', sha256: qaEvidenceDigest },
  navigationContract: { items: NAV_ITEMS.map(([label, target]) => ({ label, target })), routes: Object.fromEntries(NAV_ROUTES), standaloneExceptions: STANDALONE_NAV_EXCEPTIONS },
  footerContract: { variant: 'dark-gradient', shellRoutes: footerShellRoutes, standaloneRoutes: footerlessRoutes },
}
writeFileSync(join(root, 'renderer-contract.generated.json'), `${JSON.stringify(output, null, 2)}\n`)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`C102 exported and validated: ${input.routes.length} routes; ${dirtySources.length} dirty renderer source(s)`)

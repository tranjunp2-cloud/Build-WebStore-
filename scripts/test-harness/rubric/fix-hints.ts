/**
 * Per-criterion fix hints — actionable guidance for team when a rubric criterion
 * fails. Surfaced in the harness index WeakestDrawer + admin dashboard.
 *
 * Coverage: top 22 most-failed criteria across 390 fixtures (per rubric-report-v1.3).
 * Unknown criterionId → UI falls back to showing only the evaluator `reason`.
 *
 * Keep hints concise (<160 chars), imperative, and point to the file/field to change.
 */

export const FIX_HINTS: Record<string, string> = {
    // ─── Visual Richness ────────────────────────────────────────────────────
    'hero-variant-diverse':
        'Đổi hero.variant trong preset (template-presets-batch*.ts) sang split-image / fullscreen / video-bg / overlay. Tránh default "centered".',
    'gallery-present':
        'Thêm block gallery / gallery-masonry / portfolio-grid vào preset.blocks[] — category nào cũng nên có visual proof.',
    'stats-present':
        'Thêm block stats vào preset (3+ stat items) — show numeric credibility.',
    'logo-cloud-present':
        'Thêm block client-logos / logo-cloud (4+ logos) — social proof B2B. Fix: curate 6 logos realistic cho cat đó.',
    'image-coverage':
        'Preset thiếu hero bg image + gallery. Fix: hero.imageKeyword cụ thể (cat-specific) hoặc thêm gallery block.',

    // ─── Typography Hierarchy ───────────────────────────────────────────────
    'hero-headline-length-strict':
        'Hero headline phải 25-70 chars. Quá ngắn = thiếu context, quá dài = loãng. Rewrite trong preset.hero.headline.',

    // ─── Social Proof ───────────────────────────────────────────────────────
    'logos-count-4plus':
        'Logo cloud <4. Thêm logos trong preset hoặc content pack để đạt 4-6 logos.',
    'stats-count-3plus':
        'Stats block chỉ có <3 items. Pad thêm stats trong preset.stats.items[] để đạt 3-4.',

    // ─── Micro-Interactions ─────────────────────────────────────────────────
    'nav-variant-rich':
        'Nav đang dùng basic variant. Đổi preset.navigation.variant sang mega / centered-logo / stacked để tăng richness.',
    'nav-links-balanced':
        'Nav links <3 hoặc >7. Fix preset.navigation.links[] cân đối 3-7 entries (Home, About, Services, Portfolio, Contact).',
    'cta-block-present':
        'Thiếu CTA block. Thêm 1 block cta hoặc newsletter vào preset.blocks[] giữa trang.',

    // ─── Conversion Path ────────────────────────────────────────────────────
    'mid-cta-present':
        'CTA chỉ ở hero. Thêm 1 CTA giữa trang (between features và footer) để tăng conversion touchpoint.',
    'newsletter-present':
        'Thiếu newsletter / lead capture form. Thêm block newsletter trong preset — critical cho list building.',

    // ─── Content Authenticity ───────────────────────────────────────────────
    'features-count-3plus':
        'Features <3. Pad features trong preset hoặc content pack industry-content-*.ts để đạt 3-6 features.',
    'faq-count-4plus':
        'FAQ <4. Thêm 2-4 câu hỏi category-specific vào preset.faq.items[] hoặc content pool.',
    'content-depth-500':
        'Tổng copy <500 chars. Preset quá thin — expand hero subheadline, feature descriptions, about paragraph.',

    // ─── Accessibility ──────────────────────────────────────────────────────
    'theme-color-contrast':
        'Primary color contrast UI fail WCAG. Đổi theme.primaryColor sang hex tối/sáng hơn hoặc điều chỉnh secondaryColor.',

    // ─── Category DNA ───────────────────────────────────────────────────────
    'category-dna-compliance':
        'Thiếu mandatory blocks ngành đó (check CATEGORY_REQUIREMENTS.mandatoryBlocks). Restaurant cần menu-display+booking-widget; beauty cần service-cards; tech cần pricing.',
    'category-signature-variety':
        '<2 signature industry blocks. Thêm 1-2 block đặc trưng ngành vào preset (vd: tech → pricing+logo-cloud; beauty → service-cards+team).',

    // ─── Content Uniqueness ─────────────────────────────────────────────────
    'hero-headline-unique':
        'Headline trùng với 10+ fixtures khác (templated filler). Rewrite hero.headline thành câu UNIQUE cho preset này — dùng business name, angle riêng.',
    'hero-subheadline-unique':
        'Subheadline quá giống các preset khác. Rewrite subheadline với voice + specific value prop riêng biệt cho business này.',
    'cta-label-unique':
        'CTA label quá generic ("Learn More", "Get Started" lặp 10+ lần). Đổi thành action cụ thể: "Book a Table", "View Menu", "Schedule Consultation" tùy ngành.',
}

/** Lookup helper — returns empty string if no hint registered. */
export function getFixHint(criterionId: string): string {
    return FIX_HINTS[criterionId] ?? ''
}

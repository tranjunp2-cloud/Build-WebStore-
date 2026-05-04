/**
 * block-registry-reader.ts
 * Reads from the code-first block registry and normalizes to a flat shape
 * suitable for the studio Block Catalog UI.
 *
 * Cache: module-level (process lifetime). Registry is static — no DB hit.
 */
import { blockRegistry } from '@/blocks/registry'

// ── Category fallback ────────────────────────────────────────────────────────
// Category is now sourced from meta.category (set in each block's config.ts).
// This fallback is used only when a block has no category in its meta.

const DEFAULT_CATEGORY = 'other'

// ── Normalized block shape for the UI ────────────────────────────────────────

export type NormalizedBlock = {
    slug: string
    name: string
    nameVi: string
    description: string
    icon: string
    category: string
    variants: string[]
    defaultVariant: string
    editableFields: string[]
    aiVisible: boolean
    isSystem: boolean
}

// Vietnamese name map (curated for common blocks; others fall back to English)
const VI_NAME_MAP: Record<string, string> = {
    navigation: 'Thanh điều hướng',
    hero: 'Banner chính',
    features: 'Tính năng',
    about: 'Giới thiệu',
    testimonials: 'Đánh giá',
    faq: 'Câu hỏi thường gặp',
    contact: 'Liên hệ',
    gallery: 'Bộ sưu tập',
    footer: 'Chân trang',
    pricing: 'Bảng giá',
    cta: 'Kêu gọi hành động',
    stats: 'Thống kê',
    team: 'Đội ngũ',
    newsletter: 'Đăng ký nhận tin',
    video: 'Video',
    'logo-cloud': 'Logo đối tác',
    'blog-list': 'Danh sách bài viết',
    'products-grid': 'Lưới sản phẩm',
    'products-featured': 'Sản phẩm nổi bật',
    'custom-html': 'HTML tuỳ chỉnh',
    socialWidget: 'Mạng xã hội',
    cartWidget: 'Giỏ hàng',
    'pricing-table': 'Bảng giá chi tiết',
    'gallery-masonry': 'Bộ sưu tập lưới',
    'whatsapp-button': 'Nút WhatsApp',
    'google-maps': 'Google Maps',
    'social-proof': 'Bằng chứng xã hội',
    'countdown-timer': 'Đếm ngược',
    'before-after': 'Trước và sau',
    'feature-comparison': 'So sánh tính năng',
    'download-cta': 'Tải xuống',
    'video-background': 'Video nền',
    breadcrumb: 'Đường dẫn',
    divider: 'Đường phân cách',
    'announcement-bar': 'Thông báo',
    'client-logos': 'Logo khách hàng',
    accordion: 'Accordion',
    'step-process': 'Quy trình',
    'portfolio-grid': 'Danh mục dự án',
    'menu-food': 'Thực đơn',
    'service-cards': 'Thẻ dịch vụ',
    carousel: 'Băng chuyền',
    'menu-display': 'Hiển thị menu',
    'booking-widget': 'Đặt lịch',
    'class-schedule': 'Lịch lớp học',
    'review-cards': 'Thẻ đánh giá',
    'video-showcase': 'Giới thiệu video',
    'doctor-profile': 'Hồ sơ bác sĩ',
    'property-card': 'Thẻ bất động sản',
    'product-quick-view': 'Xem nhanh sản phẩm',
}

// ── Blocks hidden from the editor library UI (user cannot add them) ──────────
// TODO: remove when the block is production-ready
const EDITOR_HIDDEN_BLOCKS = new Set([
    'class-schedule', // not production-ready — temporarily hidden from editor
])

// ── Module-level cache (process lifetime) ────────────────────────────────────

let _cached: NormalizedBlock[] | null = null

/**
 * Returns all registered blocks as normalized catalog entries.
 * Result is cached for the process lifetime (registry is static).
 */
export function listAllBlocks(): NormalizedBlock[] {
    if (_cached) return _cached

    const slugs = blockRegistry.getBlockTypes().filter((s) => !EDITOR_HIDDEN_BLOCKS.has(s))
    _cached = slugs.map((slug) => {
        const meta = blockRegistry.getBlockMeta(slug)
        if (!meta) {
            // Tolerant fallback for malformed registry entries
            console.warn(`[block-registry-reader] Missing meta for slug: ${slug}`)
            return {
                slug,
                name: slug,
                nameVi: slug,
                description: '',
                icon: '📦',
                category: DEFAULT_CATEGORY,
                variants: [],
                defaultVariant: '',
                editableFields: [],
                aiVisible: true,
                isSystem: false,
            }
        }
        return {
            slug,
            name: meta.name,
            nameVi: VI_NAME_MAP[slug] ?? meta.name,
            description: meta.description,
            icon: meta.icon,
            category: meta.category ?? DEFAULT_CATEGORY,
            variants: meta.variants,
            defaultVariant: meta.defaultVariant,
            editableFields: meta.editableFields,
            aiVisible: meta.aiVisible ?? true,
            isSystem: meta.isSystem ?? false,
        }
    })
    return _cached
}

/**
 * Returns a single block by slug, or null if not found.
 */
export function getBlockBySlug(slug: string): NormalizedBlock | null {
    return listAllBlocks().find((b) => b.slug === slug) ?? null
}

/**
 * Returns all known slugs from the registry (for whitelist validation).
 */
export function getRegistrySlugs(): Set<string> {
    return new Set(blockRegistry.getBlockTypes())
}

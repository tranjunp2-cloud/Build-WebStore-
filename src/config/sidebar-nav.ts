/**
 * Shared sidebar navigation model — single source of truth for BOTH the dashboard sidebar
 * (`components/dashboard/Sidebar.tsx`) and the editor menu drawer
 * (`components/editor/EditorMenuDrawer.tsx`).
 *
 * Extracted from the dashboard sidebar (F18 CMS Core Layout, IA Restructure #1138) so the two
 * sidebars can never drift. Flat sections, NO accordion (design docs/design/F18-cms-layout-design.md):
 *   Dashboard standalone → ONLINE STORE → CORE OPERATIONS → CRM → SETTINGS → SUPPORT.
 *
 * Pure data + a pure RBAC filter — no React, no hooks, no i18n import — so both consumers stay
 * in sync and the filter is unit-testable in isolation.
 */

import {
    LayoutDashboard,
    Globe,
    LayoutTemplate,
    Headphones,
    Package,
    ShoppingCart,
    Users,
    UserPlus,
    Percent,
    PenLine,
    CreditCard,
    Truck,
    Bell,
    UsersRound,
    type LucideIcon,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

/** Keys the layout can pass counts for; anything absent simply renders no badge. */
export type SidebarBadgeKey = 'orders' | 'products' | 'discounts' | 'customers' | 'leads'

export interface NavLeaf {
    label: { en: string; ms: string }
    icon: LucideIcon
    href: string
    /** RBAC permission id (builder/blog/orders/products/settings) — full-access roles bypass. */
    permissionId?: string
    /** CRM items keep the legacy "owner/admin only" gate (parity with the old /customers group). */
    fullAccessOnly?: boolean
    superAdminOnly?: boolean
    /** Dev-only item: hidden on Production, visible on dev/staging/sandbox. */
    devOnly?: boolean
    badgeKey?: SidebarBadgeKey
}

export interface NavSection {
    /** null = no header (Dashboard standalone block). */
    header: { en: string; ms: string } | null
    items: NavLeaf[]
}

/** The 4 inputs to the 5-tier RBAC gate. */
export interface NavFilterCtx {
    currentUserRole?: string
    permissions?: string[]
    isSuperAdmin?: boolean
    isProduction?: boolean
}

// ─── Nav config (flat sections — design §2 table) ────────────────────────────

export const NAV_SECTIONS: NavSection[] = [
    {
        header: null,
        items: [
            { label: { en: 'Dashboard', ms: 'Papan Pemuka' }, icon: LayoutDashboard, href: '/dashboard' },
        ],
    },
    {
        header: { en: 'Online Store', ms: 'Kedai Online' },
        // Media intentionally absent — old-version parity (decision 2026-06-11)
        items: [
            { label: { en: 'Editor', ms: 'Editor' }, icon: LayoutTemplate, href: '/editor', permissionId: 'builder' },
            { label: { en: 'Blog', ms: 'Blog' }, icon: PenLine, href: '/blog', permissionId: 'blog' },
        ],
    },
    {
        header: { en: 'Core Operations', ms: 'Operasi Teras' },
        items: [
            { label: { en: 'Orders', ms: 'Pesanan' }, icon: ShoppingCart, href: '/orders', permissionId: 'orders', badgeKey: 'orders' },
            { label: { en: 'Products', ms: 'Produk' }, icon: Package, href: '/products', permissionId: 'products', badgeKey: 'products' },
            { label: { en: 'Discounts', ms: 'Diskaun' }, icon: Percent, href: '/discounts', permissionId: 'orders', badgeKey: 'discounts' },
        ],
    },
    {
        header: { en: 'CRM', ms: 'CRM' },
        items: [
            { label: { en: 'All Customers', ms: 'Semua Pelanggan' }, icon: Users, href: '/customers', fullAccessOnly: true, badgeKey: 'customers' },
            { label: { en: 'Contact Leads', ms: 'Kenalan' }, icon: UserPlus, href: '/contact-leads', fullAccessOnly: true, badgeKey: 'leads' },
        ],
    },
    {
        header: { en: 'Settings', ms: 'Tetapan' },
        items: [
            { label: { en: 'Payments', ms: 'Pembayaran' }, icon: CreditCard, href: '/settings/payments', permissionId: 'settings' },
            { label: { en: 'Shipping', ms: 'Penghantaran' }, icon: Truck, href: '/settings/shipping', permissionId: 'settings' },
            { label: { en: 'Domains', ms: 'Domain' }, icon: Globe, href: '/settings/domains', permissionId: 'settings' },
            { label: { en: 'Email Templates', ms: 'Templat E-mel' }, icon: Bell, href: '/settings/email-templates', permissionId: 'settings' },
            // Visible to ALL roles: the target page is the 2-tab Profile+Staff merge; the Staff tab is
            // owner-gated inside the page, never here.
            { label: { en: 'Team & Account', ms: 'Pasukan & Akaun' }, icon: UsersRound, href: '/settings/staff' },
        ],
    },
    {
        header: { en: 'Support', ms: 'Sokongan' },
        items: [
            { label: { en: 'Help Center', ms: 'Pusat Bantuan' }, icon: Headphones, href: '/help' },
        ],
    },
]

// ─── RBAC filter (pure — identical 5-tier gate used by both sidebars) ─────────

/**
 * Filter nav sections by role + custom permissions, dropping any section left empty.
 *
 * SECURITY: this is UX-only nav hiding, NOT the auth boundary — pages still enforce their own
 * auth. But it MUST stay identical across both sidebars so neither leaks items a role can't use.
 */
export function filterNavSections(
    sections: NavSection[],
    { currentUserRole = 'viewer', permissions = [], isSuperAdmin = false, isProduction = false }: NavFilterCtx,
): NavSection[] {
    const isOwner = currentUserRole === 'owner'
    // editor/viewer are legacy roles — treat as full access to avoid silently breaking existing staff
    const hasFullAccess =
        isOwner || currentUserRole === 'admin' || currentUserRole === 'editor' || currentUserRole === 'viewer'

    return sections
        .map((section) => ({
            ...section,
            items: section.items.filter((leaf) => {
                if (leaf.devOnly) return !isProduction // env-gate, role-independent per design §2
                if (leaf.superAdminOnly) return isSuperAdmin
                if (leaf.fullAccessOnly) return hasFullAccess
                if (!leaf.permissionId) return true
                if (hasFullAccess) return true
                return permissions.includes(leaf.permissionId)
            }),
        }))
        .filter((section) => section.items.length > 0) // hide header when its whole section is filtered out
}

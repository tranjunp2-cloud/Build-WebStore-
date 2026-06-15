import { describe, it, expect } from 'vitest'
import { filterNavSections, NAV_SECTIONS, type NavSection, type NavLeaf } from '@/config/sidebar-nav'

// ── TC-F18-SB-FILTER-01: Role-Based Filtering (Owner) ──────────────────────
describe('[TC-F18-SB-FILTER-01] filterNavSections with owner role', () => {
	it('owner role sees all 6 sections with all items', () => {
		// Arrange, Act
		const result = filterNavSections(NAV_SECTIONS, {
			currentUserRole: 'owner',
			permissions: [],
			isSuperAdmin: false,
			isProduction: true,
		})

		// Assert
		expect(result).toHaveLength(6)
		// Dashboard section (no header)
		expect(result[0].header).toBeNull()
		expect(result[0].items).toHaveLength(1) // Dashboard
		// Online Store
		expect(result[1].header?.en).toBe('Online Store')
		expect(result[1].items).toHaveLength(2) // Editor, Blog
		// Core Operations
		expect(result[2].header?.en).toBe('Core Operations')
		expect(result[2].items).toHaveLength(3) // Orders, Products, Discounts
		// CRM
		expect(result[3].header?.en).toBe('CRM')
		expect(result[3].items).toHaveLength(2) // All Customers, Contact Leads
		// Settings
		expect(result[4].header?.en).toBe('Settings')
		expect(result[4].items).toHaveLength(5) // Payments, Shipping, Domains, Email Templates, Team & Account
		// Support
		expect(result[5].header?.en).toBe('Support')
		expect(result[5].items).toHaveLength(1) // Help Center
	})
})

// ── TC-F18-SB-FILTER-02: Limited Permissions (staff with 'orders' permission) ────
describe('[TC-F18-SB-FILTER-02] filterNavSections with staff role + orders permission', () => {
	it('staff with orders permission sees Orders + Discounts, hides Products/Editor/Blog', () => {
		// Arrange, Act
		const result = filterNavSections(NAV_SECTIONS, {
			currentUserRole: 'staff',
			permissions: ['orders'],
			isSuperAdmin: false,
			isProduction: true,
		})

		// Assert — should have 4 sections (Dashboard, Core Operations, Settings, Support)
		// Online Store and CRM sections should be dropped
		const sections = result.map((s) => s.header?.en || 'Dashboard')
		expect(sections).toContain('Dashboard')
		expect(sections).toContain('Core Operations')
		expect(sections).toContain('Settings')
		expect(sections).toContain('Support')
		expect(sections).not.toContain('Online Store')
		expect(sections).not.toContain('CRM')

		// Core Operations should have Orders + Discounts (both use 'orders' permissionId)
		const coreOps = result.find((s) => s.header?.en === 'Core Operations')
		expect(coreOps?.items).toHaveLength(2)
		const itemHrefs = coreOps?.items.map((i) => i.href)
		expect(itemHrefs).toContain('/orders')
		expect(itemHrefs).toContain('/discounts')
		expect(itemHrefs).not.toContain('/products')
	})
})

// ── TC-F18-SB-FILTER-03: No Permissions (staff with empty array) ─────────────
describe('[TC-F18-SB-FILTER-03] filterNavSections with staff role + no permissions', () => {
	it('staff with no permissions hides permission-gated items but shows no-gate items', () => {
		// Arrange, Act
		const result = filterNavSections(NAV_SECTIONS, {
			currentUserRole: 'staff',
			permissions: [],
			isSuperAdmin: false,
			isProduction: true,
		})

		// Assert
		// Should have: Dashboard, Settings (Team & Account only), Support
		// Should NOT have: Online Store, Core Operations, CRM (all require permissions)
		const sections = result.map((s) => s.header?.en || 'Dashboard')
		expect(sections).toContain('Dashboard')
		expect(sections).toContain('Settings')
		expect(sections).toContain('Support')
		expect(sections).not.toContain('Online Store')
		expect(sections).not.toContain('Core Operations')
		expect(sections).not.toContain('CRM')

		// Settings section should only have Team & Account (the no-gate item)
		const settings = result.find((s) => s.header?.en === 'Settings')
		expect(settings?.items).toHaveLength(1)
		expect(settings?.items[0].href).toBe('/settings/staff')
	})
})

// ── TC-F18-SB-FILTER-04: SuperAdminOnly Flag ────────────────────────────────
describe('[TC-F18-SB-FILTER-04] filterNavSections respects superAdminOnly flag', () => {
	it('superAdminOnly item hidden when isSuperAdmin=false', () => {
		// Arrange — synthetic nav with superAdminOnly leaf
		const syntheticNav: NavSection[] = [
			{
				header: { en: 'Admin', ms: 'Admin' },
				items: [
					{
						label: { en: 'Audit Log', ms: 'Audit Log' },
						href: '/admin/audit',
						icon: null as any, // Not used in filter
						superAdminOnly: true,
					},
				],
			},
		]

		// Act
		const resultAsNonSuperAdmin = filterNavSections(syntheticNav, {
			currentUserRole: 'admin',
			isSuperAdmin: false,
		})

		// Assert — section should be dropped because its only item is hidden
		expect(resultAsNonSuperAdmin).toHaveLength(0)
	})

	it('superAdminOnly item visible when isSuperAdmin=true', () => {
		// Arrange
		const syntheticNav: NavSection[] = [
			{
				header: { en: 'Admin', ms: 'Admin' },
				items: [
					{
						label: { en: 'Audit Log', ms: 'Audit Log' },
						href: '/admin/audit',
						icon: null as any,
						superAdminOnly: true,
					},
				],
			},
		]

		// Act
		const resultAsSuperAdmin = filterNavSections(syntheticNav, {
			currentUserRole: 'admin',
			isSuperAdmin: true,
		})

		// Assert
		expect(resultAsSuperAdmin).toHaveLength(1)
		expect(resultAsSuperAdmin[0].items).toHaveLength(1)
		expect(resultAsSuperAdmin[0].items[0].href).toBe('/admin/audit')
	})
})

// ── TC-F18-SB-FILTER-05: DevOnly Flag ─────────────────────────────────────────
describe('[TC-F18-SB-FILTER-05] filterNavSections respects devOnly flag', () => {
	it('devOnly item hidden when isProduction=true', () => {
		// Arrange — synthetic nav with devOnly leaf
		const syntheticNav: NavSection[] = [
			{
				header: { en: 'Dev', ms: 'Dev' },
				items: [
					{
						label: { en: 'Debug Panel', ms: 'Debug Panel' },
						href: '/debug',
						icon: null as any,
						devOnly: true,
					},
				],
			},
		]

		// Act
		const resultOnProduction = filterNavSections(syntheticNav, {
			currentUserRole: 'admin',
			isProduction: true,
		})

		// Assert — section dropped because only item is hidden
		expect(resultOnProduction).toHaveLength(0)
	})

	it('devOnly item visible when isProduction=false', () => {
		// Arrange
		const syntheticNav: NavSection[] = [
			{
				header: { en: 'Dev', ms: 'Dev' },
				items: [
					{
						label: { en: 'Debug Panel', ms: 'Debug Panel' },
						href: '/debug',
						icon: null as any,
						devOnly: true,
					},
				],
			},
		]

		// Act
		const resultOnDev = filterNavSections(syntheticNav, {
			currentUserRole: 'admin',
			isProduction: false,
		})

		// Assert
		expect(resultOnDev).toHaveLength(1)
		expect(resultOnDev[0].items).toHaveLength(1)
		expect(resultOnDev[0].items[0].href).toBe('/debug')
	})
})

// ── TC-F18-SB-FILTER-06: Empty Section Drop (CRM visibility) ──────────────────
describe('[TC-F18-SB-FILTER-06] filterNavSections drops empty sections', () => {
	it('CRM section is completely hidden when staff has no relevant permissions', () => {
		// Arrange
		// CRM section has 2 items, both marked fullAccessOnly=true
		// So with role='staff' (not in full-access set), CRM header + items are filtered
		const result = filterNavSections(NAV_SECTIONS, {
			currentUserRole: 'staff',
			permissions: [],
			isSuperAdmin: false,
			isProduction: true,
		})

		// Act & Assert
		const hasCRM = result.some((s) => s.header?.en === 'CRM')
		expect(hasCRM).toBe(false)
	})

	it('Online Store section is completely hidden when staff has no builder/blog permission', () => {
		// Arrange
		// Online Store has Editor (permissionId: 'builder') + Blog (permissionId: 'blog')
		// Staff with only 'orders' permission should not see Online Store
		const result = filterNavSections(NAV_SECTIONS, {
			currentUserRole: 'staff',
			permissions: ['orders'],
			isSuperAdmin: false,
			isProduction: true,
		})

		// Act & Assert
		const hasOnlineStore = result.some((s) => s.header?.en === 'Online Store')
		expect(hasOnlineStore).toBe(false)
	})
})

// ── TC-F18-SB-FILTER-07: Default Values (currentUserRole='viewer' default) ────
describe('[TC-F18-SB-FILTER-07] filterNavSections applies correct defaults', () => {
	it('defaults to role=viewer (full-access) with no ctx provided', () => {
		// Arrange, Act
		const result = filterNavSections(NAV_SECTIONS, {})

		// Assert
		// viewer is in the full-access set, so all sections should be present
		expect(result).toHaveLength(6)
	})

	it('defaults to permissions=[], isSuperAdmin=false, isProduction=false', () => {
		// Arrange, Act
		const result = filterNavSections(NAV_SECTIONS, {
			currentUserRole: 'staff',
			// permissions, isSuperAdmin, isProduction all default
		})

		// Assert
		// Same as TC-F18-SB-FILTER-03, since defaults are empty/false
		const sections = result.map((s) => s.header?.en || 'Dashboard')
		expect(sections).not.toContain('CRM')
	})
})

// ── TC-F18-SB-FILTER-08: Full Access Roles (admin, editor, viewer) ──────────
describe('[TC-F18-SB-FILTER-08] filterNavSections treats admin/editor/viewer as full-access', () => {
	const fullAccessRoles = ['owner', 'admin', 'editor', 'viewer']

	fullAccessRoles.forEach((role) => {
		it(`role=${role} has full access to all sections`, () => {
			// Arrange, Act
			const result = filterNavSections(NAV_SECTIONS, {
				currentUserRole: role,
				permissions: [], // empty permissions should not matter
				isSuperAdmin: false,
				isProduction: true,
			})

			// Assert
			expect(result).toHaveLength(6)
			expect(result[3].items).toHaveLength(2) // CRM should be visible with all items
		})
	})
})

// ── TC-F18-SB-FILTER-09: Multi-Permission Staff ───────────────────────────────
describe('[TC-F18-SB-FILTER-09] filterNavSections respects multiple permissions', () => {
	it('staff with orders+products permissions sees both sections fully', () => {
		// Arrange, Act
		const result = filterNavSections(NAV_SECTIONS, {
			currentUserRole: 'staff',
			permissions: ['orders', 'products'],
			isSuperAdmin: false,
			isProduction: true,
		})

		// Assert
		const coreOps = result.find((s) => s.header?.en === 'Core Operations')
		expect(coreOps?.items).toHaveLength(3) // Orders, Products, Discounts (all use 'orders' or 'products')
		const hrefs = coreOps?.items.map((i) => i.href)
		expect(hrefs).toContain('/orders')
		expect(hrefs).toContain('/products')
		expect(hrefs).toContain('/discounts')
	})
})

// ── TC-F18-SB-FILTER-10: Badge Keys Preserved ────────────────────────────────
describe('[TC-F18-SB-FILTER-10] filterNavSections preserves badgeKey metadata', () => {
	it('owner sees all badge keys intact', () => {
		// Arrange, Act
		const result = filterNavSections(NAV_SECTIONS, {
			currentUserRole: 'owner',
			permissions: [],
			isSuperAdmin: false,
			isProduction: true,
		})

		// Assert
		const allItems = result.flatMap((s) => s.items)
		const badgeKeys = allItems
			.filter((i) => i.badgeKey)
			.map((i) => i.badgeKey)

		expect(badgeKeys).toContain('orders')
		expect(badgeKeys).toContain('products')
		expect(badgeKeys).toContain('discounts')
		expect(badgeKeys).toContain('customers')
		expect(badgeKeys).toContain('leads')
	})
})

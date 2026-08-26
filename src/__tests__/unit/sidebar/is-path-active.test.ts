import { describe, it, expect } from 'vitest'
import { isPathActive } from '@/lib/sidebar/is-path-active'

// ── TC-F18-SB-ACTIVE-01: Path Active Matching ───────────────────────────────
describe('[TC-F18-SB-ACTIVE-01] isPathActive', () => {
	// Table-driven test: exact match, nested, prefix mismatch, null/undefined
	const testCases = [
		{
			name: 'exact match /orders vs /orders',
			pathname: '/orders',
			href: '/orders',
			expected: true,
		},
		{
			name: 'nested match /orders/123 vs /orders',
			pathname: '/orders/123',
			href: '/orders',
			expected: true,
		},
		{
			name: 'deeply nested /orders/123/details vs /orders',
			pathname: '/orders/123/details',
			href: '/orders',
			expected: true,
		},
		{
			name: 'prefix mismatch /orders-archive vs /orders (no trailing slash)',
			pathname: '/orders-archive',
			href: '/orders',
			expected: false,
		},
		{
			name: 'different paths /products vs /orders',
			pathname: '/products',
			href: '/orders',
			expected: false,
		},
		{
			name: 'null pathname vs /orders',
			pathname: null,
			href: '/orders',
			expected: false,
		},
		{
			name: 'undefined pathname vs /orders',
			pathname: undefined,
			href: '/orders',
			expected: false,
		},
		{
			name: 'empty string pathname vs /orders',
			pathname: '',
			href: '/orders',
			expected: false,
		},
		{
			name: 'root pathname / vs /orders',
			pathname: '/',
			href: '/orders',
			expected: false,
		},
		{
			name: 'nested /settings/payments vs /settings',
			pathname: '/settings/payments',
			href: '/settings',
			expected: true,
		},
		{
			name: 'exact /settings vs /settings',
			pathname: '/settings',
			href: '/settings',
			expected: true,
		},
	]

	testCases.forEach(({ name, pathname, href, expected }) => {
		it(name, () => {
			// Arrange, Act
			const result = isPathActive(pathname as string | null | undefined, href)

			// Assert
			expect(result).toBe(expected)
		})
	})
})

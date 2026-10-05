/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        setupFiles: ['./src/__tests__/helpers/setup.ts'],
        // Most specs are plain logic (.ts) and never touch the DOM, yet running
        // them under jsdom pays a full window bootstrap per file — that made
        // the unit suite the slowest CI step. Component specs (.tsx) keep
        // jsdom; a .ts spec that does need the DOM opts in per file with a
        // `// @vitest-environment jsdom` docblock.
        projects: [
            {
                extends: true,
                test: {
                    name: 'node',
                    environment: 'node',
                    include: ['src/__tests__/**/*.{test,spec}.ts'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'dom',
                    environment: 'jsdom',
                    include: ['src/__tests__/**/*.{test,spec}.tsx'],
                },
            },
        ],
        exclude: ['node_modules', 'e2e'],
        coverage: {
            reporter: ['text', 'json', 'json-summary', 'html'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/**/*.d.ts',
                'src/payload.config.ts',
                'src/app/**/layout.tsx',
                'src/__tests__/**',
                // Auth pages — form delegation, tested via E2E
                'src/app/(auth)/**/page.tsx',
                // Frontend marketing pages — presentation only
                'src/app/(frontend)/**/page.tsx',
                // Builder/Editor pages — delegated to heavy components
                'src/app/(builder)/**/page.tsx',
                'src/app/(editor)/**/page.tsx',
                // Payload admin — third-party
                'src/app/(payload)/**/page.tsx',
                // Public storefront pages — customer-facing, E2E only
                'src/app/sites/**/page.tsx',
                // Test pages
                'src/app/test-blocks/**/page.tsx',
                // Dashboard pages — 'use client' UI composition with heavy deps
                // Business logic tested via API route + lib tests
                // UI interactions tested via E2E (Playwright)
                'src/app/(dashboard)/**/page.tsx',
                // Block render components — pure JSX, tested via visual regression
                'src/blocks/*/index.tsx',
                // Block shared visual components — no business logic
                'src/blocks/shared/**',
                'src/blocks/ErrorBoundary.tsx',
                // Static data files — no logic to test
                'src/lib/ai/seed-templates.ts',
                // One-time scripts
                'src/scripts/**',
                // Type-only files
                'src/types/**',
                // Edge runtime middleware — needs integration test
                'src/middleware.ts',
                // Preview renderers — HTML template generators, tested via E2E visual diff
                'src/app/api/preview/renderers/**',
                // Frontend presentation components — no business logic, E2E only
                'src/components/frontend/**',
                // Loading/error states — trivial skeleton components
                'src/app/**/loading.tsx',
                'src/app/**/error.tsx',
                // Instrumentation — Next.js internal hook
                'src/instrumentation.ts',
                // shadcn/ui base components — third-party, never modify
                'src/components/ui/**',
                // Type-only files (no runtime code)
                'src/lib/payment/types.ts',
                // Builder presentation components — visual only, tested via E2E
                'src/components/builder/BuilderPreviewPrimitives.tsx',
                'src/components/builder/BuilderGenerationView.tsx',
                'src/components/builder/onboarding/**',
                'src/components/builder/fields/**',
                // Site renderer — full page composition, tested via preview E2E
                'src/components/site-renderer/**',
                // Dashboard skeleton/empty states — trivial UI, no logic
                'src/components/dashboard/DashboardSkeleton.tsx',
                'src/components/dashboard/DashboardEmptyState.tsx',
                'src/components/dashboard/ProductsSkeleton.tsx',
                'src/components/dashboard/ProductsEmptyState.tsx',
                'src/components/dashboard/AnalyticsEmptyState.tsx',
                'src/components/dashboard/AnalyticsHeader.tsx',
                'src/components/dashboard/DashboardBanner.tsx',
                // Dashboard heavy UI — presentation + Payload deps, tested via E2E
                'src/components/dashboard/ProductQuickViewModal.tsx',
                'src/components/dashboard/product-form/**',
                'src/components/dashboard/DashboardSiteGrid.tsx',
                // Blog editor/management — heavy WYSIWYG, tested via E2E
                'src/app/(dashboard)/blog/_components/**',
                // Orders management — heavy data table + drawer, tested via E2E
                'src/app/(dashboard)/orders/_components/**',
                'src/app/(dashboard)/orders/components/**',
                // Products/categories server actions — Payload deps, tested via integration
                'src/app/(dashboard)/products/actions.ts',
                'src/app/(dashboard)/products/categories/**',
                // Dashboard actions — server-side Payload, tested via integration
                'src/app/(dashboard)/actions/**',
                // Storefront UI components — presentation, tested via E2E
                'src/components/storefront/**',
                // Storefront pages — public-facing, tested via E2E
                'src/app/sites/**',
                // Editor and AI components — heavy DOM/events, tested via E2E
                'src/components/editor/**',
                'src/components/ai/**',
                // Builder page client — heavy SSE + state, tested via E2E
                'src/app/(builder)/**/AIBuilderPageClient.tsx',
                // Preview route — HTML template composition, tested via E2E
                'src/app/api/preview/[siteId]/route.ts',
                // Onboarding client — form delegation, tested via E2E
                'src/app/(frontend)/onboarding/OnboardingClient.tsx',
                // Hooks requiring React render context — tested via component/E2E
                'src/hooks/**',
                // Studio admin UI — super-admin only, tested via E2E + manual QA
                'src/app/studio/**',
                // Admin API routes — super-admin gated, tested via integration + E2E
                'src/app/api/admin/**',
                // Preview SSR route — iframe preview, tested via E2E visual diff
                'src/app/(preview)/**',
                // Admin helpers — registry reader + loaders, tested via admin routes + E2E
                'src/lib/admin/**',
            ],
            thresholds: {
                // CI fails if coverage drops below these minimums
                // Current (2026-03-30): lines 64%, branches 73%, functions 64%
                // Target 15/04: lines 95%, branches 85%, functions 90%
                lines: 60,
                branches: 65,
                functions: 55,
                statements: 60,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@payload-config': path.resolve(__dirname, './src/payload.config.ts'),
            'server-only': path.resolve(__dirname, './src/__tests__/mocks/server-only.ts'),
            // Stub missing package in test env — LocaleFlag falls back to Globe icon when undefined
            'country-flag-icons/react/3x2': path.resolve(__dirname, './src/__tests__/helpers/mocks/country-flag-icons-react-3x2.ts'),
        },
    },
})

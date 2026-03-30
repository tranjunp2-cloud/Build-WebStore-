/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/__tests__/helpers/setup.ts'],
        include: ['src/__tests__/**/*.{test,spec}.{ts,tsx}'],
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
                // Storefront sitemap XML route — tested via E2E
                'src/app/sites/[slug]/sitemap.xml/**',
            ],
            thresholds: {
                // Current baseline (2026-03-28): lines 18.9, branches 66.5, functions 41.7, statements 18.9
                // CI fails if coverage drops below these minimums
                // Target 15/04: lines 60, branches 50, functions 50, statements 60
                lines: 45,
                branches: 50,
                functions: 45,
                statements: 45,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@payload-config': path.resolve(__dirname, './src/payload.config.ts'),
        },
    },
})

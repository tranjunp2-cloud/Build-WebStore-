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
                // SSR pages — tested via E2E (Playwright), not unit tests
                'src/app/**/page.tsx',
                // Block renderers — pure JSX, visual testing only
                'src/blocks/**',
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
            ],
            thresholds: {
                // Current baseline (2026-03-28): lines 18.9, branches 66.5, functions 41.7, statements 18.9
                // CI fails if coverage drops below these minimums
                // Target 15/04: lines 60, branches 50, functions 50, statements 60
                lines: 40,
                branches: 50,
                functions: 45,
                statements: 40,
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

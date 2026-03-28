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
            ],
            thresholds: {
                // Current baseline (2026-03-28): lines 18.9, branches 66.5, functions 41.7, statements 18.9
                // These thresholds prevent coverage from DROPPING — CI fails if PR reduces coverage
                // Post-release target Q3: lines 60, branches 70, functions 60, statements 60
                lines: 18,
                branches: 60,
                functions: 40,
                statements: 18,
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

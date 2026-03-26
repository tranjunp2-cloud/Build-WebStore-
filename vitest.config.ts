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
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/**/*.d.ts',
                'src/payload.config.ts',
                'src/app/**/layout.tsx',
                'src/__tests__/**',
            ],
            thresholds: {
                lines: 15,
                branches: 10,
                functions: 10,
                statements: 15,
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

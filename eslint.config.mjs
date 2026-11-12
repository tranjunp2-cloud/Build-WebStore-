import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
    ...nextCoreWebVitals,
    globalIgnores([
        '.next/**',
        'out/**',
        'coverage/**',
        'playwright-report/**',
        'test-results/**',
        'src/payload-types.ts',
        'next-env.d.ts',
    ]),
    {
        // React Compiler lint rules added in eslint-plugin-react-hooks v6+ (via eslint-config-next 16).
        // They flag many pre-existing issues; kept as warnings (as in the monorepo app) so CI stays
        // green — ratchet back to 'error' as the debt is paid down.
        rules: {
            'react-hooks/set-state-in-effect': 'warn',
            'react-hooks/refs': 'warn',
            'react-hooks/immutability': 'warn',
            'react-hooks/static-components': 'warn',
            'react-hooks/purity': 'warn',
            'react-hooks/error-boundaries': 'warn',
            'react-hooks/use-memo': 'warn',
            'react-hooks/preserve-manual-memoization': 'warn',
        },
    },
    {
        // Model SDKs stay in the AI platform: prime-web source calls platform tasks instead.
        files: ['src/**/*.ts', 'src/**/*.tsx'],
        ignores: ['src/__tests__/**'],
        rules: {
            'no-restricted-imports': ['error', {
                paths: [
                    { name: 'openai', message: 'Call an AI platform task instead (src/lib/ai-platform).' },
                    { name: 'ai', message: 'Call an AI platform task instead (src/lib/ai-platform).' },
                ],
                patterns: [
                    { group: ['openai/*', '@ai-sdk/*'], message: 'Call an AI platform task instead (src/lib/ai-platform).' },
                ],
            }],
        },
    },
])

/**
 * Unit Tests — editor block settings use the primary token, not hardcoded blue (GH-2115)
 * TC-GH2115-01, TC-GH2115-02, TC-GH2115-04
 * Convention: docs/TEST_CONVENTION.md | QA: docs/qa/F05-ai-editor-testcases.md (GH-2115)
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('@/blocks/registry', () => ({
    blockRegistry: {
        getBlockMeta: (type: string) => ({ name: type, icon: '🧩', variants: ['default'], type }),
    },
}))

import { SettingsPanel } from '@/components/editor/SettingsPanel'
import { I18nProvider } from '@/i18n'

function renderPanel(block: Record<string, unknown>) {
    return render(
        <I18nProvider defaultLocale="en">
            <SettingsPanel
                blockIndex={1}
                block={block}
                theme={{ primaryColor: '#0ea5e9', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' }}
                onThemeChange={vi.fn()} onDeleteBlock={vi.fn()} onDuplicateBlock={vi.fn()}
                onBlockFieldChange={vi.fn()} onBlockUpdate={vi.fn()}
            />
        </I18nProvider>,
    )
}

const SIDEBAR_FILES = [
    'src/components/editor/SettingsPanel.tsx',
    'src/components/editor/LogoCloudSettings.tsx',
    'src/components/editor/PortfolioGridSettings.tsx',
]

describe('Block settings sidebar colors (GH-2115)', () => {
    it.each(SIDEBAR_FILES)('[TC-GH2115-01] %s has no hardcoded blue-* class', (file) => {
        const source = readFileSync(join(process.cwd(), file), 'utf8')
        const hits = source.split('\n')
            .map((line, i) => ({ line: i + 1, text: line.trim() }))
            .filter(({ text }) => /\bblue-\d/.test(text))
        expect(hits).toEqual([])
    })

    it('[TC-GH2115-02] "+ Add" button uses the primary token and readable light-mode text', () => {
        renderPanel({ blockType: 'testimonials', variant: 'default', testimonials: [] })

        const add = screen.getByRole('button', { name: '+ Add testimonial' })
        expect(add.className).toContain('bg-[hsl(var(--primary)/0.1)]')
        expect(add.className).toContain('text-[var(--editor-text)]')
        expect(add.className).toContain('dark:text-[hsl(var(--primary))]')
        expect(add.className).not.toMatch(/\bblue-\d/)
    })

    it('[TC-GH2115-04] WhatsApp country dropdown marks the selected code with a primary tint, not only text color', () => {
        renderPanel({ blockType: 'whatsapp-button', variant: 'default', countryCode: '+60' })

        fireEvent.click(screen.getAllByRole('img', { name: 'Malaysia' })[0].closest('button')!)
        const selected = screen.getAllByRole('button').find(b => b.getAttribute('aria-current') === 'true')

        expect(selected).toBeDefined()
        expect(selected!.textContent).toContain('+60')
        expect(selected!.className).toContain('bg-[hsl(var(--primary)/0.1)]')
        expect(selected!.className).not.toMatch(/\bblue-\d/)
        // Hover keeps the primary tint instead of replacing it with the neutral row hover
        expect(selected!.className).toContain('hover:bg-[hsl(var(--primary)/0.15)]')
        expect(selected!.className).not.toContain('hover:bg-white/5')

        const other = screen.getAllByRole('img', { name: 'Vietnam' }).map(i => i.closest('button')!).find(b => !b.hasAttribute('aria-current'))
        expect(other).toBeDefined()
        expect(other!.className).toContain('hover:bg-white/5')
    })
})

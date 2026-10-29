/**
 * TC-AIREL-101 — the copilot's editor strings exist in both languages (same keys, none empty),
 * and the old editor AI paths are gone: nothing under the editor UI imports the retired
 * chat panel / inline rewrite popover / SEO overwrite dialog or calls the removed routes.
 * Real: the locale files and the editor sources. Faked: nothing.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

type Tree = Record<string, unknown>
const leaves = (value: unknown, path: string): string[] => {
    if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`))
    if (value && typeof value === 'object') return Object.entries(value as Tree).flatMap(([k, v]) => leaves(v, `${path}.${k}`))
    return [`${path}=${typeof value === 'string' && value.trim() ? 'text' : 'EMPTY'}`]
}
const editor = (locale: unknown) => (locale as { editor: Record<string, Tree> }).editor

const AGENT_AICHAT_KEYS = ['agentPageUpdated', 'agentPagesUpdated', 'agentPagesListUpdated', 'agentNavUpdated', 'agentPublished', 'agentThemeUpdated', 'agentEditsReplaced', 'agentSeoUpdated', 'agentTranslationUpdated', 'agentLocateMissing', 'localeAutoTranslated', 'undoTranslation', 'translationUndone']

describe('editor copilot strings [TC-AIREL-101]', () => {
    it('Ask AI box and change walker have the same keys in en and ms, none empty', () => {
        const a = leaves(editor(en).elementAsk, 'elementAsk')
        const b = leaves(editor(ms).elementAsk, 'elementAsk')
        expect(a.length).toBeGreaterThan(30)
        expect(b).toEqual(a)
        expect(a.some((x) => x.endsWith('=EMPTY'))).toBe(false)
        expect(Object.keys(editor(en).elementAsk.walker as Tree).sort()).toEqual(['changed', 'done', 'label', 'missing', 'next', 'prev'])
    })

    it.each(['en', 'ms'] as const)('%s has the copilot toasts, compact-bar and reload strings', (locale) => {
        const e = editor(locale === 'en' ? en : ms)
        for (const key of AGENT_AICHAT_KEYS) expect(typeof e.aiChat[key], `aiChat.${key}`).toBe('string')
        for (const key of ['publishNeedsFix', 'publishShowField', 'draftChanged', 'reloadAction']) expect(typeof e.toast[key], `toast.${key}`).toBe('string')
        for (const key of ['openTools', 'stopFailed', 'busy', 'stopAI', 'aiEditing']) expect(typeof e.compactLayout[key], `compactLayout.${key}`).toBe('string')
    })

    it('the translation toast keeps its {count} and {language} slots in both languages', () => {
        for (const locale of [en, ms]) {
            const text = editor(locale).aiChat.localeAutoTranslated as string
            expect(text).toContain('{count}')
            expect(text).toContain('{language}')
        }
    })
})

describe('retired editor AI paths [TC-AIREL-101]', () => {
    const root = join(process.cwd(), 'src')
    const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((name) => {
            const full = join(dir, name)
            return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : []
        })

    it('the old chat panel, inline rewrite and SEO overwrite files are deleted', () => {
        for (const file of ['AIChatPanel.tsx', 'InlineEdit.tsx', 'InlineEditPopover.tsx', 'SeoOverwriteConfirmDialog.tsx']) {
            expect(existsSync(join(root, 'components/editor', file)), file).toBe(false)
        }
    })

    it('no editor UI file imports them or calls the removed routes', () => {
        const files = [...walk(join(root, 'components')), ...walk(join(root, 'app/(editor)'))]
        const offenders = files.filter((file) =>
            /AIChatPanel|InlineEditPopover|SeoOverwriteConfirmDialog|\/api\/ai\/edit-block|\/generate-seo/.test(readFileSync(file, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '')),
        )
        expect(offenders.map((f) => f.slice(root.length))).toEqual([])
    })
})

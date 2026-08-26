import { describe, expect, it, vi } from 'vitest'
import type OpenAI from 'openai'
import { ensureBlockStrings } from '@/lib/ai/block-strings-translator'
import { getBlockStrings } from '@/lib/ai/block-i18n'

describe('dynamic block string translation validation', () => {
    it('retries when critical Spanish strings remain English', async () => {
        const locale = `es-translator-${Date.now()}`
        const create = vi.fn().mockImplementation(async (request: {
            messages: Array<{ content: string }>
        }) => {
            const prompt = request.messages[0]!.content
            const source = JSON.parse(prompt.slice(prompt.indexOf('{'))) as Record<string, string>

            if (create.mock.calls.length > 1) {
                source.nav_about = 'Acerca de'
                source.nav_get_started = 'Comenzar'
                source.footer_about_us = 'Sobre nosotros'
                source.blog_read_article = 'Leer artículo'
                source.blog_uncategorized = 'Sin categoría'
                source.blog_empty_state = 'Aún no hay artículos publicados.'
            }

            return {
                choices: [{
                    finish_reason: 'stop',
                    message: { content: JSON.stringify(source) },
                }],
            }
        })
        const openai = {
            chat: { completions: { create } },
        } as unknown as OpenAI

        const ready = await ensureBlockStrings('Spanish', locale, openai)

        expect(ready).toBe(true)
        expect(create).toHaveBeenCalledTimes(2)
        expect(create.mock.calls[0]?.[0]).toMatchObject({ model: 'gpt-4.1-mini' })
        expect(getBlockStrings(locale).navigation.about).toBe('Acerca de')
        expect(getBlockStrings(locale).blogList).toMatchObject({
            readArticleLabel: 'Leer artículo',
            uncategorizedLabel: 'Sin categoría',
        })
    })
})

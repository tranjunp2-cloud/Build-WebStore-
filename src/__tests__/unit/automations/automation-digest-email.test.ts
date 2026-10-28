/**
 * TC-AICP-241 — the digest email: subject counts the tasks, every task is listed with its own "fix" link carrying the
 * task kind (`?todo=`, no free text), shop and task texts are HTML-escaped, Bahasa Melayu for ms readers, unsubscribe pointer to the settings.
 */
import { describe, expect, it } from 'vitest'
import { buildDigestEmail, digestItemCount } from '@/lib/automations/automation-digest-email'
import { buildReminders } from '@/lib/automations/automation-reminders'
import { AUTOMATION_IDS } from '@/lib/automations/automation-config'
import { todoText } from '@/lib/insights/shop-todo-text'
import type { ShopTodoItem } from '@/lib/insights/shop-todo'

const item = (kind: ShopTodoItem['kind'], href: string, locale: 'en' | 'ms', count = 2, over: Partial<ShopTodoItem> = {}): ShopTodoItem =>
    ({ id: kind, kind, severity: 'high', count, href, ...todoText(kind, locale, { count, codes: ['RAYA10'] }), ...over })

describe('buildDigestEmail [TC-AICP-241]', () => {
    const items = (locale: 'en' | 'ms') => [item('out_of_stock', '/products', locale, 6), item('low_stock', '/products', locale, 3), item('payment_proofs', '/orders', locale)]
    const reminders = (locale: 'en' | 'ms') => buildReminders(items(locale), AUTOMATION_IDS, '2026-10-27')

    it('counts every task in the subject and lists each one with a fix link', () => {
        const mail = buildDigestEmail({ shopName: 'Kedai Demo', recipientName: 'Aisha', locale: 'en', reminders: reminders('en'), baseUrl: 'https://shop.test' })

        expect(digestItemCount(reminders('en'))).toBe(3)
        expect(mail.subject).toBe('3 things need your attention - Kedai Demo')
        expect(mail.html).toContain('Hi Aisha,')
        expect(mail.html).toContain('6 live products are out of stock')
        expect(mail.html).toContain('3 products are running low')
        const links = [...mail.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'))
        const asks = links.filter((l) => l.includes('todo='))
        expect(asks).toHaveLength(3)
        expect(new URL(asks[0]!).searchParams.get('todo')).toBe('out_of_stock')
        expect(links.some((l) => l.includes('ask='))).toBe(false)
        expect(links).toContain('https://shop.test/dashboard')
        expect(mail.html).toContain('Settings &gt; Email templates &gt; Automations')
    })

    it('says "thing" for one task', () => {
        const one = buildReminders([item('out_of_stock', '/products', 'en', 1)], AUTOMATION_IDS, '2026-10-27')

        expect(buildDigestEmail({ shopName: 'Kedai', locale: 'en', reminders: one, baseUrl: 'https://shop.test' }).subject).toBe('1 thing needs your attention - Kedai')
    })

    it('is written in Bahasa Melayu for ms readers', () => {
        const mail = buildDigestEmail({ shopName: 'Kedai Demo', locale: 'ms', reminders: reminders('ms'), baseUrl: 'https://shop.test' })

        expect(mail.subject).toBe('3 perkara memerlukan perhatian anda - Kedai Demo')
        expect(mail.html).toContain('lang="ms"')
        expect(mail.html).toContain('Hai pemilik kedai,')
        expect(mail.html).toContain('Selesaikan dengan pembantu')
    })

    it('escapes the shop name, the greeting name and the task texts', () => {
        const evil = buildReminders([item('out_of_stock', '/products', 'en', 1, { title: '<script>alert(1)</script>', detail: 'a "quote" & <b>bold</b>' })], AUTOMATION_IDS, '2026-10-27')

        const mail = buildDigestEmail({ shopName: '<img src=x onerror=1>\nShop', recipientName: '<b>Eve</b>', locale: 'en', reminders: evil, baseUrl: 'https://shop.test' })

        expect(mail.html).not.toContain('<script>')
        expect(mail.html).not.toContain('<img src=x')
        expect(mail.html).not.toContain('<b>Eve</b>')
        expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
        expect(mail.html).toContain('a &quot;quote&quot; &amp; &lt;b&gt;bold&lt;/b&gt;')
        expect(mail.subject).not.toMatch(/[\r\n]/)
    })
})

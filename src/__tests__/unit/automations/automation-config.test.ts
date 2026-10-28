/**
 * TC-AICP-226 — automation settings: defaults (in-app reminders on, email digest off), tolerant reading of the stored
 * json, strict form input that never touches the cron's markers.
 * TC-AICP-227 — the schedule in shop time (Asia/Kuala_Lumpur): weekly checks run on Mondays only, the digest goes out
 * once per day / on Mondays, and which To do tasks each automation owns.
 */
import { describe, expect, it } from 'vitest'
import {
    AUTOMATIONS,
    AUTOMATION_IDS,
    AutomationSettingsInputSchema,
    applySettingsInput,
    automationOfKind,
    automationsDue,
    defaultAutomationSettings,
    digestDue,
    isShopMonday,
    parseAutomationSettings,
    runsToday,
    shopDay,
} from '@/lib/automations/automation-config'

describe('automation settings [TC-AICP-226]', () => {
    it('defaults to every reminder on and the email digest off, daily', () => {
        const settings = defaultAutomationSettings()

        expect(AUTOMATION_IDS.every((id) => settings.enabled[id])).toBe(true)
        expect(settings.digest).toEqual({ enabled: false, frequency: 'daily' })
        expect(settings.lastRunDay).toBeNull()
        expect(settings.lastDigestDay).toBeNull()
    })

    it.each([null, undefined, 'x', 5, [], {}])('reads %j as the defaults', (raw) => {
        expect(parseAutomationSettings(raw)).toEqual(defaultAutomationSettings())
    })

    it('keeps what is valid, replaces what is not, and ignores unknown keys', () => {
        const parsed = parseAutomationSettings({
            enabled: { stock: false, leads: 'no', ghost: true },
            digest: { enabled: true, frequency: 'monthly' },
            lastRunDay: '2026-10-21',
            lastDigestDay: 'yesterday',
            evil: 1,
        })

        expect(parsed.enabled).toEqual({ discounts: true, stock: false, orders_waiting: true, leads: true, site_health: true })
        expect(parsed.digest).toEqual({ enabled: true, frequency: 'daily' })
        expect(parsed.lastRunDay).toBe('2026-10-21')
        expect(parsed.lastDigestDay).toBeNull()
        expect(parsed).not.toHaveProperty('evil')
    })

    const input = { enabled: { discounts: false, stock: true, orders_waiting: true, leads: false, site_health: true }, digest: { enabled: true, frequency: 'weekly' as const } }

    it('accepts the full form and applies it without touching the cron markers', () => {
        const current = { ...defaultAutomationSettings(), lastRunDay: '2026-10-21', lastDigestDay: '2026-10-19' }

        const next = applySettingsInput(current, AutomationSettingsInputSchema.parse(input))

        expect(next.enabled.discounts).toBe(false)
        expect(next.digest).toEqual({ enabled: true, frequency: 'weekly' })
        expect(next.lastRunDay).toBe('2026-10-21')
        expect(next.lastDigestDay).toBe('2026-10-19')
    })

    it.each([
        ['a missing switch', { ...input, enabled: { discounts: true } }],
        ['a non-boolean switch', { ...input, enabled: { ...input.enabled, stock: 'yes' } }],
        ['an unknown frequency', { ...input, digest: { enabled: true, frequency: 'hourly' } }],
        ['the cron markers', { ...input, lastRunDay: '2026-10-22' }],
        ['an unknown automation', { ...input, enabled: { ...input.enabled, ghost: true } }],
    ])('refuses %s', (_label, bad) => {
        expect(AutomationSettingsInputSchema.safeParse(bad).success).toBe(false)
    })
})

describe('schedule in shop time [TC-AICP-227]', () => {
    // 2026-10-26 is a Monday. 00:30 KL on Monday is still Sunday 16:30 UTC.
    const mondayKl = new Date('2026-10-25T16:30:00Z')
    const sundayKl = new Date('2026-10-25T15:30:00Z')
    const tuesday = new Date('2026-10-27T03:00:00Z')

    it('uses the Kuala Lumpur calendar day', () => {
        expect(shopDay(mondayKl)).toBe('2026-10-26')
        expect(shopDay(sundayKl)).toBe('2026-10-25')
        expect(isShopMonday(mondayKl)).toBe(true)
        expect(isShopMonday(sundayKl)).toBe(false)
        expect(isShopMonday(tuesday)).toBe(false)
    })

    it('runs the weekly website check on Mondays only and the others every day', () => {
        expect(runsToday('site_health', mondayKl)).toBe(true)
        expect(runsToday('site_health', tuesday)).toBe(false)
        expect(runsToday('stock', tuesday)).toBe(true)
        expect(automationsDue(defaultAutomationSettings(), tuesday)).toEqual(['discounts', 'stock', 'orders_waiting', 'leads'])
        expect(automationsDue(defaultAutomationSettings(), mondayKl)).toEqual([...AUTOMATION_IDS])
    })

    it('leaves out the automations the merchant switched off', () => {
        const settings = parseAutomationSettings({ enabled: { stock: false, discounts: false } })

        expect(automationsDue(settings, tuesday)).toEqual(['orders_waiting', 'leads'])
    })

    it('sends the digest only when on, once per shop day, and weekly ones on Mondays', () => {
        const on = (frequency: 'daily' | 'weekly', lastDigestDay: string | null = null) => ({ ...defaultAutomationSettings(), digest: { enabled: true, frequency }, lastDigestDay })

        expect(digestDue(defaultAutomationSettings(), tuesday)).toBe(false)
        expect(digestDue(on('daily'), tuesday)).toBe(true)
        expect(digestDue(on('daily', '2026-10-27'), tuesday)).toBe(false)
        expect(digestDue(on('weekly'), tuesday)).toBe(false)
        expect(digestDue(on('weekly'), mondayKl)).toBe(true)
        expect(digestDue(on('weekly', '2026-10-26'), mondayKl)).toBe(false)
    })

    it('gives every To do task of the automations to exactly one automation, and the rest to none', () => {
        const owned = AUTOMATION_IDS.flatMap((id) => AUTOMATIONS[id].kinds)

        expect(new Set(owned).size).toBe(owned.length)
        expect(automationOfKind('low_stock')).toBe('stock')
        expect(automationOfKind('payment_proofs')).toBe('orders_waiting')
        expect(automationOfKind('site_missing_seo')).toBe('site_health')
        expect(automationOfKind('products_missing_info')).toBeNull()
        expect(automationOfKind('products_ai_review')).toBeNull()
    })
})

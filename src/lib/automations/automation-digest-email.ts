/**
 * The digest email: one message that lists everything the automations found, each task with the same "Fix with
 * the assistant" link a notification carries. Built from the shared email parts; pure (no sending).
 */
import { buildCtaBlock, buildEmailDocumentClose, buildEmailDocumentOpen, buildEmailHeader } from '@/lib/email/templates/shared/email-html-parts'
import { type EmailLocale, escapeHtml } from '@/lib/email/templates/shared/email-utils'
import { type AutomationReminder, todoUrl } from './automation-reminders'

export interface DigestEmailInput {
    shopName: string
    recipientName?: string | null
    locale: EmailLocale
    reminders: AutomationReminder[]
    /** Absolute origin of the dashboard, without trailing slash */
    baseUrl: string
}

const TEXT = {
    en: {
        subject: (n: number, shop: string) => `${n} ${n === 1 ? 'thing needs' : 'things need'} your attention - ${shop}`,
        hello: (name: string) => `Hi ${name},`,
        intro: 'Here is what your shop needs from you today. Open any item to fix it together with the assistant.',
        fix: 'Fix with the assistant',
        open: 'Open the dashboard',
        settings: 'You get this email because the digest is on in Settings &gt; Email templates &gt; Automations. Turn it off there at any time.',
        farewell: 'Have a good day!',
    },
    ms: {
        subject: (n: number, shop: string) => `${n} perkara memerlukan perhatian anda - ${shop}`,
        hello: (name: string) => `Hai ${name},`,
        intro: 'Ini yang kedai anda perlukan daripada anda hari ini. Buka mana-mana item untuk menyelesaikannya bersama pembantu.',
        fix: 'Selesaikan dengan pembantu',
        open: 'Buka papan pemuka',
        settings: 'Anda menerima e-mel ini kerana ringkasan dihidupkan di Tetapan &gt; Templat E-mel &gt; Automasi. Matikan di sana pada bila-bila masa.',
        farewell: 'Semoga hari anda baik!',
    },
} as const

const FONT = `'Inter','Helvetica Neue',Helvetica,Arial,sans-serif`

export const digestItemCount = (reminders: AutomationReminder[]): number => reminders.reduce((sum, reminder) => sum + reminder.items.length, 0)

export function buildDigestEmail(input: DigestEmailInput): { subject: string; html: string } {
    const words = TEXT[input.locale === 'ms' ? 'ms' : 'en']
    const locale: EmailLocale = input.locale === 'ms' ? 'ms' : 'en'
    const shopName = input.shopName.replace(/\s+/g, ' ').trim() || 'Prime Web'
    const subject = words.subject(digestItemCount(input.reminders), shopName)
    const name = input.recipientName?.trim() || (locale === 'ms' ? 'pemilik kedai' : 'there')

    const rows = input.reminders
        .flatMap((reminder) => reminder.items.map((item) => ({ item, link: `${input.baseUrl}${todoUrl(item.href, item.kind)}` })))
        .map(({ item, link }) => `
      <tr><td style="padding:0 40px 10px;">
        <div style="border:1px solid #E5E7EB;border-radius:10px;padding:14px 16px;">
          <div style="font-family:${FONT};font-size:14px;font-weight:700;color:#0F172A;line-height:20px;">${escapeHtml(item.title)}</div>
          <div style="font-family:${FONT};font-size:13px;color:#475569;line-height:20px;margin-top:2px;">${escapeHtml(item.detail)}</div>
          <a href="${link.replace(/&/g, '&amp;')}" style="display:inline-block;margin-top:8px;font-family:${FONT};font-size:13px;font-weight:600;color:#0E7490;text-decoration:none;">${words.fix} &rarr;</a>
        </div>
      </td></tr>`)
        .join('')

    const html = `${buildEmailDocumentOpen(locale, escapeHtml(subject))}${buildEmailHeader(shopName)}
      <tr><td style="padding:18px 40px 6px;">
        <div style="font-family:${FONT};font-size:19px;font-weight:700;color:#0F172A;line-height:28px;">${escapeHtml(words.hello(name))}</div>
      </td></tr>
      <tr><td style="padding:6px 40px 16px;">
        <div style="font-family:${FONT};font-size:14px;line-height:22px;color:#475569;">${words.intro}</div>
      </td></tr>${rows}${buildCtaBlock(`${input.baseUrl}/dashboard`, words.open)}
      <tr><td align="center" style="padding:6px 40px 6px;">
        <div style="font-family:${FONT};font-size:16px;font-weight:700;color:#0F172A;">${words.farewell}</div>
      </td></tr>
      <tr><td align="center" style="padding:6px 40px 32px;">
        <div style="font-family:${FONT};font-size:12px;color:#94A3B8;line-height:18px;">${words.settings}</div>
      </td></tr>${buildEmailDocumentClose()}`

    return { subject, html }
}

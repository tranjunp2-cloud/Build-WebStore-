/**
 * New order notification email — seller.
 * Simple notification: shop name header, greeting, one-line body, single CTA.
 * Sent to tenant owners when a new order is placed (any payment method).
 */

import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import { mergeTemplateConfig } from '../merge-template-config'
import type { EmailTemplateConfig } from '../types'

type EmailLocale = 'en' | 'ms'

const locales = { en: en.email, ms: ms.email } as const

export interface NewOrderSellerData {
    shopName: string
    orderNumber: string
    customerName: string
    /** Dashboard/order URL seller is directed to */
    orderPageUrl: string
    locale?: EmailLocale
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
}

export function newOrderSellerEmail(data: NewOrderSellerData, config?: EmailTemplateConfig): { subject: string; html: string } {
    const locale = data.locale ?? 'ms'
    const newOrderBase = (locales[locale] ?? locales.ms).newOrder
    const vars = { orderNumber: data.orderNumber, orderTotal: '' }
    const tNew = mergeTemplateConfig(newOrderBase, config ?? null, vars, {
        ctaLabel: 'cta',
    })
    const esc = escapeHtml

    const subject = locale === 'ms'
        ? `Anda mempunyai pesanan baharu ${esc(data.orderNumber)}`
        : `You have a new order ${esc(data.orderNumber)}`

    const greeting = locale === 'ms'
        ? `Hai <strong>${esc(data.shopName)}</strong>,`
        : `Hi <strong>${esc(data.shopName)}</strong>,`

    const body = locale === 'ms'
        ? `Anda mempunyai pesanan baharu dari <strong>${esc(data.customerName)}</strong> dengan ID Pesanan <strong>${esc(data.orderNumber)}</strong>.`
        : `You have a new order from <strong>${esc(data.customerName)}</strong> with Order ID <strong>${esc(data.orderNumber)}</strong>.`

    return {
        subject,
        html: `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
<style>
  body{margin:0;background:#FFFFFF;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;word-wrap:break-word;}
  img{max-width:100%;height:auto;display:block;}
  .page-bg{background:#EEF3F8;padding:48px 16px;}
  @media(max-width:640px){
    .page-bg{padding:16px 10px;}
    .page-bg table[width="600"]{width:100%!important;max-width:100%!important;border-radius:12px!important;}
    .page-bg table[width="600"]>tbody>tr>td{padding-left:20px!important;padding-right:20px!important;}
  }
  @media(max-width:420px){
    .page-bg{padding:12px 6px;}
    .page-bg table[width="600"]>tbody>tr>td{padding-left:16px!important;padding-right:16px!important;}
  }
</style>
</head>
<body>
<div class="page-bg">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF3F8;">
    <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.04);">

      <!-- Shop name -->
      <tr><td style="padding:36px 40px 8px;text-align:center;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#0F172A;">${esc(data.shopName)}</div>
      </td></tr>

      <!-- Greeting -->
      <tr><td style="padding:18px 40px 6px;text-align:center;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:19px;font-weight:700;color:#0F172A;line-height:28px;">${greeting}</div>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:6px 40px 18px;text-align:center;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#475569;">${body}</div>
      </td></tr>

      <!-- CTA -->
      <tr><td align="center" style="padding:26px 40px 14px;">
        <a href="${data.orderPageUrl}" style="display:inline-block;background:#14C2BB;color:#FFFFFF;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;line-height:18px;padding:14px 28px;border-radius:8px;text-decoration:none;">${tNew.cta}</a>
      </td></tr>

      <!-- Spacer -->
      <tr><td style="padding:50px 40px 36px;"></td></tr>

    </table>
    </td></tr>
  </table>
</div>
</body>
</html>`.trim(),
    }
}

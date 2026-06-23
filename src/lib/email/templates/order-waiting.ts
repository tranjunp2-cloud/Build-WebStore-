/**
 * Order waiting payment email — buyer.
 * Sent when buyer lands on confirm page with payment still pending (Stripe/Xendit).
 * Layout mirrors bank-transfer-instructions but without bank/QR/reference sections.
 */

import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

type EmailLocale = 'en' | 'ms'

const locales = { en: en.email, ms: ms.email } as const

const strings = {
    en: {
        subject: 'Complete your payment — Order',
        body: "You placed an order but haven't completed payment yet. Your order is being held — complete your payment before time runs out.",
        alertTitle: 'Awaiting payment',
        alertTextDeadline: (d: string) => `Your order will be automatically cancelled if payment is not completed by ${d}.`,
        alertTextGeneric: 'Your order will be automatically cancelled if payment is not completed in time.',
        orderStatusAwaitingPayment: 'Awaiting Payment',
        ctaLabel: 'Complete Payment',
        ctaSubtitle: 'Button links to your secure order page.',
        paymentLabels: { card: 'Credit/Debit Card', fpx: 'FPX Online Banking', ewallet: 'E-Wallet' } as Record<string, string>,
    },
    ms: {
        subject: 'Selesaikan pembayaran anda — Pesanan',
        body: 'Anda telah membuat pesanan tetapi belum menyelesaikan pembayaran. Pesanan anda sedang ditahan — selesaikan pembayaran sebelum masa tamat.',
        alertTitle: 'Menunggu pembayaran',
        alertTextDeadline: (d: string) => `Pesanan anda akan dibatalkan jika pembayaran tidak diselesaikan sebelum ${d}.`,
        alertTextGeneric: 'Pesanan anda akan dibatalkan secara automatik jika pembayaran tidak diselesaikan.',
        orderStatusAwaitingPayment: 'Menunggu Pembayaran',
        ctaLabel: 'Selesaikan Pembayaran',
        ctaSubtitle: 'Butang menghubungkan ke halaman pesanan selamat anda.',
        paymentLabels: { card: 'Kad Kredit/Debit', fpx: 'Perbankan Dalam Talian FPX', ewallet: 'Dompet Elektronik' } as Record<string, string>,
    },
}

export interface OrderWaitingData {
    shopName: string
    orderNumber: string
    orderDate: string
    customerName: string
    customerEmail: string
    customerPhone?: string | null
    customerAddress?: {
        line1?: string
        line2?: string
        city?: string
        state?: string
        postcode?: string
        country?: string
    } | null
    items: Array<{
        name: string
        variant?: string | null
        quantity: number
        unitPrice: number
        lineTotal: number
    }>
    subtotal: number
    shippingFee: number
    discountAmount?: number | null
    discountCode?: string | null
    total: number
    currency: string
    paymentMethod: string
    buyerNote?: string | null
    payUrl: string
    paymentExpiresAt?: string | null
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

function formatPrice(amount: number, currency: string, locale: EmailLocale): string {
    if (currency === 'MYR') return locale === 'ms' ? `RM${amount.toFixed(2)}` : `MYR ${amount.toFixed(2)}`
    return `${currency} ${amount.toFixed(2)}`
}

function formatDate(iso: string, locale: EmailLocale): string {
    try {
        return new Date(iso).toLocaleString(locale === 'ms' ? 'en-MY' : 'en-GB', {
            weekday: 'long', year: 'numeric', month: 'long',
            day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
    } catch {
        return iso
    }
}

function buildAddress(addr: OrderWaitingData['customerAddress']): string {
    if (!addr) return '—'
    return [addr.line1, addr.line2, addr.city, addr.state, addr.postcode, addr.country]
        .filter(Boolean)
        .join(', ') || '—'
}

export function orderWaitingEmail(data: OrderWaitingData): { subject: string; html: string } {
    const locale: EmailLocale = data.locale ?? 'ms'
    const t = strings[locale]
    const tOrder = (locales[locale] ?? locales.ms).order
    const esc = escapeHtml
    const fp = (n: number) => formatPrice(n, data.currency, locale)

    const subject = `${data.shopName} - ${t.subject} ${data.orderNumber}`

    const itemRows = data.items.map((item) => `
        <tr>
            <td style="padding:14px 12px;border-top:1px solid #EDEFF2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:20px;color:#0F172A;vertical-align:top;">
                ${esc(item.name)}${item.variant ? `<br><span style="color:#94A3B8;font-size:12.5px;">${esc(item.variant)}</span>` : ''}
            </td>
            <td align="center" style="padding:14px 12px;border-top:1px solid #EDEFF2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;vertical-align:top;">${item.quantity}</td>
            <td align="right" style="padding:14px 12px;border-top:1px solid #EDEFF2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;vertical-align:top;">${fp(item.unitPrice)}</td>
            <td align="right" style="padding:14px 12px;border-top:1px solid #EDEFF2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;vertical-align:top;">${fp(item.lineTotal)}</td>
        </tr>`).join('')

    const discountRow = data.discountAmount
        ? `<tr>
            <td colspan="3" style="padding:6px 14px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;">
                ${tOrder.discount}${data.discountCode ? ` <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#F1F5F9;color:#475569;font-size:12px;margin-left:6px;">${esc(data.discountCode)}</span>` : ''}
            </td>
            <td align="right" style="padding:6px 14px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#EF4444;">-${fp(data.discountAmount)}</td>
        </tr>` : ''

    const paymentLabel = t.paymentLabels[data.paymentMethod] ?? esc(data.paymentMethod)
    const deadlineStr = data.paymentExpiresAt ? formatDate(data.paymentExpiresAt, locale) : null
    const alertText = deadlineStr ? t.alertTextDeadline(deadlineStr) : t.alertTextGeneric

    return {
        subject,
        html: `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title>
<style>
  body{margin:0;background:transparent;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;word-wrap:break-word;}
  img{max-width:100%;height:auto;display:block;}
  .page-bg{background:transparent;padding:0;}
  @media(max-width:640px){
    .page-bg{padding:0;}
    .page-bg table[width="600"]{width:100%!important;max-width:100%!important;border-radius:12px!important;}
    .page-bg table[width="600"]>tbody>tr>td{padding-left:20px!important;padding-right:20px!important;}
    .page-bg table[width="600"] table{width:100%!important;table-layout:auto;}
    .page-bg table[width="600"] thead th,.page-bg table[width="600"] tbody td{font-size:13px!important;}
  }
  @media(max-width:420px){
    .page-bg{padding:0;}
    .page-bg table[width="600"]>tbody>tr>td{padding-left:16px!important;padding-right:16px!important;}
  }
</style>
</head>
<body>
<div class="page-bg">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:transparent;">
    <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.04);">

      <!-- Shop name -->
      <tr><td style="padding:36px 40px 8px;text-align:center;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#0F172A;">${esc(data.shopName)}</div>
      </td></tr>

      <!-- Greeting -->
      <tr><td style="padding:18px 40px 6px;">
        <div style="font-size:19px;font-weight:700;color:#0F172A;line-height:28px;">${tOrder.greeting.replace('{customerName}', esc(data.customerName))}</div>
      </td></tr>
      <tr><td style="padding:6px 40px 18px;">
        <div style="font-size:14px;line-height:22px;color:#475569;">${t.body}</div>
      </td></tr>

      <!-- Recipient info -->
      <tr><td style="padding:18px 40px 10px;">
        <div style="font-size:15px;font-weight:700;color:#0F172A;letter-spacing:-0.01em;">${tOrder.recipientInfoHeading}</div>
      </td></tr>
      <tr><td style="padding:0 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:22px;">
          <tr>
            <td width="120" style="padding:6px 0;color:#0F172A;font-weight:500;vertical-align:top;">${tOrder.fullName}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;vertical-align:top;">${esc(data.customerName)}</td>
            <td width="80" style="padding:6px 0;color:#0F172A;font-weight:500;vertical-align:top;">${tOrder.address}</td>
            <td style="padding:6px 0;color:#94A3B8;vertical-align:top;line-height:22px;">${esc(buildAddress(data.customerAddress))}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#0F172A;font-weight:500;vertical-align:top;">${tOrder.phone}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;vertical-align:top;">${data.customerPhone ? esc(data.customerPhone) : '—'}</td>
            <td style="vertical-align:top;">&nbsp;</td>
            <td></td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#0F172A;font-weight:500;vertical-align:top;">${tOrder.email}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;vertical-align:top;">${esc(data.customerEmail)}</td>
            <td style="vertical-align:top;">&nbsp;</td>
            <td></td>
          </tr>
        </table>
      </td></tr>

      <!-- Order info header -->
      <tr><td style="padding:18px 40px 10px;">
        <div style="font-size:15px;font-weight:700;color:#0F172A;letter-spacing:-0.01em;">${tOrder.orderInfoHeading} — ID: ${esc(data.orderNumber)}</div>
      </td></tr>
      <tr><td style="padding:4px 40px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:22px;">
          <tr>
            <td width="120" style="padding:8px 0;color:#0F172A;font-weight:500;vertical-align:top;">${tOrder.orderStatus}</td>
            <td style="padding:8px 16px 8px 0;color:#F59E0B;vertical-align:top;font-weight:600;">${t.orderStatusAwaitingPayment}</td>
            <td width="120" style="padding:8px 0;color:#0F172A;font-weight:500;vertical-align:top;">${tOrder.orderDate}</td>
            <td style="padding:8px 16px 8px 0;color:#0F172A;vertical-align:top;font-weight:600;">${formatDate(data.orderDate, locale)}</td>
          </tr>
        </table>
      </td></tr>

      <!-- Product table -->
      <tr><td style="padding:8px 40px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:10px;border-collapse:separate;overflow:hidden;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th align="left" style="padding:12px;font-size:13px;font-weight:600;color:#0F172A;">${tOrder.productName}</th>
              <th align="center" width="50" style="padding:12px;font-size:13px;font-weight:600;color:#0F172A;">${tOrder.quantity}</th>
              <th align="right" width="100" style="padding:12px;font-size:13px;font-weight:600;color:#0F172A;">${tOrder.unitCost}</th>
              <th align="right" width="100" style="padding:12px;font-size:13px;font-weight:600;color:#0F172A;">${tOrder.amount}</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
            <tr><td colspan="4" style="padding:0;border-top:1px solid #EDEFF2;"></td></tr>
            <tr>
              <td colspan="3" style="padding:12px 14px 6px;font-size:13.5px;color:#0F172A;">${tOrder.subtotal}</td>
              <td align="right" style="padding:12px 14px 6px;font-size:13.5px;color:#0F172A;">${fp(data.subtotal)}</td>
            </tr>
            ${discountRow}
            <tr>
              <td colspan="3" style="padding:6px 14px;font-size:13.5px;color:#0F172A;">${tOrder.shippingFee}</td>
              <td align="right" style="padding:6px 14px;font-size:13.5px;color:#0F172A;">${fp(data.shippingFee)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:6px 14px 14px;font-size:14px;font-weight:700;color:#0F172A;">${tOrder.total ?? 'Total'}</td>
              <td align="right" style="padding:6px 14px 14px;font-size:14px;font-weight:700;color:#0F172A;">${fp(data.total)}</td>
            </tr>
          </tbody>
        </table>
      </td></tr>

      <!-- Payment method + buyer note -->
      <tr><td style="padding:14px 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:22px;">
          <tr>
            <td width="170" style="padding:6px 0;color:#0F172A;font-weight:500;">${tOrder.paymentMethod}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;">${paymentLabel}</td>
            <td width="170" style="padding:6px 0;color:#0F172A;font-weight:500;">${tOrder.buyerNote}</td>
            <td align="right" style="padding:6px 0;color:#94A3B8;">${data.buyerNote ? esc(data.buyerNote) : '—'}</td>
          </tr>
        </table>
      </td></tr>

      <!-- Amber alert: awaiting payment -->
      <tr><td style="padding:18px 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;">
          <tr>
            <td width="48" style="padding:16px 0 16px 16px;vertical-align:top;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:36px;height:36px;background:#FEF3C7;border-radius:50%;text-align:center;vertical-align:middle;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              </td></tr></table>
            </td>
            <td style="padding:14px 16px 14px 12px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;">
              <div style="font-size:14px;font-weight:700;color:#92400E;line-height:20px;margin-bottom:4px;">${t.alertTitle}</div>
              <div style="font-size:13.5px;line-height:20px;color:#78350F;">${alertText}</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- CTA -->
      <tr><td align="center" style="padding:26px 40px 8px;">
        <a href="${esc(data.payUrl)}" style="display:inline-block;background:#14C2BB;color:#FFFFFF;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;line-height:18px;padding:14px 32px;border-radius:8px;text-decoration:none;">${t.ctaLabel}</a>
      </td></tr>
      <tr><td align="center" style="padding:0 40px 6px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12.5px;line-height:18px;color:#94A3B8;">${t.ctaSubtitle}</div>
      </td></tr>

      <!-- Farewell -->
      <tr><td align="center" style="padding:18px 40px 6px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#0F172A;">${tOrder.farewell}</div>
      </td></tr>

      <!-- Footer -->
      <tr><td align="center" style="padding:6px 40px 36px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#94A3B8;">${tOrder.copyright} ${esc(data.shopName)}</div>
      </td></tr>

    </table>
    </td></tr>
  </table>
</div>
</body>
</html>`.trim(),
    }
}

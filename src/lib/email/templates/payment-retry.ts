/**
 * Payment retry email — buyer.
 * Sent when a Stripe payment_intent.payment_failed webhook fires.
 * Buyer is prompted to retry payment within 24h via magic-link.
 */

type EmailLocale = 'en' | 'ms'

const strings = {
    en: {
        subject: 'Complete your payment — Order',
        greeting: 'Hi',
        body: 'Your payment was declined. Your order is being held for 24 hours — complete your payment before time runs out.',
        alertTitle: 'Payment declined',
        alertText: 'Your order will be automatically cancelled if payment is not completed within 24 hours.',
        orderLabel: 'Order',
        totalLabel: 'Order Total',
        ctaLabel: 'Pay Now',
        ctaSubtitle: 'Button links to your secure order page. Valid for 24 hours.',
        farewell: 'Thank you',
        copyright: '© ',
    },
    ms: {
        subject: 'Selesaikan pembayaran anda — Pesanan',
        greeting: 'Hai',
        body: 'Pembayaran anda telah ditolak. Pesanan anda akan disimpan selama 24 jam — selesaikan pembayaran sebelum masa tamat.',
        alertTitle: 'Pembayaran ditolak',
        alertText: 'Pesanan anda akan dibatalkan secara automatik jika pembayaran tidak diselesaikan dalam masa 24 jam.',
        orderLabel: 'Pesanan',
        totalLabel: 'Jumlah Pesanan',
        ctaLabel: 'Bayar Sekarang',
        ctaSubtitle: 'Butang menghubungkan ke halaman pesanan selamat anda. Sah selama 24 jam.',
        farewell: 'Terima kasih',
        copyright: '© ',
    },
} as const

export interface PaymentRetryData {
    shopName: string
    orderNumber: string
    customerName: string
    total: number
    currency: string
    payUrl: string
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

export function paymentRetryEmail(data: PaymentRetryData): { subject: string; html: string } {
    const locale: EmailLocale = data.locale ?? 'ms'
    const t = strings[locale]
    const esc = escapeHtml
    const fp = (n: number) => formatPrice(n, data.currency, locale)

    const subject = `${data.shopName} - ${t.subject} ${data.orderNumber}`
    const htmlTitle = `${esc(data.shopName)} - ${t.subject} ${esc(data.orderNumber)}`

    return {
        subject,
        html: `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${htmlTitle}</title>
<style>
  body{margin:0;background:transparent;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;word-wrap:break-word;}
  img{max-width:100%;height:auto;display:block;}
  .page-bg{background:transparent;padding:0;}
  @media(max-width:640px){
    .page-bg table[width="600"]{width:100%!important;max-width:100%!important;border-radius:12px!important;}
    .page-bg table[width="600"]>tbody>tr>td{padding-left:20px!important;padding-right:20px!important;}
  }
  @media(max-width:420px){
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
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:19px;font-weight:700;color:#0F172A;line-height:28px;">${t.greeting}, ${esc(data.customerName)},</div>
      </td></tr>
      <tr><td style="padding:6px 40px 18px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#475569;">${t.body}</div>
      </td></tr>

      <!-- Red alert: payment declined -->
      <tr><td style="padding:6px 40px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;">
          <tr>
            <td width="48" style="padding:16px 0 16px 16px;vertical-align:top;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:36px;height:36px;background:#FEE2E2;border-radius:50%;text-align:center;vertical-align:middle;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              </td></tr></table>
            </td>
            <td style="padding:14px 16px 14px 12px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;">
              <div style="font-size:14px;font-weight:700;color:#991B1B;line-height:20px;margin-bottom:4px;">${t.alertTitle}</div>
              <div style="font-size:13.5px;line-height:20px;color:#7F1D1D;">${t.alertText}</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Order summary -->
      <tr><td style="padding:18px 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;">
          <tr>
            <td style="padding:6px 0;color:#0F172A;font-weight:500;width:140px;">${t.orderLabel}</td>
            <td style="padding:6px 0;color:#475569;font-weight:600;">${esc(data.orderNumber)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#0F172A;font-weight:500;">${t.totalLabel}</td>
            <td style="padding:6px 0;color:#0F172A;font-weight:700;">${fp(data.total)}</td>
          </tr>
        </table>
      </td></tr>

      <!-- CTA -->
      <tr><td align="center" style="padding:26px 40px 8px;">
        <a href="${data.payUrl}" style="display:inline-block;background:#14C2BB;color:#FFFFFF;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;line-height:18px;padding:14px 32px;border-radius:8px;text-decoration:none;">${t.ctaLabel}</a>
      </td></tr>
      <tr><td align="center" style="padding:0 40px 6px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12.5px;line-height:18px;color:#94A3B8;">${t.ctaSubtitle}</div>
      </td></tr>

      <!-- Farewell -->
      <tr><td align="center" style="padding:18px 40px 6px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#0F172A;">${t.farewell}</div>
      </td></tr>

      <!-- Footer -->
      <tr><td align="center" style="padding:6px 40px 36px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#94A3B8;">${t.copyright}${esc(data.shopName)}</div>
      </td></tr>

    </table>
    </td></tr>
  </table>
</div>
</body>
</html>`.trim(),
    }
}

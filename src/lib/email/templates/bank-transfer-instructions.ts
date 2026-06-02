/**
 * Bank Transfer instructions email — buyer.
 * Same layout as order-confirmation-buyer but with BT-specific sections:
 * bank details, QR code, payment reference, 24h deadline warning.
 *
 * Related: TC-F10-06-07, TC-F10-06-15, PRD FR-15, FR-16
 */

import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import { mergeTemplateConfig, applyVariables } from '../merge-template-config'
import type { EmailTemplateConfig } from '../types'

type EmailLocale = 'en' | 'ms'

const locales = { en: en.email, ms: ms.email } as const

export interface BankTransferInstructionsData {
    shopName: string
    orderNumber: string
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
    discountAmount?: number | null
    discountCode?: string | null
    shippingFee: number
    total: number
    currency: string
    buyerNote?: string | null
    orderDate: string
    /** BT-XXXXXX format — stored in DB; email now shows orderNumber as reference instead */
    paymentReference: string
    /** Signed JWT URL for post-order upload page */
    magicLinkUrl: string
    /** Plaintext fallback URL (no token) */
    plainUploadUrl: string
    /** ISO date string for payment deadline */
    expiresAtIso: string
    bankName: string | null
    bankAccountNo: string | null
    bankAccountHolder: string | null
    merchantQrUrl?: string | null
    supportEmail?: string
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

function formatDeadline(iso: string): string {
    try {
        return new Date(iso).toLocaleString('en-MY', {
            weekday: 'long', year: 'numeric', month: 'long',
            day: 'numeric', hour: '2-digit', minute: '2-digit',
            timeZoneName: 'short',
        })
    } catch {
        return iso
    }
}

function buildAddress(addr: BankTransferInstructionsData['customerAddress']): string {
    if (!addr) return '—'
    return [addr.line1, addr.line2, addr.city, addr.state, addr.postcode, addr.country]
        .filter(Boolean)
        .join(', ')
}

export function bankTransferInstructionsEmail(
    data: BankTransferInstructionsData,
    config?: EmailTemplateConfig,
): { subject: string; html: string } {
    const locale = data.locale ?? 'ms'
    const orderBase = (locales[locale] ?? locales.ms).order
    const btBase = (locales[locale] ?? locales.ms).bankTransfer
    const vars = {
        customerName: data.customerName,
        orderNumber: data.orderNumber,
        orderTotal: data.total.toFixed(2),
        bankName: data.bankName ?? '',
        bankAccountNo: data.bankAccountNo ?? '',
        bankAccountHolder: data.bankAccountHolder ?? '',
        brandName: data.shopName,
        supportEmail: data.supportEmail ?? '',
    }
    const tOrder = mergeTemplateConfig(orderBase, config ?? null, vars, {
        greeting: 'greeting',
        closing: 'farewell',
    })
    const tBT = mergeTemplateConfig(btBase, config ?? null, vars, {
        ctaLabel: 'uploadCta',
    })

    const fp = (n: number) => formatPrice(n, data.currency, locale)
    const esc = escapeHtml

    const subject = locale === 'ms'
        ? `${esc(data.shopName)} - Lengkapkan pembayaran anda - ${esc(data.orderNumber)}`
        : `${esc(data.shopName)} - Complete your payment - ${esc(data.orderNumber)}`

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

    const hasBankDetails = data.bankName || data.bankAccountNo || data.bankAccountHolder
    const bankDetailsHtml = hasBankDetails ? `
      <!-- Bank details -->
      <tr><td style="padding:18px 40px 10px;">
        <div style="font-size:15px;font-weight:700;color:#0F172A;letter-spacing:-0.01em;">${tBT.bankDetailsHeading}</div>
      </td></tr>
      <tr><td style="padding:0 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:22px;background:#F8FAFC;border-radius:10px;padding:16px;">
          ${data.bankName ? `<tr><td width="140" style="padding:6px 16px;color:#0F172A;font-weight:500;">${tBT.bank}</td><td style="padding:6px 16px 6px 0;color:#475569;font-weight:600;">${esc(data.bankName)}</td></tr>` : ''}
          ${data.bankAccountNo ? `<tr><td style="padding:6px 16px;color:#0F172A;font-weight:500;">${tBT.accountNo}</td><td style="padding:6px 16px 6px 0;color:#475569;font-weight:600;font-family:'Courier New',Courier,monospace;">${esc(data.bankAccountNo)}</td></tr>` : ''}
          ${data.bankAccountHolder ? `<tr><td style="padding:6px 16px;color:#0F172A;font-weight:500;">${tBT.accountName}</td><td style="padding:6px 16px 6px 0;color:#475569;font-weight:600;">${esc(data.bankAccountHolder)}</td></tr>` : ''}
        </table>
      </td></tr>` : ''

    const qrHtml = data.merchantQrUrl ? `
      <!-- QR Code -->
      <tr><td align="center" style="padding:14px 40px;">
        <div style="font-size:13px;text-transform:uppercase;color:#94A3B8;font-weight:600;letter-spacing:0.05em;margin-bottom:12px;">${tBT.scanToPay}</div>
        <img src="${esc(data.merchantQrUrl)}" alt="Payment QR Code" style="max-width:180px;border-radius:10px;border:1px solid #E5E7EB;" />
      </td></tr>` : ''

    return {
        subject,
        html: `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
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
        <div style="font-size:19px;font-weight:700;color:#0F172A;line-height:28px;">${tOrder.greeting},</div>
      </td></tr>
      <tr><td style="padding:6px 40px 18px;">
        <div style="font-size:14px;line-height:22px;color:#475569;">${tBT.body}</div>
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
            <td width="120" style="padding:8px 0;color:#0F172A;font-weight:500;vertical-align:top;">${tBT.orderStatusLabel}</td>
            <td style="padding:8px 16px 8px 0;color:#F59E0B;vertical-align:top;font-weight:600;">${tBT.orderStatusAwaitingPayment}</td>
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
              <td colspan="3" style="padding:6px 14px 14px;font-size:14px;font-weight:700;color:#0F172A;">${tOrder.total}</td>
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
            <td style="padding:6px 14px 6px 0;color:#94A3B8;">${locale === 'ms' ? 'Pindahan Bank' : 'Bank Transfer'}</td>
            <td width="170" style="padding:6px 0;color:#0F172A;font-weight:500;">${tOrder.buyerNote}</td>
            <td align="right" style="padding:6px 0;color:#94A3B8;">${data.buyerNote ? esc(data.buyerNote) : '—'}</td>
          </tr>
        </table>
      </td></tr>

      ${bankDetailsHtml}
      ${qrHtml}

      <!-- Payment reference box -->
      <tr><td style="padding:14px 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FEFCE8;border:2px solid #EAB308;border-radius:10px;text-align:center;">
          <tr><td style="padding:20px 24px;">
            <div style="font-size:12px;text-transform:uppercase;color:#92400E;font-weight:700;letter-spacing:0.08em;margin-bottom:10px;">${tBT.referenceHeading}</div>
            <div style="font-size:26px;font-weight:800;font-family:'Courier New',Courier,monospace;letter-spacing:3px;color:#78350F;margin-bottom:10px;">${esc(data.orderNumber)}</div>
            <div style="font-size:13px;color:#92400E;">${tBT.referenceInstruction}</div>
          </td></tr>
        </table>
      </td></tr>

      <!-- Payment deadline -->
      <tr><td style="padding:6px 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF7ED;border-radius:8px;border-left:4px solid #F97316;">
          <tr><td style="padding:14px 16px;">
            <div style="font-size:13px;color:#9A3412;"><strong>${tBT.deadlineLabel}:</strong> ${formatDeadline(data.expiresAtIso)}</div>
            <div style="font-size:12px;color:#C2410C;margin-top:6px;">${tBT.autoCancel}</div>
          </td></tr>
        </table>
      </td></tr>

      <!-- Security reminder -->
      <tr><td style="padding:6px 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F1F5F9;border-radius:8px;">
          <tr><td style="padding:12px 16px;">
            <div style="font-size:12px;color:#64748B;">${tBT.securityReminder}</div>
          </td></tr>
        </table>
      </td></tr>

      <!-- CTA: Upload receipt -->
      <tr><td align="center" style="padding:26px 40px 8px;">
        <a href="${data.magicLinkUrl}" style="display:inline-block;background:#14C2BB;color:#FFFFFF;font-size:14px;font-weight:700;line-height:18px;padding:14px 28px;border-radius:8px;text-decoration:none;">${tBT.uploadCta}</a>
      </td></tr>

      <!-- Plaintext fallback -->
      <tr><td align="center" style="padding:4px 40px 14px;">
        <div style="font-size:12px;color:#94A3B8;">${tBT.fallbackLink} <span style="color:#14C2BB;word-break:break-all;">${data.plainUploadUrl}</span></div>
      </td></tr>

      <!-- Farewell -->
      <tr><td align="center" style="padding:10px 40px 6px;">
        <div style="font-size:16px;font-weight:700;color:#0F172A;">${tOrder.farewell}</div>
      </td></tr>

      <!-- Footer -->
      <tr><td align="center" style="padding:6px 40px 36px;">
        <div style="font-size:12px;color:#94A3B8;">${tOrder.copyright} ${esc(data.shopName)}</div>
      </td></tr>

    </table>
    </td></tr>
  </table>
</div>
</body>
</html>`.trim(),
    }
}

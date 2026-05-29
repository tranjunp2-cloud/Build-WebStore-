/**
 * HTML section builder functions for order email templates.
 * Pure refactoring — no behavior changes from the original per-template implementations.
 * Types and pure utilities live in email-utils.ts.
 */

import {
    type EmailLocale,
    type AddressShape,
    type OrderItemRow,
    escapeHtml,
    formatPrice,
    buildAddressString,
} from './email-utils'

// ── Document shell ────────────────────────────────────────────────────────────

/** Returns opening HTML including <head>, <style>, and the outer/inner card table open tags. */
export function buildEmailDocumentOpen(locale: EmailLocale, title: string): string {
    return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;background:#FFFFFF;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;word-wrap:break-word;}
  img{max-width:100%;height:auto;display:block;}
  .page-bg{background:#EEF3F8;padding:48px 16px;}
  @media(max-width:640px){
    .page-bg{padding:16px 10px;}
    .page-bg table[width="600"]{width:100%!important;max-width:100%!important;border-radius:12px!important;}
    .page-bg table[width="600"]>tbody>tr>td{padding-left:20px!important;padding-right:20px!important;}
    .page-bg table[width="600"] table{width:100%!important;table-layout:auto;}
    .page-bg table[width="600"] thead th,.page-bg table[width="600"] tbody td{font-size:13px!important;}
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
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.04);">`
}

/** Closing tags that pair with buildEmailDocumentOpen. */
export function buildEmailDocumentClose(): string {
    return `
    </table>
    </td></tr>
  </table>
</div>
</body>
</html>`
}

// ── Section builders ──────────────────────────────────────────────────────────

export function buildEmailHeader(shopName: string): string {
    return `
      <!-- Shop name -->
      <tr><td style="padding:36px 40px 8px;text-align:center;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#0F172A;">${escapeHtml(shopName)}</div>
      </td></tr>`
}

export function buildGreetingBlock(greeting: string, customerName: string, bodyText: string): string {
    return `
      <!-- Greeting -->
      <tr><td style="padding:18px 40px 6px;">
        <div style="font-size:19px;font-weight:700;color:#0F172A;line-height:28px;">${greeting} ${escapeHtml(customerName)},</div>
      </td></tr>
      <tr><td style="padding:6px 40px 18px;">
        <div style="font-size:14px;line-height:22px;color:#475569;">${bodyText}</div>
      </td></tr>`
}

export function buildRecipientInfoBlock(
    customerName: string,
    customerEmail: string,
    customerPhone: string | null | undefined,
    addr: AddressShape | null | undefined,
    labels: { recipientInfoHeading: string; fullName: string; address: string; phone: string; email: string },
): string {
    const esc = escapeHtml
    return `
      <!-- Recipient info -->
      <tr><td style="padding:18px 40px 10px;">
        <div style="font-size:15px;font-weight:700;color:#0F172A;letter-spacing:-0.01em;">${labels.recipientInfoHeading}</div>
      </td></tr>
      <tr><td style="padding:0 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:22px;">
          <tr>
            <td width="120" style="padding:6px 0;color:#0F172A;font-weight:500;vertical-align:top;">${labels.fullName}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;vertical-align:top;">${esc(customerName)}</td>
            <td width="80" style="padding:6px 0;color:#0F172A;font-weight:500;vertical-align:top;">${labels.address}</td>
            <td style="padding:6px 0;color:#94A3B8;vertical-align:top;line-height:22px;">${esc(buildAddressString(addr))}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#0F172A;font-weight:500;vertical-align:top;">${labels.phone}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;vertical-align:top;">${customerPhone ? esc(customerPhone) : '—'}</td>
            <td style="vertical-align:top;">&nbsp;</td>
            <td></td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#0F172A;font-weight:500;vertical-align:top;">${labels.email}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;vertical-align:top;">${esc(customerEmail)}</td>
            <td style="vertical-align:top;">&nbsp;</td>
            <td></td>
          </tr>
        </table>
      </td></tr>`
}

export interface OrderTableOpts {
    subtotal: number
    discountAmount?: number | null
    discountCode?: string | null
    shippingFee: number
    total: number
    prepaid: number
    cod: number
    labels: {
        productName: string
        quantity: string
        unitCost: string
        amount: string
        subtotal: string
        discount: string
        shippingFee: string
        total: string
        prepaid: string
        codPayment: string
    }
}

export function buildOrderItemsTable(
    items: OrderItemRow[],
    currency: string,
    locale: EmailLocale,
    opts: OrderTableOpts,
): string {
    const fp = (n: number) => formatPrice(n, currency, locale)
    const esc = escapeHtml
    const { labels } = opts

    const itemRows = items.map((item) => `
        <tr>
            <td style="padding:14px 12px;border-top:1px solid #EDEFF2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;line-height:20px;color:#0F172A;vertical-align:top;">
                ${esc(item.name)}${item.variant ? `<br><span style="color:#94A3B8;font-size:12.5px;">${esc(item.variant)}</span>` : ''}
            </td>
            <td align="center" style="padding:14px 12px;border-top:1px solid #EDEFF2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;vertical-align:top;">${item.quantity}</td>
            <td align="right" style="padding:14px 12px;border-top:1px solid #EDEFF2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;vertical-align:top;white-space:nowrap;">${fp(item.unitPrice)}</td>
            <td align="right" style="padding:14px 12px;border-top:1px solid #EDEFF2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;vertical-align:top;white-space:nowrap;">${fp(item.lineTotal)}</td>
        </tr>`).join('')

    const discountRow = opts.discountAmount
        ? `<tr>
            <td colspan="3" style="padding:6px 14px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#0F172A;">
                ${labels.discount}${opts.discountCode ? ` <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#F1F5F9;color:#475569;font-size:12px;margin-left:6px;">${esc(opts.discountCode)}</span>` : ''}
            </td>
            <td align="right" style="padding:6px 14px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13.5px;color:#EF4444;white-space:nowrap;">-${fp(opts.discountAmount)}</td>
        </tr>` : ''

    return `
      <!-- Product table -->
      <tr><td style="padding:8px 40px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E5E7EB;border-radius:10px;border-collapse:separate;overflow:hidden;">
          <thead>
            <tr style="background:#F3F4F6;">
              <th align="left" style="padding:12px;font-size:13px;font-weight:600;color:#0F172A;">${labels.productName}</th>
              <th align="center" width="70" style="padding:12px;font-size:13px;font-weight:600;color:#0F172A;">${labels.quantity}</th>
              <th align="right" width="90" style="padding:12px;font-size:13px;font-weight:600;color:#0F172A;white-space:nowrap;">${labels.unitCost}</th>
              <th align="right" width="100" style="padding:12px;font-size:13px;font-weight:600;color:#0F172A;white-space:nowrap;">${labels.amount}</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
            <tr><td colspan="4" style="padding:0;border-top:1px solid #EDEFF2;"></td></tr>
            <tr>
              <td colspan="3" style="padding:12px 14px 6px;font-size:13.5px;color:#0F172A;">${labels.subtotal}</td>
              <td align="right" style="padding:12px 14px 6px;font-size:13.5px;color:#0F172A;white-space:nowrap;">${fp(opts.subtotal)}</td>
            </tr>
            ${discountRow}
            <tr>
              <td colspan="3" style="padding:6px 14px;font-size:13.5px;color:#0F172A;">${labels.shippingFee}</td>
              <td align="right" style="padding:6px 14px;font-size:13.5px;color:#0F172A;white-space:nowrap;">${fp(opts.shippingFee)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:6px 14px;font-size:14px;font-weight:700;color:#0F172A;">${labels.total}</td>
              <td align="right" style="padding:6px 14px;font-size:14px;font-weight:700;color:#0F172A;white-space:nowrap;">${fp(opts.total)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:6px 14px;font-size:13.5px;color:#0F172A;">${labels.prepaid}</td>
              <td align="right" style="padding:6px 14px;font-size:13.5px;color:#0F172A;white-space:nowrap;">${fp(opts.prepaid)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:6px 14px 14px;font-size:13.5px;color:#0F172A;">${labels.codPayment}</td>
              <td align="right" style="padding:6px 14px 14px;font-size:13.5px;color:#0F172A;white-space:nowrap;">${fp(opts.cod)}</td>
            </tr>
          </tbody>
        </table>
      </td></tr>`
}

export function buildPaymentMetaBlock(
    paymentMethodText: string,
    buyerNote: string | null | undefined,
    shippingProvider: string | null | undefined,
    labels: { paymentMethod: string; buyerNote: string; shippingProvider: string },
): string {
    const esc = escapeHtml
    const providerRow = shippingProvider
        ? `<tr>
            <td style="padding:6px 0;color:#0F172A;font-weight:500;">${labels.shippingProvider}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;">${esc(shippingProvider)}</td>
            <td colspan="2"></td>
        </tr>` : ''

    return `
      <!-- Payment method / shipping provider / buyer note -->
      <tr><td style="padding:14px 40px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:22px;">
          <tr>
            <td width="170" style="padding:6px 0;color:#0F172A;font-weight:500;">${labels.paymentMethod}</td>
            <td style="padding:6px 14px 6px 0;color:#94A3B8;">${paymentMethodText}</td>
            <td width="170" style="padding:6px 0;color:#0F172A;font-weight:500;">${labels.buyerNote}</td>
            <td align="right" style="padding:6px 0;color:#94A3B8;">${buyerNote ? esc(buyerNote) : '—'}</td>
          </tr>
          ${providerRow}
        </table>
      </td></tr>`
}

export function buildCtaBlock(href: string, ctaText: string): string {
    const safeHref = href.replace(/&/g, '&amp;')
    return `
      <!-- CTA -->
      <tr><td align="center" style="padding:26px 40px 14px;">
        <a href="${safeHref}" style="display:inline-block;background:#14C2BB;color:#FFFFFF;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;line-height:18px;padding:14px 28px;border-radius:8px;text-decoration:none;">${ctaText}</a>
      </td></tr>`
}

export function buildEmailFooter(shopName: string, farewell: string, copyright: string): string {
    return `
      <!-- Farewell -->
      <tr><td align="center" style="padding:10px 40px 6px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#0F172A;">${farewell}</div>
      </td></tr>

      <!-- Footer -->
      <tr><td align="center" style="padding:6px 40px 36px;">
        <div style="font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#94A3B8;">${copyright} ${escapeHtml(shopName)}</div>
      </td></tr>`
}

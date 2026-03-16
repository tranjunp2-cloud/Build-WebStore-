/**
 * Server-side i18n helper for email templates.
 * Provides translations and locale-aware formatting for emails.
 *
 * Note: Emails are rendered server-side, so we can't use the React I18nProvider.
 * This module provides a lightweight alternative.
 */

export type EmailLocale = 'en' | 'ms'

// ─── Email Translations ─────────────────────────────────────────────────
const emailTranslations = {
    en: {
        // Welcome email
        welcome: {
            subject: 'Welcome to PrimeWeb! 🎉',
            heading: 'Welcome! 🎉',
            subheading: 'Welcome to PrimeWeb',
            greeting: 'Hi',
            body: 'You\'re ready to create your first website with PrimeWeb! Just describe your idea, and AI will help you build a professional website in minutes.',
            stepsTitle: 'Get started in 3 steps',
            step1: 'Describe the website you want to create',
            step2: 'Customize the content and design',
            step3: 'Publish and share!',
            cta: 'Get Started →',
            footer: 'Powered by PrimeWeb — AI Website Builder for Malaysian SMEs',
        },
        // Order confirmation email
        order: {
            subject: 'Order Confirmed',
            heading: 'Order Confirmed ✓',
            subheading: 'Thank you for your purchase!',
            greeting: 'Hi',
            body: 'Your order has been placed successfully.',
            orderNumber: 'Order Number',
            item: 'Item',
            qty: 'Qty',
            amount: 'Amount',
            subtotal: 'Subtotal',
            sst: 'SST (6%)',
            total: 'Total',
            shippingAddress: 'Shipping Address',
            footer: 'Powered by PrimeWeb',
        },
        // Order status email
        status: {
            greeting: 'Hi',
            orderNumber: 'Order Number',
            tracking: 'Tracking',
            processing: {
                title: 'Order is Processing',
                description: 'Your order is being prepared. We will notify you when it has been shipped.',
            },
            shipped: {
                title: 'Order Shipped',
                description: 'Your order is on its way. You can track your shipment below.',
            },
            delivered: {
                title: 'Order Delivered',
                description: 'Your order has been delivered. Thank you for your purchase!',
            },
            cancelled: {
                title: 'Order Cancelled',
                description: 'Your order has been cancelled. If you have any questions, please contact us.',
            },
        },
    },
    ms: {
        // Welcome email
        welcome: {
            subject: 'Selamat Datang ke PrimeWeb! 🎉',
            heading: 'Selamat Datang! 🎉',
            subheading: 'Selamat datang ke PrimeWeb',
            greeting: 'Hai',
            body: 'Anda sudah bersedia untuk mencipta laman web pertama anda dengan PrimeWeb! Hanya huraikan idea anda, dan AI akan membantu anda membina laman web profesional dalam beberapa minit.',
            stepsTitle: 'Mula dalam 3 langkah',
            step1: 'Huraikan laman web yang anda mahu cipta',
            step2: 'Sesuaikan kandungan dan reka bentuk',
            step3: 'Terbitkan dan kongsi!',
            cta: 'Mula Sekarang →',
            footer: 'Dikuasakan oleh PrimeWeb — Pembina Laman Web AI untuk SME Malaysia',
        },
        // Order confirmation email
        order: {
            subject: 'Pesanan Disahkan',
            heading: 'Pesanan Disahkan ✓',
            subheading: 'Terima kasih atas pembelian anda!',
            greeting: 'Hai',
            body: 'Pesanan anda telah berjaya dibuat.',
            orderNumber: 'Nombor Pesanan',
            item: 'Barangan',
            qty: 'Kuantiti',
            amount: 'Jumlah',
            subtotal: 'Jumlah Kecil',
            sst: 'SST (6%)',
            total: 'Jumlah Besar',
            shippingAddress: 'Alamat Penghantaran',
            footer: 'Dikuasakan oleh PrimeWeb',
        },
        // Order status email
        status: {
            greeting: 'Hai',
            orderNumber: 'Nombor Pesanan',
            tracking: 'Penjejakan',
            processing: {
                title: 'Pesanan Sedang Diproses',
                description: 'Pesanan anda sedang disediakan. Kami akan memaklumkan anda apabila ia telah dihantar.',
            },
            shipped: {
                title: 'Pesanan Telah Dihantar',
                description: 'Pesanan anda sedang dalam perjalanan. Anda boleh menjejaki penghantaran di bawah.',
            },
            delivered: {
                title: 'Pesanan Telah Dihantar',
                description: 'Pesanan anda telah dihantar. Terima kasih atas pembelian anda!',
            },
            cancelled: {
                title: 'Pesanan Dibatalkan',
                description: 'Pesanan anda telah dibatalkan. Jika ada sebarang pertanyaan, sila hubungi kami.',
            },
        },
    },
} as const

// ─── Helper Functions ────────────────────────────────────────────────────

/** Get email translations for a locale */
export function getEmailT(locale: EmailLocale = 'en') {
    return emailTranslations[locale] || emailTranslations.en
}

/**
 * Format price based on locale per SPEC Rule 3.
 * EN: MYR 299.00 | MS: RM299.00
 */
export function formatPrice(amount: number, currency: string, locale: EmailLocale = 'en'): string {
    if (currency === 'MYR') {
        return locale === 'ms'
            ? `RM${amount.toFixed(2)}`
            : `MYR ${amount.toFixed(2)}`
    }
    if (currency === 'SGD') return `S$${amount.toFixed(2)}`
    return `$${amount.toFixed(2)}`
}

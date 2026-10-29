/**
 * Words of the To do list, in the two merchant languages (English, Bahasa Melayu). Each task has a
 * title, a one-line detail and a ready-to-send copilot message (`prompt`) that starts fixing it.
 * Pure data + functions, no I/O.
 */
export type TodoLocale = 'en' | 'ms'

export type ShopTodoKind =
    | 'orders_to_confirm'
    | 'payment_proofs'
    | 'orders_to_ship'
    | 'out_of_stock'
    | 'low_stock'
    | 'products_missing_info'
    | 'products_ai_review'
    | 'discounts_expiring'
    | 'discounts_used_up'
    | 'site_broken_links'
    | 'site_unpublished'
    | 'site_missing_seo'
    | 'leads_waiting'

export interface TodoTextVars {
    count: number
    /** oldest waiting, in hours (orders to confirm) */
    oldestHours?: number
    /** codes named in the detail (discounts) */
    codes?: string[]
    /** missing-info breakdown (products) */
    noPhoto?: number
    noDescription?: number
    noSeo?: number
    /** the website has never been published */
    neverPublished?: boolean
}

export interface TodoText { title: string; detail: string; prompt: string }

export const LOW_STOCK_BELOW = 10
export const EXPIRING_WITHIN_DAYS = 3
export const SHIP_AFTER_HOURS = 24
export const LEAD_WAIT_HOURS = 48

const plural = (n: number, one: string, other: string) => (n === 1 ? one : other)

function age(hours: number, locale: TodoLocale): string {
    if (hours < 1) return locale === 'ms' ? 'kurang sejam' : 'under an hour'
    if (hours < 48) return locale === 'ms' ? `${Math.floor(hours)} jam` : `${Math.floor(hours)} h`
    const days = Math.floor(hours / 24)
    return locale === 'ms' ? `${days} hari` : `${days} days`
}

const list = (codes: string[] | undefined) => (codes ?? []).slice(0, 3).join(', ')

const EN: Record<ShopTodoKind, (v: TodoTextVars) => TodoText> = {
    orders_to_confirm: (v) => ({
        title: `${v.count} ${plural(v.count, 'order', 'orders')} waiting to be confirmed`,
        detail: v.oldestHours != null ? `The oldest was placed ${age(v.oldestHours, 'en')} ago.` : 'Buyers are waiting for your reply.',
        prompt: `I have ${v.count} ${plural(v.count, 'order', 'orders')} waiting to be confirmed. Show me what is waiting, oldest first, and help me work through them.`,
    }),
    payment_proofs: (v) => ({
        title: `${v.count} payment ${plural(v.count, 'proof', 'proofs')} to check`,
        detail: 'Buyers uploaded a transfer receipt. Check the money arrived, then approve or reject.',
        prompt: `${v.count} ${plural(v.count, 'order has', 'orders have')} a payment proof waiting for my check. Show me which orders and what I should look at before approving.`,
    }),
    orders_to_ship: (v) => ({
        title: `${v.count} confirmed ${plural(v.count, 'order', 'orders')} not shipped yet`,
        detail: `Confirmed more than ${SHIP_AFTER_HOURS} hours ago and still waiting to go out.`,
        prompt: `${v.count} confirmed ${plural(v.count, 'order is', 'orders are')} still not shipped after more than ${SHIP_AFTER_HOURS} hours. Show me which ones and help me get them shipped.`,
    }),
    out_of_stock: (v) => ({
        title: `${v.count} live ${plural(v.count, 'product is', 'products are')} out of stock`,
        detail: 'Active products with 0 in stock.',
        prompt: `Which of my live products are out of stock? Ask me how many I have of each (one list) and update the stock in one go; for the ones I will not restock, offer to move them to draft.`,
    }),
    low_stock: (v) => ({
        title: `${v.count} ${plural(v.count, 'product is', 'products are')} running low`,
        detail: `Active products with fewer than ${LOW_STOCK_BELOW} left.`,
        prompt: `Which of my products have fewer than ${LOW_STOCK_BELOW} left in stock? Show me the list so I can decide what to restock.`,
    }),
    products_missing_info: (v) => {
        const parts = [
            v.noPhoto ? `${v.noPhoto} without a photo` : '',
            v.noDescription ? `${v.noDescription} without a description` : '',
            v.noSeo ? `${v.noSeo} without a search title or description` : '',
        ].filter(Boolean)
        return {
            title: `${v.count} live ${plural(v.count, 'product is', 'products are')} missing information`,
            detail: `${parts.join(', ')}.`,
            prompt: 'Some of my live products are missing a photo, a description or a search (SEO) title. Show me which ones and fix what you can from what you already know about them.',
        }
    },
    products_ai_review: (v) => ({
        title: `${v.count} AI ${plural(v.count, 'draft', 'drafts')} to review`,
        detail: 'Products drafted by AI that are not on sale until you have looked at them.',
        prompt: `I have ${v.count} product ${plural(v.count, 'draft', 'drafts')} waiting for my review. Show me what is missing on each (stock, price, photos), ask me for it in one go, and set them up so I can publish them.`,
    }),
    discounts_expiring: (v) => ({
        title: `${v.count} discount ${plural(v.count, 'code ends', 'codes end')} within ${EXPIRING_WITHIN_DAYS} days`,
        detail: v.codes?.length ? `Ending soon: ${list(v.codes)}.` : 'Extend them or let them end.',
        prompt: `Which discount codes end within ${EXPIRING_WITHIN_DAYS} days, and how did they perform? Tell me if I should extend any of them.`,
    }),
    discounts_used_up: (v) => ({
        title: `${v.count} discount ${plural(v.count, 'code is', 'codes are')} used up`,
        detail: v.codes?.length ? `Reached the usage limit but still switched on: ${list(v.codes)}.` : 'Reached the usage limit but still switched on.',
        prompt: 'Some of my discount codes have reached their usage limit. Show me which, how they performed, and whether I should raise the limit or switch them off.',
    }),
    site_broken_links: (v) => ({
        title: `${v.count} broken ${plural(v.count, 'link', 'links')} on your website`,
        detail: 'Visitors who click them see "page not found".',
        prompt: 'Check my website for broken links and fix them.',
    }),
    site_unpublished: (v) => ({
        title: v.neverPublished ? 'Your website is not published yet' : `${v.count} ${plural(v.count, 'change', 'changes')} not live yet`,
        detail: v.neverPublished ? 'Visitors cannot see your shop until you publish it.' : 'You edited pages, but visitors still see the older version.',
        prompt: 'What is still missing before I publish my website? Check it and tell me what is ready.',
    }),
    site_missing_seo: (v) => ({
        title: `${v.count} ${plural(v.count, 'page has', 'pages have')} no search title or description`,
        detail: 'Without them, search engines show a generic snippet for the page.',
        prompt: 'Write a search title and description for the pages of my website that are missing them.',
    }),
    leads_waiting: (v) => ({
        title: `${v.count} ${plural(v.count, 'message', 'messages')} waiting for a reply`,
        detail: `Contact form messages still marked new after ${LEAD_WAIT_HOURS} hours.`,
        prompt: `I have ${v.count} contact ${plural(v.count, 'message', 'messages')} nobody has answered for over ${LEAD_WAIT_HOURS} hours. Help me see who is waiting and what they asked.`,
    }),
}

const MS: Record<ShopTodoKind, (v: TodoTextVars) => TodoText> = {
    orders_to_confirm: (v) => ({
        title: `${v.count} pesanan menunggu pengesahan`,
        detail: v.oldestHours != null ? `Yang paling lama dibuat ${age(v.oldestHours, 'ms')} lalu.` : 'Pembeli sedang menunggu jawapan anda.',
        prompt: `Saya ada ${v.count} pesanan menunggu pengesahan. Tunjukkan apa yang menunggu, yang paling lama dahulu, dan bantu saya menyelesaikannya.`,
    }),
    payment_proofs: (v) => ({
        title: `${v.count} bukti pembayaran perlu disemak`,
        detail: 'Pembeli memuat naik resit pemindahan. Semak wang sudah masuk, kemudian lulus atau tolak.',
        prompt: `${v.count} pesanan ada bukti pembayaran yang menunggu semakan saya. Tunjukkan pesanan mana dan apa yang perlu saya semak sebelum meluluskan.`,
    }),
    orders_to_ship: (v) => ({
        title: `${v.count} pesanan disahkan belum dihantar`,
        detail: `Disahkan lebih ${SHIP_AFTER_HOURS} jam lalu dan masih menunggu untuk dihantar.`,
        prompt: `${v.count} pesanan yang disahkan masih belum dihantar selepas lebih ${SHIP_AFTER_HOURS} jam. Tunjukkan yang mana dan bantu saya menghantarnya.`,
    }),
    out_of_stock: (v) => ({
        title: `${v.count} produk aktif kehabisan stok`,
        detail: 'Produk aktif dengan stok 0.',
        prompt: 'Produk aktif saya yang mana kehabisan stok? Tanya saya berapa banyak setiap satu (satu senarai) dan kemas kini stok sekali gus; untuk yang tidak akan ditambah, tawarkan untuk menukarnya kepada draf.',
    }),
    low_stock: (v) => ({
        title: `${v.count} produk hampir habis`,
        detail: `Produk aktif dengan kurang daripada ${LOW_STOCK_BELOW} unit.`,
        prompt: `Produk saya yang mana tinggal kurang daripada ${LOW_STOCK_BELOW} unit? Tunjukkan senarai supaya saya boleh pilih yang perlu ditambah.`,
    }),
    products_missing_info: (v) => {
        const parts = [
            v.noPhoto ? `${v.noPhoto} tiada gambar` : '',
            v.noDescription ? `${v.noDescription} tiada penerangan` : '',
            v.noSeo ? `${v.noSeo} tiada tajuk atau penerangan carian` : '',
        ].filter(Boolean)
        return {
            title: `${v.count} produk aktif kekurangan maklumat`,
            detail: `${parts.join(', ')}.`,
            prompt: 'Sesetengah produk aktif saya tiada gambar, penerangan atau tajuk carian (SEO). Tunjukkan yang mana dan baiki apa yang boleh daripada maklumat yang anda sudah tahu.',
        }
    },
    products_ai_review: (v) => ({
        title: `${v.count} draf AI menunggu semakan`,
        detail: 'Produk yang dibuat oleh AI dan belum dijual sehingga anda menyemaknya.',
        prompt: `Saya ada ${v.count} draf produk menunggu semakan. Tunjukkan apa yang kurang pada setiap satu (stok, harga, gambar), tanya saya sekali gus, dan sediakannya supaya saya boleh menerbitkannya.`,
    }),
    discounts_expiring: (v) => ({
        title: `${v.count} kod diskaun tamat dalam ${EXPIRING_WITHIN_DAYS} hari`,
        detail: v.codes?.length ? `Hampir tamat: ${list(v.codes)}.` : 'Lanjutkan atau biarkan ia tamat.',
        prompt: `Kod diskaun mana yang tamat dalam ${EXPIRING_WITHIN_DAYS} hari, dan bagaimana prestasinya? Beritahu saya jika ada yang patut dilanjutkan.`,
    }),
    discounts_used_up: (v) => ({
        title: `${v.count} kod diskaun sudah habis digunakan`,
        detail: v.codes?.length ? `Capai had penggunaan tetapi masih aktif: ${list(v.codes)}.` : 'Capai had penggunaan tetapi masih aktif.',
        prompt: 'Sesetengah kod diskaun saya sudah capai had penggunaan. Tunjukkan yang mana, prestasinya, dan sama ada saya patut naikkan had atau matikannya.',
    }),
    site_broken_links: (v) => ({
        title: `${v.count} pautan rosak pada laman web anda`,
        detail: 'Pelawat yang mengkliknya akan nampak "halaman tidak ditemui".',
        prompt: 'Semak laman web saya untuk pautan rosak dan baikinya.',
    }),
    site_unpublished: (v) => ({
        title: v.neverPublished ? 'Laman web anda belum diterbitkan' : `${v.count} perubahan belum disiarkan`,
        detail: v.neverPublished ? 'Pelawat tidak boleh melihat kedai anda sehingga anda menerbitkannya.' : 'Anda sudah mengubah halaman, tetapi pelawat masih melihat versi lama.',
        prompt: 'Apa lagi yang kurang sebelum saya menerbitkan laman web saya? Semak dan beritahu saya apa yang sudah siap.',
    }),
    site_missing_seo: (v) => ({
        title: `${v.count} halaman tiada tajuk atau penerangan carian`,
        detail: 'Tanpanya, enjin carian menunjukkan ringkasan umum untuk halaman itu.',
        prompt: 'Tulis tajuk dan penerangan carian untuk halaman laman web saya yang tiada.',
    }),
    leads_waiting: (v) => ({
        title: `${v.count} mesej menunggu balasan`,
        detail: `Mesej borang hubungan masih bertanda baharu selepas ${LEAD_WAIT_HOURS} jam.`,
        prompt: `Saya ada ${v.count} mesej hubungan yang tiada siapa jawab lebih ${LEAD_WAIT_HOURS} jam. Bantu saya lihat siapa yang menunggu dan apa yang ditanya.`,
    }),
}

export function todoText(kind: ShopTodoKind, locale: TodoLocale, vars: TodoTextVars): TodoText {
    return (locale === 'ms' ? MS : EN)[kind](vars)
}

export const SHOP_TODO_KINDS: readonly ShopTodoKind[] = [
    'orders_to_confirm', 'payment_proofs', 'orders_to_ship', 'out_of_stock', 'low_stock', 'products_missing_info', 'products_ai_review',
    'discounts_expiring', 'discounts_used_up', 'site_broken_links', 'site_unpublished', 'site_missing_seo', 'leads_waiting',
]

/** True for a To do kind we know (what a `?todo=<kind>` link may carry; anything else is ignored). */
export function isShopTodoKind(value: unknown): value is ShopTodoKind {
    return typeof value === 'string' && (SHOP_TODO_KINDS as readonly string[]).includes(value)
}

/** The copilot message that starts "finish my store": ask for stock / prices / real photos in one go, then set them up in one card. */
export const FINISH_STORE_PROMPT: Record<TodoLocale, string> = {
    en: 'Help me finish my store. Look at my products that were made by AI, have no stock or no price, or only have stock photos. Ask me once for the missing stock and prices (one list) and for real photos, then set everything up in one go.',
    ms: 'Bantu saya siapkan kedai saya. Lihat produk saya yang dibuat oleh AI, tiada stok atau harga, atau hanya ada gambar stok. Tanya saya sekali untuk stok dan harga yang kurang (satu senarai) dan gambar sebenar, kemudian sediakan semuanya sekali gus.',
}

/**
 * The fixed message a reminder link (`?todo=<kind>`) puts in the copilot box. The link carries only the kind, never text,
 * so a crafted link cannot choose what the copilot is asked. No numbers (the link does not know how many are waiting).
 */
const LINK_PROMPT: Partial<Record<ShopTodoKind, Record<TodoLocale, string>>> = {
    orders_to_confirm: {
        en: 'Some orders are waiting to be confirmed. Show me what is waiting, oldest first, and help me work through them.',
        ms: 'Ada pesanan menunggu pengesahan. Tunjukkan apa yang menunggu, yang paling lama dahulu, dan bantu saya menyelesaikannya.',
    },
    payment_proofs: {
        en: 'Some orders have a payment proof waiting for my check. Show me which orders and what I should look at before approving.',
        ms: 'Ada pesanan dengan bukti pembayaran yang menunggu semakan saya. Tunjukkan pesanan mana dan apa yang perlu saya semak sebelum meluluskan.',
    },
    orders_to_ship: {
        en: `Some confirmed orders are still not shipped after more than ${SHIP_AFTER_HOURS} hours. Show me which ones and help me get them shipped.`,
        ms: `Ada pesanan yang disahkan masih belum dihantar selepas lebih ${SHIP_AFTER_HOURS} jam. Tunjukkan yang mana dan bantu saya menghantarnya.`,
    },
    // the builder's "Finish your shop" link lands here: its products are on sale already, so this starts the finish flow
    products_ai_review: FINISH_STORE_PROMPT,
    out_of_stock: {
        en: 'Some of my live products are out of stock. Ask me how many I have of each (one list), then update the stock in one go.',
        ms: 'Sesetengah produk aktif saya kehabisan stok. Tanya saya berapa banyak setiap satu (satu senarai), kemudian kemas kini stok sekali gus.',
    },
    leads_waiting: {
        en: `I have contact messages nobody has answered for over ${LEAD_WAIT_HOURS} hours. Help me see who is waiting and what they asked.`,
        ms: `Saya ada mesej hubungan yang tiada siapa jawab lebih ${LEAD_WAIT_HOURS} jam. Bantu saya lihat siapa yang menunggu dan apa yang ditanya.`,
    },
}

export function todoLinkPrompt(kind: ShopTodoKind, locale: TodoLocale): string {
    return LINK_PROMPT[kind]?.[locale] ?? todoText(kind, locale, { count: 0 }).prompt
}

// ── selling setup: what stops the shop from being ready to sell (the copilot's `setup` list; not part of the To do card) ──

export type ShopSetupKind = 'payments_cod_only' | 'business_info_missing' | 'custom_domain_missing' | 'products_stock_photos' | 'products_setup'

export const SHOP_SETUP_KINDS: readonly ShopSetupKind[] = ['products_setup', 'products_stock_photos', 'payments_cod_only', 'business_info_missing', 'custom_domain_missing']

export interface SetupTextVars {
    count: number
    /** payments: cash on delivery is the only method on / no method is on at all */
    codOn?: boolean
    /** payments: Stripe onboarding is complete (so card / FPX can be switched on) */
    stripeConnected?: boolean
    /** business info: what is missing, in the fixed order phone, address, hours */
    missing?: Array<'phone' | 'address' | 'hours'>
    /** products_setup breakdown */
    noStock?: number
    noPrice?: number
}

const SETUP_PART: Record<TodoLocale, Record<'phone' | 'address' | 'hours', string>> = {
    en: { phone: 'phone number', address: 'address', hours: 'opening hours' },
    ms: { phone: 'nombor telefon', address: 'alamat', hours: 'waktu buka' },
}

const SETUP_EN: Record<ShopSetupKind, (v: SetupTextVars) => TodoText> = {
    products_setup: (v) => ({
        title: `${v.count} live ${plural(v.count, 'product has', 'products have')} no stock or no price`,
        detail: [v.noStock ? `${v.noStock} with 0 in stock` : '', v.noPrice ? `${v.noPrice} with a price of 0` : ''].filter(Boolean).join(', ') + '. Buyers cannot order them.',
        prompt: FINISH_STORE_PROMPT.en,
    }),
    products_stock_photos: (v) => ({
        title: `${v.count} live ${plural(v.count, 'product shows', 'products show')} stock or AI pictures`,
        detail: 'Buyers see pictures that are not your real products.',
        prompt: FINISH_STORE_PROMPT.en,
    }),
    payments_cod_only: (v) => ({
        title: v.codOn === false ? 'No way to pay is switched on' : 'Buyers can only pay cash on delivery',
        detail: v.stripeConnected ? 'Card, FPX, e-wallets and bank transfer are switched off.' : 'Card, FPX, e-wallets and bank transfer are switched off, and online payments are not connected yet.',
        prompt: 'My shop takes cash on delivery only. Tell me what I need to set up to accept cards, FPX, e-wallets or bank transfer, and where to do it.',
    }),
    business_info_missing: (v) => ({
        title: `Business details missing: ${(v.missing ?? []).map((part) => SETUP_PART.en[part]).join(', ')}`,
        detail: 'Buyers and search engines look for these on your website.',
        prompt: 'Which business details are missing on my website (phone number, address, opening hours)? Tell me where to fill each one in.',
    }),
    custom_domain_missing: () => ({
        title: 'No custom domain yet',
        detail: 'Your shop only has its free address. Your own domain looks more trusted.',
        prompt: 'How do I connect my own domain to my shop?',
    }),
}

const SETUP_MS: Record<ShopSetupKind, (v: SetupTextVars) => TodoText> = {
    products_setup: (v) => ({
        title: `${v.count} produk aktif tiada stok atau harga`,
        detail: [v.noStock ? `${v.noStock} dengan stok 0` : '', v.noPrice ? `${v.noPrice} dengan harga 0` : ''].filter(Boolean).join(', ') + '. Pembeli tidak boleh menempahnya.',
        prompt: FINISH_STORE_PROMPT.ms,
    }),
    products_stock_photos: (v) => ({
        title: `${v.count} produk aktif menunjukkan gambar stok atau AI`,
        detail: 'Pembeli nampak gambar yang bukan produk sebenar anda.',
        prompt: FINISH_STORE_PROMPT.ms,
    }),
    payments_cod_only: (v) => ({
        title: v.codOn === false ? 'Tiada cara pembayaran diaktifkan' : 'Pembeli hanya boleh bayar tunai semasa penghantaran',
        detail: v.stripeConnected ? 'Kad, FPX, e-dompet dan pindahan bank dimatikan.' : 'Kad, FPX, e-dompet dan pindahan bank dimatikan, dan pembayaran dalam talian belum disambungkan.',
        prompt: 'Kedai saya hanya terima bayaran tunai semasa penghantaran. Beritahu saya apa yang perlu disediakan untuk menerima kad, FPX, e-dompet atau pindahan bank, dan di mana.',
    }),
    business_info_missing: (v) => ({
        title: `Maklumat perniagaan belum lengkap: ${(v.missing ?? []).map((part) => SETUP_PART.ms[part]).join(', ')}`,
        detail: 'Pembeli dan enjin carian mencarinya di laman web anda.',
        prompt: 'Maklumat perniagaan mana yang tiada di laman web saya (nombor telefon, alamat, waktu buka)? Beritahu saya di mana untuk mengisi setiap satu.',
    }),
    custom_domain_missing: () => ({
        title: 'Belum ada domain sendiri',
        detail: 'Kedai anda hanya ada alamat percuma. Domain sendiri nampak lebih dipercayai.',
        prompt: 'Bagaimana untuk sambungkan domain saya sendiri ke kedai saya?',
    }),
}

export function setupText(kind: ShopSetupKind, locale: TodoLocale, vars: SetupTextVars): TodoText {
    return (locale === 'ms' ? SETUP_MS : SETUP_EN)[kind](vars)
}

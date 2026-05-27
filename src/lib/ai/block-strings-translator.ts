/**
 * Block strings translator — GPT micro-call for languages not in the static seed.
 *
 * Cache strategy (same as nav-label-translator):
 *  - Cache miss → skip override this request, keep GPT output as-is
 *  - Fire-and-forget prefetch populates runtimeBlockStringsCache for next warm request
 *  - Failure → keep GPT output (no forced English fallback)
 *
 * The 8 languages in STRINGS (en/ms/vi/ja/zh/ko/ar/th) cover most traffic.
 * This module handles long-tail languages (Swahili, Tagalog, Burmese, etc.)
 * without requiring manual additions to block-i18n.ts.
 */

import type OpenAI from 'openai'
import type { BlockStrings, SectionLabels } from './block-i18n'
import { getBlockStrings, hasDedicatedStrings, injectBlockStrings, injectSectionLabels } from './block-i18n'

/** Flat string keys sent to GPT — function fields reconstructed from these. */
interface RawTranslation {
    nav_home: string
    nav_about: string
    nav_services: string
    nav_contact: string
    nav_get_started: string
    about_prefix: string
    faq_headline: string
    cta_subheadline: string
    contact_headline: string
    contact_subheadline: string
    contact_name: string
    contact_email: string
    contact_phone: string
    contact_address: string
    contact_message: string
    contact_name_placeholder: string
    contact_message_placeholder: string
    contact_submit: string
    footer_rights: string
    footer_explore: string
    footer_company: string
    footer_support: string
    footer_legal: string
    footer_about_us: string
    footer_careers: string
    footer_help: string
    footer_get_in_touch: string
    footer_privacy: string
    footer_terms: string
    footer_cookies: string
    stats_headline: string
    team_headline: string
    team_subheadline: string
    service_cards_headline: string
    service_cards_cta: string
    client_logos_headline: string
    gallery_headline: string
    newsletter_subheadline: string
    newsletter_subscribe: string
    pricing_headline: string
    pricing_subheadline: string
    pricing_get_started: string
    pricing_learn_more: string
    testimonials_headline: string
    testimonials_subheadline: string
    // Section label tags (short, shown above block headlines)
    sl_about: string
    sl_gallery: string
    sl_contact: string
    sl_features: string
    sl_testimonials: string
    sl_faq: string
    sl_team: string
    sl_service_cards: string
    sl_stats: string
    sl_pricing: string
    sl_newsletter: string
    sl_client_logos: string
    sl_blog: string
    sl_contact_submit: string
    sl_about_prefix: string
}

const ENGLISH_VALUES: RawTranslation = {
    nav_home: 'Home',
    nav_about: 'About',
    nav_services: 'Services',
    nav_contact: 'Contact',
    nav_get_started: 'Get Started',
    about_prefix: 'About',
    faq_headline: 'Frequently Asked Questions',
    cta_subheadline: 'Contact us today and let us help you achieve your goals.',
    contact_headline: 'Get in Touch',
    contact_subheadline: 'We would love to hear from you. Send us a message.',
    contact_name: 'Name',
    contact_email: 'Email',
    contact_phone: 'Phone',
    contact_address: 'Address',
    contact_message: 'Message',
    contact_name_placeholder: 'Your full name',
    contact_message_placeholder: 'How can we help you?',
    contact_submit: 'Send Message',
    footer_rights: 'All rights reserved.',
    footer_explore: 'Explore',
    footer_company: 'Company',
    footer_support: 'Support',
    footer_legal: 'Legal',
    footer_about_us: 'About Us',
    footer_careers: 'Careers',
    footer_help: 'Help Center',
    footer_get_in_touch: 'Get in Touch',
    footer_privacy: 'Privacy Policy',
    footer_terms: 'Terms of Service',
    footer_cookies: 'Cookie Policy',
    stats_headline: 'Our Numbers Speak',
    team_headline: 'Meet Our Team',
    team_subheadline: 'The people behind the magic.',
    service_cards_headline: 'Our Services',
    service_cards_cta: 'Learn More',
    client_logos_headline: 'Trusted By',
    gallery_headline: 'Our Work',
    newsletter_subheadline: 'Subscribe for exclusive news and offers.',
    newsletter_subscribe: 'Subscribe',
    pricing_headline: 'Our Pricing',
    pricing_subheadline: 'Transparent pricing with no hidden fees.',
    pricing_get_started: 'Get Started',
    pricing_learn_more: 'Learn More',
    testimonials_headline: 'What Our Customers Say',
    testimonials_subheadline: 'Genuine reviews from our customers',
    sl_about: 'About Us',
    sl_gallery: 'Gallery',
    sl_contact: 'Contact',
    sl_features: 'Features',
    sl_testimonials: 'Testimonials',
    sl_faq: 'FAQ',
    sl_team: 'Our Team',
    sl_service_cards: 'Services',
    sl_stats: 'Our Numbers',
    sl_pricing: 'Pricing',
    sl_newsletter: 'Newsletter',
    sl_client_logos: 'Our Clients',
    sl_blog: 'Blog',
    sl_contact_submit: 'Send Message',
    sl_about_prefix: 'About',
}

function buildBlockStrings(t: RawTranslation): BlockStrings {
    return {
        navigation: {
            home: t.nav_home,
            about: t.nav_about,
            services: t.nav_services,
            contact: t.nav_contact,
            getStarted: t.nav_get_started,
        },
        about: { headlinePrefix: t.about_prefix },
        faq: {
            headline: t.faq_headline,
            headlineWithBiz: (biz) => `${biz} — ${t.faq_headline}`,
        },
        cta: {
            headlineReady: (name) => `${t.nav_get_started} — ${name}`,
            headlineDiscover: (name) => `${name}`,
            subheadline: t.cta_subheadline,
        },
        contact: {
            headline: t.contact_headline,
            subheadline: t.contact_subheadline,
            subheadlineWithBiz: (name) => `${t.contact_subheadline.replace(/\.$/, '')} — ${name}.`,
            nameLabel: t.contact_name,
            emailLabel: t.contact_email,
            phoneLabel: t.contact_phone,
            addressLabel: t.contact_address,
            messageLabel: t.contact_message,
            namePlaceholder: t.contact_name_placeholder,
            messagePlaceholder: t.contact_message_placeholder,
            submitLabel: t.contact_submit,
        },
        footer: {
            allRightsReserved: t.footer_rights,
            explore: t.footer_explore,
            company: t.footer_company,
            support: t.footer_support,
            legal: t.footer_legal,
            aboutUs: t.footer_about_us,
            careers: t.footer_careers,
            helpCenter: t.footer_help,
            getInTouch: t.footer_get_in_touch,
            privacyPolicy: t.footer_privacy,
            termsOfService: t.footer_terms,
            cookiePolicy: t.footer_cookies,
        },
        features: { headlineWhyChoose: (name) => `${name}` },
        stats: { headline: t.stats_headline },
        team: {
            headline: t.team_headline,
            subheadline: t.team_subheadline,
        },
        serviceCards: {
            headline: t.service_cards_headline,
            subheadline: (name) => `${name}`,
            ctaLabel: t.service_cards_cta,
        },
        clientLogos: { headline: t.client_logos_headline },
        gallery: { headline: t.gallery_headline },
        newsletter: {
            headlineStayUpdated: (name) => `${name}`,
            subheadlineFallback: t.newsletter_subheadline,
            subscribeLabel: t.newsletter_subscribe,
        },
        pricing: {
            headline: t.pricing_headline,
            subheadline: t.pricing_subheadline,
            getStarted: t.pricing_get_started,
            learnMore: t.pricing_learn_more,
        },
        testimonials: {
            headline: t.testimonials_headline,
            headlineWithBiz: (biz) => `${biz} — ${t.testimonials_headline}`,
            subheadline: t.testimonials_subheadline,
        },
    }
}

function buildSectionLabels(t: RawTranslation): SectionLabels {
    return {
        about: t.sl_about,
        gallery: t.sl_gallery,
        contact: t.sl_contact,
        features: t.sl_features,
        testimonials: t.sl_testimonials,
        faq: t.sl_faq,
        team: t.sl_team,
        serviceCards: t.sl_service_cards,
        stats: t.sl_stats,
        pricing: t.sl_pricing,
        newsletter: t.sl_newsletter,
        clientLogos: t.sl_client_logos,
        blogList: t.sl_blog,
        contactSubmitLabel: t.sl_contact_submit,
        aboutHeadlinePrefix: t.sl_about_prefix,
    }
}

function isValidTranslation(raw: Partial<RawTranslation>): raw is RawTranslation {
    return !!(
        raw.nav_home && raw.nav_contact && raw.contact_submit &&
        raw.footer_rights && raw.testimonials_headline && raw.sl_gallery
    )
}

async function callGptTranslation(
    gpLang: string,
    openai: OpenAI,
): Promise<{ blockStrings: BlockStrings; sectionLabels: SectionLabels } | null> {
    const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-nano',
        messages: [{
            role: 'user',
            content: `Translate all values in the JSON below to ${gpLang}. Return ONLY valid JSON with the same keys. Do not add or remove keys.\n\n${JSON.stringify(ENGLISH_VALUES)}`,
        }],
        temperature: 0,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(raw) as Partial<RawTranslation>

    if (!isValidTranslation(parsed)) return null
    return { blockStrings: buildBlockStrings(parsed), sectionLabels: buildSectionLabels(parsed) }
}

/**
 * Fire-and-forget block strings prefetch for a language not yet in the runtime cache.
 *
 * The current request proceeds without waiting — GPT output is kept as-is.
 * The next warm request will find translated strings in cache and apply them.
 */
export function prefetchBlockStrings(gpLang: string, blockLang: string, openai: OpenAI): void {
    if (hasDedicatedStrings(blockLang)) return

    void callGptTranslation(gpLang, openai)
        .then((result) => {
            if (result) {
                injectBlockStrings(blockLang, result.blockStrings)
                injectSectionLabels(blockLang, result.sectionLabels)
                console.log(`[block-strings-translator] cached block strings + section labels for ${blockLang} (${gpLang})`)
            }
        })
        .catch((err) => {
            console.warn(`[block-strings-translator] prefetch failed for ${gpLang}:`, err)
        })
}

/** Translate and return block strings synchronously (for server-side pre-generation). */
export async function translateBlockStrings(
    gpLang: string,
    blockLang: string,
    openai: OpenAI,
): Promise<BlockStrings> {
    const cached = hasDedicatedStrings(blockLang) ? getBlockStrings(blockLang) : null
    if (cached) return cached
    const result = await callGptTranslation(gpLang, openai)
    if (result) {
        injectBlockStrings(blockLang, result.blockStrings)
        injectSectionLabels(blockLang, result.sectionLabels)
        return result.blockStrings
    }
    return getBlockStrings('en')
}

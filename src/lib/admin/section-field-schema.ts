/**
 * section-field-schema.ts
 * Maps block type slugs → inspector field definitions.
 * MVP: 10 most-common block types with text/textarea/url/array-text fields only.
 * Blocks without schema → Inspector shows "coming soon" message.
 */

export type FieldType = 'text' | 'textarea' | 'url' | 'array-text'

export interface FieldSpec {
    name: string
    label: string
    type: FieldType
    placeholder?: string
}

export const SECTION_FIELD_SCHEMA: Record<string, FieldSpec[]> = {
    hero: [
        { name: 'headline', label: 'Headline', type: 'text', placeholder: 'Main heading' },
        { name: 'subheadline', label: 'Subheadline', type: 'textarea', placeholder: 'Supporting text below headline' },
        { name: 'ctaText', label: 'CTA button text', type: 'text', placeholder: 'Get started' },
        { name: 'ctaHref', label: 'CTA link', type: 'url', placeholder: 'https://...' },
        { name: 'secondaryCtaText', label: 'Secondary CTA text', type: 'text', placeholder: 'Learn more' },
    ],
    features: [
        { name: 'heading', label: 'Section heading', type: 'text', placeholder: 'Our Features' },
        { name: 'subheading', label: 'Subheading', type: 'textarea', placeholder: 'Brief description' },
        { name: 'items', label: 'Feature items (one per line)', type: 'array-text' },
    ],
    cta: [
        { name: 'heading', label: 'Heading', type: 'text', placeholder: 'Ready to get started?' },
        { name: 'body', label: 'Body text', type: 'textarea', placeholder: 'Supporting copy' },
        { name: 'primaryCta', label: 'Primary CTA text', type: 'text', placeholder: 'Sign up free' },
        { name: 'primaryHref', label: 'Primary CTA link', type: 'url', placeholder: 'https://...' },
        { name: 'secondaryCta', label: 'Secondary CTA text', type: 'text', placeholder: 'Learn more' },
    ],
    faq: [
        { name: 'heading', label: 'Section heading', type: 'text', placeholder: 'Frequently Asked Questions' },
        { name: 'subheading', label: 'Subheading', type: 'textarea', placeholder: 'Everything you need to know' },
        { name: 'questions', label: 'Questions (one per line)', type: 'array-text' },
        { name: 'answers', label: 'Answers (one per line, matching order)', type: 'array-text' },
    ],
    navigation: [
        { name: 'logoText', label: 'Logo text', type: 'text', placeholder: 'Acme Inc.' },
        { name: 'ctaText', label: 'Nav CTA text', type: 'text', placeholder: 'Get started' },
        { name: 'ctaHref', label: 'Nav CTA link', type: 'url', placeholder: 'https://...' },
        { name: 'links', label: 'Nav links (one per line: label|href)', type: 'array-text' },
    ],
    footer: [
        { name: 'logoText', label: 'Logo text', type: 'text', placeholder: 'Acme Inc.' },
        { name: 'tagline', label: 'Tagline', type: 'text', placeholder: 'Building great products.' },
        { name: 'copyright', label: 'Copyright text', type: 'text', placeholder: '© 2024 Acme Inc.' },
        { name: 'links', label: 'Footer links (one per line: label|href)', type: 'array-text' },
    ],
    contact: [
        { name: 'heading', label: 'Section heading', type: 'text', placeholder: 'Get in touch' },
        { name: 'subheading', label: 'Subheading', type: 'textarea', placeholder: 'We\'d love to hear from you.' },
        { name: 'email', label: 'Contact email', type: 'text', placeholder: 'hello@example.com' },
        { name: 'phone', label: 'Phone number', type: 'text', placeholder: '+1 (555) 000-0000' },
        { name: 'address', label: 'Address', type: 'textarea', placeholder: '123 Main St, City' },
    ],
    newsletter: [
        { name: 'heading', label: 'Heading', type: 'text', placeholder: 'Stay in the loop' },
        { name: 'subheading', label: 'Subheading', type: 'textarea', placeholder: 'Get the latest news and updates.' },
        { name: 'placeholder', label: 'Input placeholder', type: 'text', placeholder: 'Enter your email' },
        { name: 'submitText', label: 'Submit button text', type: 'text', placeholder: 'Subscribe' },
    ],
    testimonials: [
        { name: 'heading', label: 'Section heading', type: 'text', placeholder: 'What our customers say' },
        { name: 'subheading', label: 'Subheading', type: 'textarea', placeholder: 'Trusted by thousands' },
        { name: 'quotes', label: 'Quotes (one per line)', type: 'array-text' },
        { name: 'authors', label: 'Authors (one per line, matching order)', type: 'array-text' },
    ],
    about: [
        { name: 'heading', label: 'Heading', type: 'text', placeholder: 'About us' },
        { name: 'body', label: 'Body text', type: 'textarea', placeholder: 'Your story here...' },
        { name: 'ctaText', label: 'CTA text', type: 'text', placeholder: 'Learn more' },
        { name: 'ctaHref', label: 'CTA link', type: 'url', placeholder: 'https://...' },
        { name: 'highlights', label: 'Highlights (one per line)', type: 'array-text' },
    ],
}

/** Returns field specs for a block type, or null if not mapped (shows "Inspector coming soon"). */
export function getFieldSchema(blockType: string): FieldSpec[] | null {
    return SECTION_FIELD_SCHEMA[blockType] ?? null
}

/** Block types that have inspector schemas in MVP. */
export const SCHEMA_SUPPORTED_TYPES = Object.keys(SECTION_FIELD_SCHEMA)

'use client'

import type { BlockProps } from '../types'
import type { WhatsappButtonConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { CONTAINER, INNER_PADDING, SECTION_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'
import { useBlockEditCallback } from '@/components/site-renderer/BlockEditCallbackContext'
import { useInFloatingContainer } from '@/components/site-renderer/FloatingContainerContext'

void _CSS_VARS

const WhatsAppIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
)

// Strip any HTML that may have been stored incorrectly in the label field
function sanitizeLabel(raw: string | undefined): string {
    if (!raw) return 'Chat with us'
    const stripped = raw.replace(/<[^>]*>/g, '').trim()
    return stripped || 'Chat with us'
}

export function WhatsappButtonBlock({ block, theme: _theme }: BlockProps<WhatsappButtonConfig>) {
    void _theme
    const { variant = 'floating', phoneNumber, countryCode, message, label: rawLabel = 'Chat with us', position = 'bottom-right' } = block
    const label = sanitizeLabel(rawLabel)

    const callback = useBlockEditCallback()
    const inContainer = useInFloatingContainer()

    // Build full phone: if stored number already has country code prefix use it as-is, else prepend
    const phoneDigits = (phoneNumber || '').replace(/[^0-9]/g, '')
    const dialDigits = (countryCode || '+60').replace(/[^0-9]/g, '')
    const fullPhone = phoneDigits.startsWith(dialDigits) ? phoneDigits : dialDigits + phoneDigits
    const whatsappUrl = `https://wa.me/${fullPhone}${message ? `?text=${encodeURIComponent(message)}` : ''}`

    // ── Inline variant ─────────────────────────────────────────────────
    if (variant === 'inline') {
        return (
            <section className={SECTION_PADDING.default}>
                <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING} text-center`}>
                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-white text-lg transition-all duration-200 hover:opacity-90 hover:scale-105 shadow-lg ${TOUCH_TARGET.min}`}
                        style={{ backgroundColor: '#25D366' }}
                    >
                        <WhatsAppIcon />
                        <span>{label}</span>
                    </a>
                </div>
            </section>
        )
    }

    // ── Default: floating variant ────────────────────────────────────────
    return (
        <div
            className={inContainer ? '' : `fixed z-50 ${position === 'bottom-left' ? 'left-6' : 'right-6'} bottom-6`}
        >
            <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={callback ? e => e.preventDefault() : undefined}
                data-no-text-edit
                className="relative group flex items-center gap-3 bg-[#25D366] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                aria-label={label}
            >
                {/* Pulse animation ring — hidden in editor to avoid obscuring selection border */}
                {!callback && <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20" />}

                <span data-no-text-edit className="relative flex items-center px-5 py-3">
                    <WhatsAppIcon />
                    <span data-text-editable className="text-sm font-semibold max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-3 transition-all duration-300 whitespace-nowrap">
                        {label}
                    </span>
                </span>
            </a>
        </div>
    )
}

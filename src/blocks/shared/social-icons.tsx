/**
 * Plan 260415 Decision 3 + 8 — shared social icons map dùng cho footer + team blocks.
 *
 * Inline SVG cho platforms lucide-react không có (tiktok, threads, x) + re-export
 * lucide icons cho platforms có sẵn. Mọi platform render với size tiêu chuẩn 16px.
 *
 * Fallback: Link icon từ lucide cho platform unknown (thay vì chữ cái đầu legacy).
 */

import {
    Facebook,
    Instagram,
    Twitter,
    Linkedin,
    Youtube,
    Github,
    Globe,
    Link as LinkIcon,
    Mail,
    Phone,
    MessageCircle,
} from 'lucide-react'
import type { FC, SVGProps } from 'react'

type IconProps = { size?: number } & SVGProps<SVGSVGElement>

// ── Custom SVGs (lucide không có) ───────────────────────────────────────────

export const TikTokIcon: FC<IconProps> = ({ size = 16, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        {...props}
    >
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z" />
    </svg>
)

export const ThreadsIcon: FC<IconProps> = ({ size = 16, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        {...props}
    >
        <path d="M17.9 11.1c-.1 0-.1-.1-.2-.1-.1-2.1-1.3-3.3-3.3-3.4-.9 0-1.7.4-2.2 1.1l.9.6c.4-.5.9-.7 1.4-.7 1 0 1.7.6 1.9 1.7-.7-.1-1.4-.2-2.2-.1-2.1.1-3.5 1.4-3.4 3.1 0 1.7 1.4 2.7 3 2.7 1.4 0 2.5-.6 3.1-1.7.5-.9.5-1.9.3-2.9.5.3.9.8 1.1 1.3.4.9.4 2.3-.7 3.4-1 1-2.2 1.4-4 1.4-1.9 0-3.4-.6-4.4-1.8-.9-1.1-1.4-2.8-1.4-4.9 0-2.1.5-3.7 1.4-4.9 1-1.2 2.5-1.8 4.4-1.8 1.9 0 3.4.6 4.4 1.8.5.6.9 1.4 1.1 2.3l1.1-.3c-.3-1.1-.8-2.1-1.4-2.8-1.3-1.5-3.2-2.2-5.3-2.2C6.5 1.9 3.3 5.4 3.3 12s3.2 10.1 8.5 10.1c2.1 0 3.9-.7 5.3-2 1.6-1.6 1.7-3.7.9-5zm-4 1.4c-.6 0-1.7-.3-1.8-1.3-.1-.8.7-1.3 1.9-1.4.1 0 .3 0 .4 0 .7 0 1.3.1 1.9.2 0 .5-.1 1.7-1 2.1-.4.2-.9.4-1.4.4z" />
    </svg>
)

export const XIcon: FC<IconProps> = ({ size = 16, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        {...props}
    >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
)

export const DiscordIcon: FC<IconProps> = ({ size = 16, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        {...props}
    >
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
)

export const WhatsAppIcon: FC<IconProps> = ({ size = 16, ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        {...props}
    >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
)

// ── SOCIAL_ICONS map ────────────────────────────────────────────────────────
// Key lowercase platform name → component. Unknown platforms fallback to Link icon.

export const SOCIAL_ICONS: Record<string, FC<IconProps>> = {
    facebook: Facebook,
    instagram: Instagram,
    twitter: Twitter,
    x: XIcon,
    linkedin: Linkedin,
    youtube: Youtube,
    github: Github,
    website: Globe,
    globe: Globe,
    tiktok: TikTokIcon,
    threads: ThreadsIcon,
    discord: DiscordIcon,
    whatsapp: WhatsAppIcon,
    email: Mail,
    mail: Mail,
    phone: Phone,
    telegram: MessageCircle,
}

/**
 * Get icon component cho social platform. Fallback về Link icon cho unknown platforms
 * (thay vì chữ cái đầu legacy fallback trong footer/team blocks).
 */
export function getSocialIcon(platform: string | undefined): FC<IconProps> {
    if (!platform) return LinkIcon
    const key = platform.toLowerCase().trim()
    return SOCIAL_ICONS[key] || LinkIcon
}

/**
 * Get aria-label phù hợp cho social link.
 * Email/phone nghe như "Email John" thay vì "Visit email".
 */
export function getSocialAriaLabel(platform: string | undefined, name?: string): string {
    if (!platform) return 'External link'
    const key = platform.toLowerCase().trim()
    if (key === 'email' || key === 'mail') return name ? `Email ${name}` : 'Send email'
    if (key === 'phone') return name ? `Call ${name}` : 'Call phone'
    return name ? `Visit ${name} on ${platform}` : `Visit ${platform}`
}

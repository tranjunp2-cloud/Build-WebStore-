import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { FONT_VARIABLES } from '@/lib/fonts/variables'

export const metadata: Metadata = {
    title: {
        template: '%s | Web Store',
        default: 'Web Store — Build Beautiful Websites in Minutes',
    },
    description:
        'AI-powered website builder for SMEs. Create stunning, SEO-optimized websites with just a few clicks.',
    keywords: ['website builder', 'AI website', 'SME website', 'online store builder'],
    authors: [{ name: 'Web Store' }],
    creator: 'Web Store',
    openGraph: {
        type: 'website',
        locale: 'en_US',
        siteName: 'Web Store',
    },
    twitter: {
        card: 'summary_large_image',
    },
    // Explicit icons reference (overridable by child layouts/pages).
    // favicon.ico is served from public/ as a static asset.
    icons: { icon: '/favicon.ico' },
}

// Plan 260415 nav-bugfix hotfix: add viewport meta so mobile browsers render
// generated template pages at actual device width (375-428px) instead of the
// legacy 980px default. Without this, Tailwind `md:`/`lg:` responsive classes
// fire at the wrong viewport and sections like service-cards / contact / footer
// show desktop multi-column layouts squished into mobile screens (issue reported
// 2026-04-15 on staging).
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
}

/**
 * Root layout — minimal html/body wrapper (required by Next.js).
 *
 * FONT_VARIABLES applied to <html> so --font-* CSS properties are available
 * globally, including portals/modals that render into document.body outside
 * the AppShell subtree (fixes system-ui fallback in portal content).
 * globals.css and non-admin styles remain scoped to AppShell only.
 *
 * Payload CMS admin has its own RootLayout; suppressHydrationWarning prevents conflicts.
 */
export default async function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const cookieStore = await cookies()
    const themeCookie = cookieStore.get('theme')?.value
    // Default dark for backward compat — existing users see no change
    const initialClass = themeCookie === 'light' ? '' : 'dark'

    return (
        <html lang="en" className={`${FONT_VARIABLES}${initialClass ? ` ${initialClass}` : ''}`} suppressHydrationWarning data-scroll-behavior="smooth">
            <head>
                {/*
                  * FOUC prevention — reads localStorage before first paint.
                  * `theme` key: dashboard light/dark (priority).
                  * `pw_theme` key: studio admin theme fallback.
                  * Handles both add (dark) and remove (explicit light) to prevent
                  * cross-route class leakage between studio and dashboard.
                  */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{
var t=localStorage.getItem('theme');
var pw=localStorage.getItem('pw_theme');
var d=localStorage.getItem('pw_density');
var a=localStorage.getItem('pw_accent');
var el=document.documentElement;
if(t==='dark'||(t==null&&pw==='dark')){el.classList.add('dark');}
else if(t==='light'){el.classList.remove('dark');}
if(d&&d!=='default'){el.dataset.density=d;}
if(a&&a!=='blue'){el.dataset.accent=a;}
}catch(e){}})();`,
                    }}
                />
            </head>
            <body>
                {children}
            </body>
        </html>
    )
}

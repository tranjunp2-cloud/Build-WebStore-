import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { AppShell } from '@/components/AppShell'
import { AuthToaster } from './AuthToaster'
import { I18nProvider, Locale } from '@/i18n'
import { ThemeProvider } from '@/providers/theme-provider'

export default async function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const cookieStore = await cookies()
    const cookieValue = cookieStore.get('prefer_lang')?.value
    const localeCookie = (cookieValue === 'en' || cookieValue === 'ms') ? (cookieValue as Locale) : 'en'

    return (
        <AppShell>
            {/* Auth is always dark — force the html class before paint so a
                user who left the CMS in light mode sees no flash of light here. */}
            <script
                dangerouslySetInnerHTML={{
                    __html: `document.documentElement.classList.add('dark')`,
                }}
            />
            <ThemeProvider forcedTheme="dark">
                <I18nProvider defaultLocale={localeCookie}>
                    <div
                        className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8"
                        style={{ background: 'var(--auth-bg)' }}
                    >
                        {/* Animated gradient orbs */}
                        <div className="pointer-events-none fixed inset-0 overflow-hidden">
                            <div className="absolute -left-20 -top-20 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-blue-600/20 to-cyan-500/10 blur-[120px]" />
                            <div className="absolute -bottom-20 -right-20 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-violet-600/15 to-fuchsia-500/10 blur-[120px]" />
                            <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-teal-500/10 to-emerald-500/5 blur-[100px]" />
                        </div>

                        {/* Grid pattern overlay */}
                        <div
                            className="pointer-events-none fixed inset-0 opacity-[0.03]"
                            style={{
                                backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                                backgroundSize: '60px 60px',
                            }}
                        />

                        <div className="relative z-10 w-full max-w-[90vw] sm:max-w-[448px] flex flex-col items-start flex-1" style={{ gap: 28 }}>
                            {/* Logo — Figma: 48×48 rounded-2xl with glow + "Web Store" Inter Bold 24 */}
                            <div className="flex justify-center w-full">
                                <Link href="/" className="group inline-flex items-center gap-3" style={{ textDecoration: 'none' }}>
                                    <Image
                                        src="/icons/auth/logo-primeweb.png"
                                        alt="Web Store Logo"
                                        width={48}
                                        height={48}
                                        className="transition-transform group-hover:scale-105"
                                        style={{
                                            filter: 'drop-shadow(0px 0px 12px rgba(59, 130, 246, 0.5)) drop-shadow(0px 0px 20px rgba(45, 212, 191, 0.25))',
                                        }}
                                        priority
                                    />
                                    <span style={{ color: 'var(--auth-text)', fontFamily: 'Inter, sans-serif', fontSize: 24, fontWeight: 700, lineHeight: '32px', textDecoration: 'none' }}>
                                        Web <span style={{ color: '#00B6CD' }}>Store</span>
                                    </span>
                                </Link>
                            </div>

                            {/* Glassmorphism card — Figma: bg rgba(30,41,59,0.6), border rgba(59,130,246,0.15), r-16, p-33, shadow */}
                            <div
                                className="w-full rounded-2xl p-6 sm:p-[33px] backdrop-blur-xl"
                                style={{
                                    background: 'var(--auth-card-bg)',
                                    border: '1px solid var(--auth-card-border)',
                                    boxShadow: 'var(--auth-card-shadow)',
                                }}
                            >
                                {children}
                            </div>

                            {/* Footer — Figma: Inter 400 12px, #94A3B8, center */}
                            <p className="w-full m-0 text-center text-xs" style={{ fontFamily: 'Inter, sans-serif', lineHeight: '1.33', color: 'var(--auth-footer-color)' }}>
                                © 2026 Web Store. AI-powered website builder for Malaysian SMEs.
                            </p>
                        </div>

                        <AuthToaster />
                    </div>
                </I18nProvider>
            </ThemeProvider>
        </AppShell>
    )
}

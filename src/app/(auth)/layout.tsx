import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { AuthToaster } from './AuthToaster'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { I18nProvider } from '@/i18n'

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AppShell>
            <I18nProvider defaultLocale="en">
                <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0E1A] px-4 py-8">

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

                <div className="relative z-10 w-full max-w-[90vw] sm:max-w-[420px]">
                    {/* Logo */}
                    <div className="mb-8 text-center">
                        <Link href="/" className="group inline-flex items-center gap-2.5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/25 transition-transform group-hover:scale-105">
                                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                    <polyline points="2 17 12 22 22 17" />
                                    <polyline points="2 12 12 17 22 12" />
                                </svg>
                            </div>
                            <span className="text-2xl font-bold tracking-tight text-white">
                                Prime<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Web</span>
                            </span>
                        </Link>
                    </div>

                    {/* Glassmorphism card */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 sm:p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
                        {children}
                    </div>

                    {/* Footer */}
                    <p className="mt-6 text-center text-xs text-gray-500">
                        © 2026 PrimeWeb. AI-powered website builder for Malaysian SMEs.
                    </p>
                </div>

                <AuthToaster />
            </div>
            </I18nProvider>
        </AppShell>
    )
}

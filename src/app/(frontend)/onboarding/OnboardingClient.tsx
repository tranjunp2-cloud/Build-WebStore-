'use client'

import Link from 'next/link'
import { Zap, Sparkles, LayoutTemplate, FileText, ArrowRight, CheckCircle2, MousePointerClick } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OnboardingPage() {
    return (
        <div className="flex min-h-screen flex-col bg-[#0F172A]">
            {/* Top Bar — matching reference design */}
            <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-[#0B1120] px-6">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                        <Zap className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-lg font-semibold text-white">PrimeWeb</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <div className="h-2 w-2 rounded-full bg-slate-600" />
                        <div className="h-2 w-2 rounded-full bg-slate-600" />
                    </div>
                    <span className="ml-2 text-sm font-medium text-slate-400">Step 1/3</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex flex-1 items-center justify-center px-4 py-12">
                <div className="w-full max-w-2xl">
                    {/* Welcome header */}
                    <div className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/25">
                            <Sparkles className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                            Welcome to PrimeWeb!
                        </h1>
                        <p className="mt-3 text-base text-slate-400">
                            Let&apos;s build your professional website. Choose how you want to start.
                        </p>
                    </div>

                    {/* Options */}
                    <div className="mt-10 space-y-4">
                        {/* Option 1: Build with AI — Primary CTA */}
                        <Link
                            href="/builder/new"
                            className="group relative flex items-center gap-5 rounded-xl border-2 border-blue-500/30 bg-blue-500/5 p-5 text-left transition-all hover:border-blue-400/50 hover:bg-blue-500/10 hover:shadow-lg hover:shadow-blue-500/10"
                        >
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                                <Sparkles className="h-7 w-7 text-white" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-semibold text-white group-hover:text-blue-300 transition-colors">
                                        Build with AI
                                    </h3>
                                    <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-blue-400">
                                        Recommended
                                    </span>
                                </div>
                                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                                    Chat with AI to create a professional website in 5 minutes. Just describe your business.
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                    {['No coding needed', 'AI-powered content', '5-min setup'].map((item) => (
                                        <div key={item} className="flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3 text-blue-400/60" />
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                        </Link>

                        {/* Option 2: Choose Template */}
                        <Link
                            href="/templates"
                            className="group flex items-center gap-5 rounded-xl border border-slate-700/50 bg-[#1E293B] p-5 text-left transition-all hover:border-slate-600 hover:bg-[#243044]"
                        >
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-700/50">
                                <LayoutTemplate className="h-7 w-7 text-slate-400 group-hover:text-white transition-colors" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-white">Choose a Template</h3>
                                <p className="mt-1 text-sm text-slate-400">
                                    Browse 100+ ready-made templates. Pick one, customize it, and go live.
                                </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                        </Link>

                        {/* Option 3: Start from Scratch */}
                        <Link
                            href="/editor/new"
                            className="group flex items-center gap-5 rounded-xl border border-slate-700/50 bg-[#1E293B] p-5 text-left transition-all hover:border-slate-600 hover:bg-[#243044]"
                        >
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-700/50">
                                <FileText className="h-7 w-7 text-slate-400 group-hover:text-white transition-colors" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-white">Start from Scratch</h3>
                                <p className="mt-1 text-sm text-slate-400">
                                    Build freely with drag-and-drop blocks. Full control over every detail.
                                </p>
                            </div>
                            <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                        </Link>
                    </div>

                    {/* Skip to dashboard */}
                    <div className="mt-8 text-center">
                        <p className="text-xs text-slate-600">
                            You can always create more websites from the Dashboard.
                        </p>
                        <Link href="/dashboard">
                            <Button
                                variant="ghost"
                                className="mt-2 h-8 text-xs text-slate-500 hover:text-slate-300 hover:bg-transparent"
                            >
                                Skip → Go to Dashboard
                            </Button>
                        </Link>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
                © 2026 PrimeWeb. AI-powered website builder for Malaysian SMEs.
            </footer>
        </div>
    )
}

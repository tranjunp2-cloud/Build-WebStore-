import Link from 'next/link'
import { MousePointerClick, LayoutTemplate, FileText, Sparkles } from 'lucide-react'

export default function OnboardingPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0F172A] px-4">
            <div className="w-full max-w-lg text-center">
                {/* Logo */}
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/25">
                    <MousePointerClick className="h-7 w-7 text-white" />
                </div>

                <h1 className="mt-6 text-3xl font-bold text-white">
                    Welcome to Web Store!
                </h1>
                <p className="mt-2 text-gray-400">
                    Start creating your first website
                </p>

                {/* Options */}
                <div className="mt-10 space-y-4">
                    {/* AI Builder — Primary CTA */}
                    <Link
                        href="/builder/new"
                        className="group flex items-center gap-4 rounded-2xl border-2 border-blue-500/30 bg-blue-500/5 p-5 text-left transition-all hover:border-blue-400 hover:bg-blue-500/10"
                    >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                            <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white group-hover:text-blue-300">
                                Build with AI
                                <span className="ml-2 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] uppercase text-blue-400">
                                    Recommend
                                </span>
                            </h3>
                            <p className="mt-0.5 text-sm text-gray-400">
                                Chat with AI to create a professional website in 5 minutes
                            </p>
                        </div>
                    </Link>

                    {/* Template Gallery */}
                    <Link
                        href="/templates"
                        className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#1E293B] p-5 text-left transition-all hover:border-white/20 hover:bg-[#243044]"
                    >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5">
                            <LayoutTemplate className="h-6 w-6 text-gray-400 group-hover:text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Choose Template</h3>
                            <p className="mt-0.5 text-sm text-gray-400">
                                Browse and customise from ready-made templates
                            </p>
                        </div>
                    </Link>

                    {/* Blank Canvas */}
                    <Link
                        href="/editor/new"
                        className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#1E293B] p-5 text-left transition-all hover:border-white/20 hover:bg-[#243044]"
                    >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5">
                            <FileText className="h-6 w-6 text-gray-400 group-hover:text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Start from Scratch</h3>
                            <p className="mt-0.5 text-sm text-gray-400">
                                Start with a blank canvas, add blocks yourself
                            </p>
                        </div>
                    </Link>
                </div>

                {/* Skip */}
                <p className="mt-8 text-xs text-gray-600">
                    You can create more websites later from the Dashboard
                </p>
                <Link
                    href="/dashboard"
                    className="mt-2 inline-block text-xs text-blue-400 hover:text-blue-300"
                >
                    Skip → Go to Dashboard
                </Link>
            </div>
        </div>
    )
}

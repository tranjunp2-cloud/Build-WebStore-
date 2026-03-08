import Link from 'next/link'
import { Sparkles, LayoutTemplate, Wand2 } from 'lucide-react'

export function DashboardEmptyState() {
    return (
        <div className="mx-auto max-w-2xl">
            {/* Hero card */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-10 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25">
                    <Sparkles className="h-8 w-8 text-white" />
                </div>

                <h2 className="mt-6 text-2xl font-bold text-white">
                    Create your first website
                </h2>
                <p className="mt-3 text-gray-400 leading-relaxed">
                    Just describe your business, AI will create a professional website<br />
                    with complete content in minutes.
                </p>

                {/* Two paths */}
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Link
                        href="/builder/new"
                        className="group flex flex-col items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-6 transition-all hover:border-blue-400/50 hover:bg-blue-500/15 hover:scale-[1.02]"
                    >
                        <div className="rounded-xl bg-blue-500/20 p-3">
                            <Wand2 className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Build with AI</h3>
                            <p className="mt-1 text-xs text-gray-400">Describe → AI builds website</p>
                        </div>
                    </Link>

                    <Link
                        href="/templates"
                        className="group flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-6 transition-all hover:border-white/20 hover:bg-white/10 hover:scale-[1.02]"
                    >
                        <div className="rounded-xl bg-white/10 p-3">
                            <LayoutTemplate className="h-6 w-6 text-gray-300" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Choose Template</h3>
                            <p className="mt-1 text-xs text-gray-400">Ready-made templates, easy to customise</p>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    )
}

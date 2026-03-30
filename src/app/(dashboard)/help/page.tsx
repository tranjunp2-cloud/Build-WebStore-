'use client'

import { Headphones, ExternalLink, MessageCircle, BookOpen } from 'lucide-react'

export default function HelpCenterPage() {
    return (
        <div className="max-w-3xl mx-auto py-8 px-4">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <Headphones className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Help Center</h1>
                    <p className="text-sm text-slate-400">Get help with your PrimeWeb store</p>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <a
                    href="https://primeweb.app/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-slate-800/50 p-5 hover:border-cyan-500/30 transition-colors"
                >
                    <BookOpen className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                            Documentation
                            <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">
                            Guides, tutorials, and API references
                        </p>
                    </div>
                </a>

                <a
                    href="mailto:support@primeweb.app"
                    className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-slate-800/50 p-5 hover:border-cyan-500/30 transition-colors"
                >
                    <MessageCircle className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                            Contact Support
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">
                            Email us at support@primeweb.app
                        </p>
                    </div>
                </a>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-slate-800/50 p-6 text-center">
                <p className="text-slate-400">
                    Full help center coming soon. For urgent issues, please contact our support team.
                </p>
            </div>
        </div>
    )
}

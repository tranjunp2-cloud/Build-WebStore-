import { Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0F172A] px-4">
            {/* Background gradient */}
            <div className="pointer-events-none fixed inset-0">
                <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[100px]" />
                <div className="absolute bottom-0 right-0 h-[400px] w-[400px] translate-x-1/2 translate-y-1/2 rounded-full bg-purple-600/10 blur-[100px]" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="mb-8 flex items-center justify-center gap-2">
                    <Sparkles className="h-7 w-7 text-blue-400" />
                    <Link href="/" className="text-2xl font-bold text-white">
                        PrimeWeb
                    </Link>
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-white/10 bg-[#1E293B]/80 p-8 shadow-2xl backdrop-blur-sm">
                    {children}
                </div>

                {/* Footer */}
                <p className="mt-6 text-center text-xs text-gray-500">
                    © 2026 PrimeWeb by ECH. All rights reserved.
                </p>
            </div>
        </div>
    )
}

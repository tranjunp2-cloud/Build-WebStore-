import Image from 'next/image'
import Link from 'next/link'

export function DashboardEmptyState() {
    return (
        <div className="flex w-full flex-col items-center justify-center py-16 md:py-24">
            <div className="flex flex-col items-center justify-center gap-[18px]">
                {/* Illustration Area */}
                <div className="relative flex items-center justify-center">
                    {/* Background Glow */}
                    <div className="absolute inset-0 bg-[#44DDC1]/20 blur-[60px] rounded-xl" />
                    
                    {/* Rocket Image */}
                    <div className="relative h-[237px] w-[256px]">
                        <Image
                            src="/images/dashboard/rocket-empty-state.png"
                            alt="Rocket launch illustration"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                </div>

                {/* Typography Content */}
                <h2 className="m-0 p-0 text-center text-[30px] font-[800] tracking-[-0.025em] leading-[1.2] text-[#E1E2EB]">
                    No website data available
                </h2>
                <div className="m-0 p-0 text-center text-[16px] font-[500] leading-[1.625] text-[#C1C6D7] whitespace-nowrap">
                    Create your first website to start tracking business performance.
                </div>

                {/* Main Call to Action */}
                <Link
                    href="/builder/new"
                    className="flex w-[447px] no-underline items-center justify-center rounded-[12px] bg-gradient-to-r from-blue-500 to-teal-400 py-[11px] text-[16px] font-semibold text-white shadow-[0px_4px_6px_-4px_rgba(59,130,246,0.3),_0px_10px_15px_-3px_rgba(59,130,246,0.3)] transition-all hover:scale-[1.02]"
                >
                    + Create New Website
                </Link>
            </div>
        </div>
    )
}

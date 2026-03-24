import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Sparkles, ArrowRight } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser, getCurrentTenantId } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function WelcomeScreen() {
    const user = await getCurrentUser()
    if (!user) {
        redirect('/login')
    }

    const tenantId = await getCurrentTenantId()
    
    // Check if user already has a site (BR-01: Redirect đã có site → /dashboard)
    if (tenantId) {
        const payload = await getPayload({ config })
        const sitesResult = await payload.find({ 
            collection: 'sites', 
            where: { tenant: { equals: tenantId } }, 
            limit: 1 
        })
        
        if (sitesResult.totalDocs > 0) {
            redirect('/dashboard')
        }
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B1120] relative">
            <main className="flex flex-1 w-full max-w-2xl flex-col justify-center items-center px-6 text-center pb-32 sm:pb-0">
                
                {/* Logo & Brand Intro */}
                <div className="flex flex-col items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Image 
                            src="/assets/builder/builder-logo.png" 
                            alt="PrimeWeb Logo" 
                            width={48}
                            height={48}
                            priority
                            className="w-[48px] h-[48px] object-contain drop-shadow-[0px_0px_24px_rgba(6,182,212,0.6)] !p-0 !m-0"
                        />
                        <span className="text-2xl font-bold tracking-tight">
                            <span className="text-[#F8FAFC]">Prime</span>
                            <span className="text-[#06B6D4]">Web</span>
                        </span>
                    </div>

                    <div className="space-y-4 mt-4">
                        <h1 className="text-4xl sm:text-5xl font-bold text-slate-50 leading-tight">
                            Welcome to PrimeWeb
                        </h1>
                        <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
                            Start building your store. Complete it in just 5 minutes with our AI.
                        </p>
                    </div>
                </div>

                {/* Progress Sparkle Line */}
                <div className="flex items-center justify-center w-full max-w-sm gap-4 mt-12 mb-12 sm:mt-16 sm:mb-16">
                    <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-transparent via-blue-500/30 to-blue-500/50"></div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/40">
                        <Image src="/assets/builder/sparkle.svg" alt="Sparkle" width={24} height={24} />
                    </div>
                    <div className="h-1 flex-1 rounded-full bg-gradient-to-l from-transparent via-teal-400/30 to-teal-400/50"></div>
                </div>

                {/* Desktop & Mobile Actions (Thumb zone on mobile) */}
                <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center bg-gradient-to-t from-[#0B1120] via-[#0B1120] to-[#0B1120] sm:bg-none pt-12 pb-6 px-0 sm:static sm:p-0 w-full mt-auto sm:mt-0">
                    
                    {/* Mobile Progress Text (from mobile wireframe) */}
                    <div className="mb-4 text-sm font-medium text-slate-400 sm:hidden">
                        Step 1 of 2: Create Store
                    </div>

                    <Link 
                        href="/builder/new" 
                        prefetch={true}
                        className="group flex h-[64px] sm:h-[56px] w-full sm:max-w-[448px] items-center justify-center gap-2 rounded-none sm:rounded-2xl bg-gradient-to-r from-blue-500 to-teal-400 text-lg font-semibold text-white shadow-[0_0_24px_rgba(59,130,246,0.4)] transition-all hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(45,212,191,0.5)] active:scale-[0.98]"
                    >
                        <span>🚀 Create My Store with AI</span>
                        <ArrowRight className="h-5 w-5 opacity-70 group-hover:translate-x-1 group-hover:opacity-100 transition-transform hidden sm:block" />
                    </Link>

                    <Link 
                        href="/dashboard"
                        className="mt-6 text-sm font-medium text-slate-500 transition-colors hover:text-slate-300"
                    >
                        Skip &amp; Go to Dashboard
                    </Link>
                </div>
            </main>
        </div>
    )
}

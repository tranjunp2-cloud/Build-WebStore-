import type { ReactNode } from 'react'
import { Rocket } from 'lucide-react'

/** Assistant message in the builder chat column (rocket avatar + glass bubble). */
export function BuilderChatBubble({ children }: { children: ReactNode }) {
    return (
        <div className="bld-in flex items-start gap-3">
            <span className="mt-1 flex size-8 flex-none items-center justify-center rounded-full text-white [background-image:linear-gradient(135deg,#3b82f6,#2dd4bf)]">
                <Rocket aria-hidden className="size-3.5" />
            </span>
            <div className="rounded-xl border border-solid border-[rgba(148,163,184,.13)] px-4 py-[11px] text-[13px] leading-5 text-[#e2e8f0] shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_10px_24px_-12px_rgba(0,0,0,.6)] backdrop-blur-[12px] [background:linear-gradient(160deg,rgba(51,65,85,.42),rgba(30,41,59,.32))]">
                {children}
            </div>
        </div>
    )
}

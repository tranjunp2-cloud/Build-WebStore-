'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export function SettingHelp({ label, children }: { label: string; children: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    return <TooltipProvider delayDuration={200}>
        <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger asChild>
                <button type="button" aria-label={label} onClick={event => { event.preventDefault(); event.stopPropagation(); setOpen(true) }} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--editor-text-muted)] hover:text-[var(--editor-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Info className="h-4 w-4" aria-hidden="true" />
                </button>
            </TooltipTrigger>
            <TooltipContent>{children}</TooltipContent>
        </Tooltip>
    </TooltipProvider>
}

'use client'

import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/providers/theme-provider'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
    const { theme } = useTheme()
    return (
        <Sonner
            theme={theme}
            className="toaster group"
            style={{ '--width': 'min(420px, calc(100vw - 32px))' } as React.CSSProperties}
            toastOptions={{
                classNames: {
                    // text-white and border-white/10 use lower specificity (no group variant)
                    // so success/error group-[.toaster]: overrides win correctly
                    // GH-1538 #12: this shared default is used by auth/editor/checkout Toaster
                    // instances — kept at the original 420px. The CMS dashboard's own Toaster
                    // (CMSLayoutClient.tsx) passes its own style/toastOptions that fully override
                    // these (props spread, not merged), so it's tuned separately (300px) there.
                    toast: 'group toast group-[.toaster]:bg-[hsl(var(--popover)/0.97)] text-[hsl(var(--popover-foreground))] border-[hsl(var(--border))] group-[.toaster]:shadow-[0_4px_6px_rgba(0,0,0,0.1)] group-[.toaster]:rounded-[8px] group-[.toaster]:font-medium group-[.toaster]:text-[13px] group-[.toaster]:leading-[1.5em] group-[.toaster]:tracking-tight group-[.toaster]:py-[17px] group-[.toaster]:px-[14px]',
                    success: 'group-[.toaster]:border-[hsl(var(--success))] group-[.toaster]:text-[hsl(var(--success))] [&_svg]:text-[hsl(var(--success))]',
                    error: 'group-[.toaster]:border-[hsl(var(--destructive))] group-[.toaster]:text-[hsl(var(--destructive))] [&_svg]:text-[hsl(var(--destructive))]',
                    description: 'group-[.toast]:text-muted-foreground',
                    actionButton:
                        'group-[.toast]:bg-blue-600 group-[.toast]:text-white',
                    cancelButton:
                        'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
                },
            }}
            {...props}
        />
    )
}

export { Toaster }

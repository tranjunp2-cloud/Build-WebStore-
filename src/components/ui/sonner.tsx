'use client'

import { Toaster as Sonner } from 'sonner'
import { useTheme } from '@/providers/theme-provider'
import { MascotAvatar } from '@/mascot'

// Success and error toasts carry the mascot's reaction, ringed green / red so the outcome still reads
// at 20px. Passive: a toast never downloads the 3D runtime — the check / alert icon stays unless a
// robot elsewhere on the page already loaded it.
const MASCOT_ICONS: ToasterProps['icons'] = {
    success: <MascotAvatar state="success" size={20} follow={false} passive fallback={<SuccessDot />} />,
    error: <MascotAvatar state="error" size={20} follow={false} passive fallback={<ErrorDot />} />,
}

function SuccessDot() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" aria-hidden="true">
            <path d="M5 12.5 10 17l9-10" />
        </svg>
    )
}

function ErrorDot() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" aria-hidden="true">
            <path d="M12 7v6M12 17h.01" />
        </svg>
    )
}

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
    const { theme } = useTheme()
    return (
        <Sonner
            theme={theme}
            className="toaster group"
            icons={MASCOT_ICONS}
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

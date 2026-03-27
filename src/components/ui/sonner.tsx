'use client'

import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            theme="dark"
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast: 'group toast group-[.toaster]:bg-[#1E293B]/95 group-[.toaster]:text-white group-[.toaster]:border-white/10 group-[.toaster]:shadow-[0_4px_12px_rgba(0,0,0,0.1)] group-[.toaster]:rounded-lg group-[.toaster]:font-medium group-[.toaster]:text-[13px] group-[.toaster]:leading-[1.5em] group-[.toaster]:tracking-tight group-[.toaster]:py-[17px] group-[.toaster]:px-[14px]',
                    success: 'group-[.toaster]:border-[#10B981] group-[.toaster]:text-[#10B981] [&_svg]:text-[#10B981]',
                    error: 'group-[.toaster]:border-[#EF4444] group-[.toaster]:text-[#EF4444] [&_svg]:text-[#EF4444]',
                    description: 'group-[.toast]:text-gray-400',
                    actionButton:
                        'group-[.toast]:bg-blue-600 group-[.toast]:text-white',
                    cancelButton:
                        'group-[.toast]:bg-zinc-800 group-[.toast]:text-gray-400',
                },
            }}
            {...props}
        />
    )
}

export { Toaster }

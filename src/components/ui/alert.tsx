import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

// Tinted panel + 1px solid border. Colors come from the theme palette channels
// (`hsl(var(--x)/α)`) so light/dark both follow the tokens. Preflight is OFF, so
// `border-solid` is declared explicitly.
const alertVariants = cva(
    'flex items-start gap-3 rounded-lg border border-solid px-4 py-3.5',
    {
        variants: {
            variant: {
                info: 'border-[hsl(var(--info))] bg-[hsl(var(--info)/0.08)]',
                success: 'border-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)]',
                warning: 'border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)]',
                destructive: 'border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.08)]',
            },
        },
        defaultVariants: { variant: 'info' },
    },
)

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>['variant']>

const ICONS: Record<AlertVariant, LucideIcon> = {
    info: Info,
    success: CircleCheck,
    warning: TriangleAlert,
    destructive: CircleAlert,
}

const ICON_COLORS: Record<AlertVariant, string> = {
    info: 'text-[hsl(var(--info))]',
    success: 'text-[hsl(var(--success))]',
    warning: 'text-[hsl(var(--warning))]',
    destructive: 'text-[hsl(var(--destructive))]',
}

export interface AlertProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
    ({ className, variant = 'info', children, ...props }, ref) => {
        const key: AlertVariant = variant ?? 'info'
        const Icon = ICONS[key]
        return (
            <div ref={ref} role="status" className={cn(alertVariants({ variant }), className)} {...props}>
                <Icon aria-hidden className={cn('mt-0.5 h-5 w-5 shrink-0', ICON_COLORS[key])} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
            </div>
        )
    },
)
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('text-sm font-semibold leading-5 text-[var(--dash-text)]', className)} {...props} />
    ),
)
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('text-[13px] leading-5 text-[var(--dash-text-muted)]', className)} {...props} />
    ),
)
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription, alertVariants }

import { cn } from '@/lib/utils'

function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'animate-shimmer rounded-lg bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%]',
                className,
            )}
            {...props}
        />
    )
}

export { Skeleton }

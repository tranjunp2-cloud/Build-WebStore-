import { CircleAlert, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

const ICON = { danger: CircleAlert, warn: TriangleAlert, info: Info }

interface Props {
    tone: 'danger' | 'warn' | 'info'
    title: string
    children?: ReactNode
    actions?: ReactNode
}

/** Problem banner: red = something stopped working, amber = works but degraded, grey = information. */
export function Banner({ tone, title, children, actions }: Props) {
    const Icon = ICON[tone]
    return (
        <div className="pm-banner" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
            <Icon className="pm-ic" aria-hidden="true" />
            <div><b>{title}</b>{children ? <p>{children}</p> : null}</div>
            {actions ? <div className="pm-banner-act">{actions}</div> : null}
        </div>
    )
}

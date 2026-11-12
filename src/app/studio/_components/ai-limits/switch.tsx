'use client'

import type { ReactNode } from 'react'

interface Props {
    checked: boolean | 'mixed'
    onChange: (next: boolean) => void
    children: ReactNode
    disabled?: boolean
    id?: string
    labelledBy?: string
}

/** Accessible on/off switch (button role=switch). Mixed = on for some, off for others; a click turns all on. */
export function Switch({ checked, onChange, children, disabled, id, labelledBy }: Props) {
    return (
        <button
            type="button" role="switch" id={id} aria-checked={checked} aria-labelledby={labelledBy} disabled={disabled}
            className="acl-switch" onClick={() => onChange(checked === 'mixed' ? true : !checked)}
        >
            <i />
            <span>{children}</span>
        </button>
    )
}

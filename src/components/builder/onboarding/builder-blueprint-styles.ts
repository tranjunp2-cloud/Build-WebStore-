import { cn } from '@/lib/utils'

// Shared style helpers for the info-step live blueprint (BuilderBlueprintPreview).

export type BlueprintField = 'businessName' | 'industry' | 'products' | 'shortDescription'

export interface BlueprintState {
    focus: BlueprintField | null
    errors: Partial<Record<BlueprintField, string>>
}

const TRANSITION = 'transition-[border-color,background-color,box-shadow,color] duration-200'

/** Dashed placeholder chip for a field that is still empty: glows when focused, red after a failed submit. */
export function slotClass(state: BlueprintState, field: BlueprintField, extra?: string): string {
    const on = state.focus === field
    const error = !!state.errors[field]
    return cn(
        'inline-flex h-[18px] max-w-full items-center truncate whitespace-nowrap rounded-[5px] border px-[7px] text-[10px] font-medium leading-[14px]',
        TRANSITION,
        on ? 'border-solid' : 'border-dashed',
        error
            ? 'border-[rgba(248,113,113,0.75)] bg-[rgba(239,68,68,0.1)] text-[#fca5a5]'
            : on
              ? 'border-[#38bdf8] bg-[rgba(56,189,248,0.16)] text-[#f0f9ff] shadow-[0_0_0_3px_rgba(56,189,248,0.12),0_0_16px_rgba(56,189,248,0.3)]'
              : 'border-[rgba(56,189,248,0.5)] bg-[rgba(56,189,248,0.06)] text-[#7dd3fc]',
        extra,
    )
}

/** Highlight for filled text while its source field is focused. */
export function liveClass(state: BlueprintState, field: BlueprintField): string {
    return cn(
        'rounded transition-[background-color,box-shadow] duration-200',
        state.focus === field
            ? 'bg-[rgba(56,189,248,0.12)] shadow-[0_0_0_1px_rgba(56,189,248,0.65)]'
            : 'shadow-[0_0_0_1px_rgba(56,189,248,0)]',
    )
}

export const SECTION_CLASS =
    'relative rounded-md border border-dashed border-[rgba(148,163,184,0.22)] bg-[rgba(148,163,184,0.025)]'

export const BAR_CLASS = 'block shrink-0 rounded-full'

/** Split the products textarea into display chips (comma / newline / semicolon separated). */
export function productChips(products: string): string[] {
    return products
        .split(/[,\n;]+/)
        .map((item) => item.trim())
        .filter(Boolean)
}

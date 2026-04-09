/** Shared types for the editor system */

export type BlockData = { blockType: string } & Record<string, unknown>

export type ThemeData = Record<string, unknown>

export type AIAction = {
    action: 'update_block' | 'update_theme' | 'add_block' | 'delete_block' | 'undo' | 'reorder_block'
    changes?: Record<string, unknown>
    blockIndex?: number
    afterIndex?: number
    block?: BlockData
    message?: string
}

export type CtaButton = { label?: string; url?: string; variant?: string }
export type NavLink = { label?: string; url?: string }
export type FeatureItem = { title?: string; description?: string; icon?: string }
export type TestimonialItem = { name?: string; title?: string; quote?: string; rating?: number }
export type FooterColumn = { title?: string; links?: NavLink[] }

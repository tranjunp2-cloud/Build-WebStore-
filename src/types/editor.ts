/** Shared types for the editor system */

export type BlockData = { blockType: string } & Record<string, unknown>

export type ThemeData = Record<string, unknown>

export type AIAction = {
    action: 'update_block' | 'update_multiple_blocks' | 'update_theme' | 'add_block' | 'delete_block' | 'undo' | 'reorder_block'
    changes?: Record<string, unknown>
    blockIndex?: number
    afterIndex?: number
    block?: BlockData
    message?: string
    // Multi-block updates (used with update_multiple_blocks)
    updates?: { blockIndex: number; changes: Record<string, unknown> }[]
}

export type CtaButton = { label?: string; url?: string; style?: 'primary' | 'secondary' | 'outline' | 'ghost' }
export type NavLink = { label?: string; url?: string; style?: 'internal' | 'external' }
export type FeatureItem = { title?: string; description?: string; icon?: string }
export type TestimonialItem = { name?: string; title?: string; quote?: string; rating?: number }
export type FooterColumn = { title?: string; links?: NavLink[] }

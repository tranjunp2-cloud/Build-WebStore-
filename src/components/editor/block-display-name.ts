// Block types whose editor-facing name differs from the kebab-case type id.
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
    'custom-html': 'Rich text',
}

/** Name shown to editors for a block type, e.g. `custom-html` → `Rich text`, `hero-banner` → `hero banner`. */
export function getBlockDisplayName(blockType: string): string {
    return DISPLAY_NAME_OVERRIDES[blockType] ?? blockType.replace(/-/g, ' ')
}

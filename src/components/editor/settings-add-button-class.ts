/**
 * Colors for the "+ Add ..." buttons in the block settings sidebar (GH-2115).
 * Primary (teal) tint like VariantChip; light-mode text stays --editor-text because
 * light primary on white is too low-contrast.
 */
export const SETTINGS_ADD_BUTTON_COLORS =
    'bg-[hsl(var(--primary)/0.1)] text-[var(--editor-text)] dark:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.2)]'

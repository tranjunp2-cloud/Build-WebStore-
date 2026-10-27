// Shared keyboard-focus recipes (kept under components/ so Tailwind scans the class strings).

/** Teal ring with an offset gap painted in the page background, in both themes. */
export const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]'

/** Builder onboarding is always on the dark #0b1120 surface, so its teal is pinned to the dark-theme value. */
export const BUILDER_FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--p-teal-400))] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1120]'

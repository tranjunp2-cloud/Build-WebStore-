'use client'

/**
 * GoogleFontsLoader — dynamically loads Google Fonts based on theme config.
 * Renders a <link> tag to fetch font files from Google Fonts API.
 * Deduplicates fonts and includes Vietnamese subset for proper diacritic rendering.
 */

export function GoogleFontsLoader({
    fontHeading,
    fontBody,
}: {
    fontHeading?: string
    fontBody?: string
}) {
    // Sanitize font names: strip anything that isn't alphanumeric, space, or hyphen
    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9 -]/g, '')

    const heading = sanitize(fontHeading || 'Outfit') || 'Outfit'
    const body = sanitize(fontBody || 'Inter') || 'Inter'

    // Deduplicate fonts
    const fonts = [heading, body].filter((v, i, a) => a.indexOf(v) === i)

    // Build Google Fonts URL with Vietnamese subset
    const params = fonts
        .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@300;400;500;600;700;800;900`)
        .join('&')
    const href = `https://fonts.googleapis.com/css2?${params}&subset=latin,vietnamese&display=swap`

    return (
        <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
            <link href={href} rel="stylesheet" />
        </>
    )
}

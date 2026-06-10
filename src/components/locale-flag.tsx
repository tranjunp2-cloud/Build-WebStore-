// Cross-platform locale flag. Windows lacks the regional-indicator emoji flag glyphs
// (🇬🇧🇲🇾 render as letters/boxes), so we draw the country's SVG (country-flag-icons)
// instead. Falls back to a globe glyph for codeless locales (Esperanto, Uyghur, unknown).

import { Globe } from 'lucide-react'
import * as Flags from 'country-flag-icons/react/3x2'
import { getLocaleLabel } from '@/lib/locale-labels'

type FlagComponent = React.ComponentType<{ title?: string; className?: string }>

// Regional-indicator flag emoji → ISO 3166-1 alpha-2 code (e.g. "🇬🇧" → "GB").
// Returns null for non-flag glyphs like 🌐 (single code point).
function flagEmojiToCode(flag: string): string | null {
    const cps = Array.from(flag).map(c => c.codePointAt(0) ?? 0)
    if (cps.length !== 2) return null
    const BASE = 0x1f1e6 // regional indicator 'A'
    const a = cps[0] - BASE
    const b = cps[1] - BASE
    if (a < 0 || a > 25 || b < 0 || b > 25) return null
    return String.fromCharCode(65 + a) + String.fromCharCode(65 + b)
}

export function LocaleFlag({ locale, className }: { locale: string; className?: string }) {
    const { flag, short } = getLocaleLabel(locale)
    const code = flagEmojiToCode(flag)
    const Flag = code ? (Flags as Record<string, FlagComponent>)[code] : undefined
    // Fallback: lucide Globe SVG (not the 🌐 emoji) so codeless locales also render on every OS.
    if (!Flag) return <Globe className={className} aria-label={short} />
    return <Flag className={className} title={short} />
}

/**
 * AppShell — style wrapper for non-Payload routes.
 * Imports globals.css (Tailwind) here so it ONLY applies to non-admin routes.
 * Root layout provides <html> and <body> — this is just a style boundary.
 *
 * Google Fonts are loaded here via `next/font/google` so they:
 * 1. Apply only to non-admin routes (Payload admin has its own fonts)
 * 2. Set CSS variables (`--font-<name>`) consumed by theme resolver
 *
 * Fonts cover every pairing in `src/lib/fonts/pairings.ts` (20 pairings).
 * Strategy: ship full via `display: swap` — monitored via Lighthouse FCP
 * post-deploy. If bundle delta > 500KB or FCP regresses > 100ms, fall back
 * to lazy dynamic import per pairing (Phase 2 optimization).
 *
 * Reference: plans/260412-2300-design-quality-rules/phase-02-typography.md
 */
import '../app/globals.css'
import {
    Inter,
    Outfit,
    Lora,
    Playfair_Display,
    Space_Grotesk,
    Nunito,
    Nunito_Sans,
    Oswald,
    Source_Sans_3,
    Cormorant_Garamond,
    Proza_Libre,
    DM_Sans,
    Sora,
    Work_Sans,
    Raleway,
    Poppins,
    Lato,
    Open_Sans,
    Karla,
    Archivo_Black,
    DM_Mono,
    Merriweather,
    Source_Serif_4,
    Varela_Round,
    Manrope,
    Rajdhani,
    Exo_2,
    Josefin_Sans,
    Quicksand,
    Montserrat,
    Hind,
} from 'next/font/google'

// ── Primary Fonts (Vietnamese subset support) ────────────────────────────────

const inter = Inter({
    subsets: ['latin', 'vietnamese'],
    variable: '--font-inter',
    display: 'swap',
})

const outfit = Outfit({
    subsets: ['latin', 'latin-ext'],
    variable: '--font-outfit',
    display: 'swap',
})

// ── Pairing Fonts (loaded for all 20 FontPairings) ───────────────────────────

const lora = Lora({ subsets: ['latin', 'vietnamese'], variable: '--font-lora', display: 'swap' })
const playfairDisplay = Playfair_Display({ subsets: ['latin', 'vietnamese'], variable: '--font-playfair-display', display: 'swap' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' })
const nunito = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-nunito', display: 'swap' })
const nunitoSans = Nunito_Sans({ subsets: ['latin', 'vietnamese'], variable: '--font-nunito-sans', display: 'swap' })
const oswald = Oswald({ subsets: ['latin', 'vietnamese'], variable: '--font-oswald', display: 'swap' })
const sourceSans3 = Source_Sans_3({ subsets: ['latin', 'vietnamese'], variable: '--font-source-sans-3', display: 'swap' })
const cormorantGaramond = Cormorant_Garamond({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700'], variable: '--font-cormorant-garamond', display: 'swap' })
const prozaLibre = Proza_Libre({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-proza-libre', display: 'swap' })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' })
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' })
const workSans = Work_Sans({ subsets: ['latin', 'vietnamese'], variable: '--font-work-sans', display: 'swap' })
const raleway = Raleway({ subsets: ['latin', 'vietnamese'], variable: '--font-raleway', display: 'swap' })
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-poppins', display: 'swap' })
const lato = Lato({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'], variable: '--font-lato', display: 'swap' })
const openSans = Open_Sans({ subsets: ['latin', 'vietnamese'], variable: '--font-open-sans', display: 'swap' })
const karla = Karla({ subsets: ['latin'], variable: '--font-karla', display: 'swap' })
const archivoBlack = Archivo_Black({ subsets: ['latin', 'latin-ext'], weight: ['400'], variable: '--font-archivo-black', display: 'swap' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-dm-mono', display: 'swap' })
const merriweather = Merriweather({ subsets: ['latin', 'vietnamese'], weight: ['300', '400', '700', '900'], variable: '--font-merriweather', display: 'swap' })
const sourceSerif4 = Source_Serif_4({ subsets: ['latin', 'vietnamese'], variable: '--font-source-serif-4', display: 'swap' })
const varelaRound = Varela_Round({ subsets: ['latin', 'vietnamese'], weight: ['400'], variable: '--font-varela-round', display: 'swap' })
const manrope = Manrope({ subsets: ['latin', 'vietnamese'], variable: '--font-manrope', display: 'swap' })
const rajdhani = Rajdhani({ subsets: ['latin', 'latin-ext', 'devanagari'], weight: ['300', '400', '500', '600', '700'], variable: '--font-rajdhani', display: 'swap' })
const exo2 = Exo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-exo-2', display: 'swap' })
const josefinSans = Josefin_Sans({ subsets: ['latin', 'vietnamese'], variable: '--font-josefin-sans', display: 'swap' })
const quicksand = Quicksand({ subsets: ['latin', 'vietnamese'], variable: '--font-quicksand', display: 'swap' })
const montserrat = Montserrat({ subsets: ['latin', 'vietnamese'], variable: '--font-montserrat', display: 'swap' })
const hind = Hind({ subsets: ['latin', 'latin-ext'], weight: ['300', '400', '500', '600', '700'], variable: '--font-hind', display: 'swap' })

// ── CSS variable aggregator ──────────────────────────────────────────────────
// All loaded fonts expose a CSS var so theme resolver can reference any of them.

const FONT_VARIABLES = [
    inter.variable,
    outfit.variable,
    lora.variable,
    playfairDisplay.variable,
    spaceGrotesk.variable,
    nunito.variable,
    nunitoSans.variable,
    oswald.variable,
    sourceSans3.variable,
    cormorantGaramond.variable,
    prozaLibre.variable,
    dmSans.variable,
    sora.variable,
    workSans.variable,
    raleway.variable,
    poppins.variable,
    lato.variable,
    openSans.variable,
    karla.variable,
    archivoBlack.variable,
    dmMono.variable,
    merriweather.variable,
    sourceSerif4.variable,
    varelaRound.variable,
    manrope.variable,
    rajdhani.variable,
    exo2.variable,
    josefinSans.variable,
    quicksand.variable,
    montserrat.variable,
    hind.variable,
].join(' ')

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div className={`${FONT_VARIABLES} font-sans antialiased`}>
            {children}
        </div>
    )
}

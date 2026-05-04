/**
 * Smoke test for category theme picker wiring (phase-08 audit).
 * Runs resolveComposerCategory + pickCategoryTheme for 10 canonical businesses
 * and prints the resulting theme so you can eyeball the distribution without
 * booting a dev server or hitting OpenAI.
 *
 * Usage: pnpm exec tsx scripts/ai/smoke-category-theme.ts
 */

import { resolveComposerCategory } from '../../src/lib/ai/composer-category-resolver'
import { pickCategoryTheme, hashBusinessName } from '../../src/lib/ai/category-theme-picker'
import { resolveFontPairing } from '../../src/lib/ai/font-pairings'

type Case = {
    businessName: string
    industry: string
    products: string
    shortDescription: string
    expectedCategory?: string
}

const CASES: Case[] = [
    {
        businessName: 'Pho Hong Vietnam',
        industry: 'Restaurant',
        products: 'Pho, bun bo, banh mi',
        shortDescription: 'Authentic Saigon street-food restaurant in KL',
        expectedCategory: 'restaurant',
    },
    {
        businessName: 'Bo Bo Spa Wellness',
        industry: 'Beauty & Spa',
        products: 'Facial, massage, nail, lash',
        shortDescription: 'Luxury spa + wellness retreat, Bangsar',
        expectedCategory: 'beauty',
    },
    {
        businessName: 'CloudBase Labs',
        industry: 'Tech / SaaS',
        products: 'API platform, cloud dashboard, SDK',
        shortDescription: 'Developer tools for edge deployment',
        expectedCategory: 'tech',
    },
    {
        businessName: 'Saigon Dental Clinic',
        industry: 'Health',
        products: 'Dental implants, braces, teeth whitening',
        shortDescription: '10-year dental clinic, Thu Duc',
        expectedCategory: 'health',
    },
    {
        businessName: 'Saigon Premier Realty',
        industry: 'Real Estate',
        products: 'Condo, apartment, land listings',
        shortDescription: 'Premium property agency District 2',
        expectedCategory: 'realestate',
    },
    {
        businessName: 'FlexFit 247',
        industry: 'Fitness Gym',
        products: 'CrossFit classes, yoga, personal trainer',
        shortDescription: '24-hour gym with women-only area',
        expectedCategory: 'fitness',
    },
    {
        businessName: 'BrewLab Kopitiam',
        industry: 'Cafe',
        products: 'Specialty coffee, kaya toast, nasi lemak',
        shortDescription: 'Modern kopitiam in Petaling Jaya',
        expectedCategory: 'fnb',
    },
    {
        businessName: 'LittleMinds Kindergarten',
        industry: 'Education',
        products: 'Montessori, bilingual kindergarten, tuition',
        shortDescription: 'Bilingual kindergarten for ages 3-6',
        expectedCategory: 'education',
    },
    {
        businessName: 'Orchid Garden Weddings',
        industry: 'Events / Wedding',
        products: 'Wedding planning, venue, photography',
        shortDescription: 'Full-service wedding planner in KL',
        expectedCategory: 'events',
    },
    {
        businessName: 'Halong Explorer Tours',
        industry: 'Travel',
        products: 'Halong Bay cruise, Hanoi day tour, homestay',
        shortDescription: 'Boutique tour agency, Hanoi',
        expectedCategory: 'travel',
    },
]

function ansi(hex: string, text: string): string {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    // Foreground = white if dark, black if light
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    const fg = brightness > 128 ? '30' : '97'
    return `\x1b[48;2;${r};${g};${b}m\x1b[${fg}m ${text} \x1b[0m`
}

let passCount = 0
let failCount = 0

console.log('\n=== Category Theme Picker Smoke ===\n')
console.log('Goal: verify AI happy path theme override yields category-appropriate colors.\n')

for (const tc of CASES) {
    const promptText = [tc.businessName, tc.industry, tc.shortDescription, tc.products].join(' | ')
    const category = resolveComposerCategory(promptText)
    const seed = hashBusinessName(tc.businessName)
    const preset = pickCategoryTheme(category, seed)
    const fontPair = resolveFontPairing(preset.fontPairingId)

    const match = tc.expectedCategory ? category === tc.expectedCategory : true
    if (match) passCount++
    else failCount++

    const status = match ? '\x1b[32mOK\x1b[0m' : '\x1b[31mFAIL\x1b[0m'

    console.log(`${status}  ${tc.businessName.padEnd(26)}  →  category=${category.padEnd(11)} preset="${preset.name}"`)
    console.log(
        `      ${ansi(preset.primaryColor, 'primary ' + preset.primaryColor)} ` +
            `${ansi(preset.secondaryColor, 'secondary ' + preset.secondaryColor)} ` +
            `${ansi(preset.accentColor, 'accent ' + preset.accentColor)}`,
    )
    console.log(
        `      fonts=${fontPair.fontHeading} + ${fontPair.fontBody}  ` +
            `mode=${preset.colorMode}  spacing=${preset.spacingPreset}  radius=${preset.borderRadius}  shadow=${preset.shadowPreset}`,
    )
    if (!match) {
        console.log(`      \x1b[31mexpected category=${tc.expectedCategory}\x1b[0m`)
    }
    console.log()
}

console.log(`\nResult: ${passCount}/${CASES.length} category resolutions correct (${failCount} mismatch)`)

// Determinism guard — run the first case 3 times, presets must be identical.
console.log('\n--- Determinism check ---')
const first = CASES[0]!
const promptText = [first.businessName, first.industry, first.shortDescription, first.products].join(' | ')
const category = resolveComposerCategory(promptText)
const seed = hashBusinessName(first.businessName)
const p1 = pickCategoryTheme(category, seed)
const p2 = pickCategoryTheme(category, seed)
const p3 = pickCategoryTheme(category, seed)
const stable = p1.name === p2.name && p2.name === p3.name
console.log(`${first.businessName}: 3 runs → ${p1.name}, ${p2.name}, ${p3.name}  ${stable ? '\x1b[32m✓ stable\x1b[0m' : '\x1b[31m✗ DRIFT\x1b[0m'}`)

// Variation guard — 50 random businesses in the restaurant category must touch ≥3 presets.
console.log('\n--- Variation check ---')
const names = new Set<string>()
for (let i = 0; i < 50; i++) {
    names.add(pickCategoryTheme('restaurant', hashBusinessName(`random-resto-${i}`)).name)
}
console.log(`50 random restaurants → ${names.size} distinct presets: ${[...names].join(', ')}`)
console.log(names.size >= 3 ? '\x1b[32m✓ distribution healthy\x1b[0m' : '\x1b[31m✗ skewed distribution\x1b[0m')

process.exit(failCount === 0 && stable && names.size >= 3 ? 0 : 1)

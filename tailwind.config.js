/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/blocks/**/*.{js,ts,jsx,tsx,mdx}',
        // Exclude (payload) admin to avoid @layer conflicts with Payload CSS
        './src/app/(auth)/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/(builder)/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/(dashboard)/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/(editor)/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/(frontend)/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/(preview)/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/studio/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/sites/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/templates/**/*.{js,ts,jsx,tsx,mdx}',
        './src/lib/admin/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                // Theme-aware chain — MUST use nested var() fallbacks, not a
                // flat comma list. Reason: when --font-body/heading is unset
                // (dashboard, auth, builder, editor — anywhere generateThemeCSS
                // does NOT run), a flat `var(--font-body), var(--font-inter)`
                // substitutes to an empty leading token, making the whole
                // font-family declaration invalid-at-computed-value-time, so
                // the browser reverts to the UA default (serif).
                //   1. --font-body/heading — populated by generateThemeCSS()
                //      per site, references the chosen pairing's next/font var
                //   2. --font-inter/outfit — always loaded in AppShell.tsx,
                //      safe fallback when no theme CSS present (admin routes)
                //   3. System fallback
                sans: ['var(--font-body, var(--font-inter))', 'system-ui', 'sans-serif'],
                heading: ['var(--font-heading, var(--font-outfit))', 'system-ui', 'sans-serif'],
                // Keep identical to 'sans' — AppShell uses font-sans, Typography blocks use font-body; both must track --font-body
                body: ['var(--font-body, var(--font-inter))', 'system-ui', 'sans-serif'],
            },
            colors: {
                // Dashboard semantic color tokens — light/dark via CSS vars on :root / .dark
                dash: {
                    bg: 'var(--dash-bg)',
                    surface: 'var(--dash-surface)',
                    'surface-hover': 'var(--dash-surface-hover)',
                    text: 'var(--dash-text)',
                    'text-muted': 'var(--dash-text-muted)',
                    border: 'var(--dash-border)',
                    accent: 'var(--dash-accent)',
                    overlay: 'var(--dash-overlay)',
                    'secondary-bg': 'var(--dash-secondary-bg)',
                },
                // Studio admin CSS-var bridge tokens (scoped via .studio-shell)
                // These allow using Tailwind classes like bg-studio-bg, text-studio-text etc.
                // Actual values are set in studio.css; Tailwind just wires the var() references.
                studio: {
                    bg: 'var(--bg)',
                    'bg-elev': 'var(--bg-elev)',
                    'bg-sunk': 'var(--bg-sunk)',
                    border: 'var(--border)',
                    'border-strong': 'var(--border-strong)',
                    text: 'var(--text)',
                    'text-2': 'var(--text-2)',
                    'text-3': 'var(--text-3)',
                    accent: 'var(--accent)',
                    'accent-hover': 'var(--accent-hover)',
                    success: 'var(--success)',
                    danger: 'var(--danger)',
                    warn: 'var(--warn)',
                },
                brand: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                    950: '#082f49',
                },
                accent: {
                    50: '#fdf4ff',
                    100: '#fae8ff',
                    200: '#f5d0fe',
                    300: '#f0abfc',
                    400: '#e879f9',
                    500: '#d946ef',
                    600: '#c026d3',
                    700: '#a21caf',
                    800: '#86198f',
                    900: '#701a75',
                },
                // GH-1192 Design System — shadcn semantic colors (CSS vars in globals.css)
                // Light/dark via :root / .dark. Primary = Teal. Blue = info.
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
                popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
                primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
                secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
                muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
                destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
                success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' },
                warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-foreground))' },
                info: { DEFAULT: 'hsl(var(--info))', foreground: 'hsl(var(--info-foreground))' },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
            },
            borderRadius: {
                '4xl': '2rem',
            },
            spacing: {
                // Studio density-aware spacing tokens
                'row-h': 'var(--row-h)',
                'studio-pad': 'var(--pad)',
                'studio-gap': 'var(--gap)',
                'sidebar-w': 'var(--sidebar-w)',
                'sidebar-collapsed': 'var(--sidebar-w-collapsed)',
                'topbar-h': 'var(--topbar-h)',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'scale-in': 'scaleIn 0.3s ease-out',
                'shimmer': 'shimmer 2s linear infinite',
                'slide-in-right': 'slideInRight 0.3s ease-out',
                // AI Builder generating screen (docs/design/ai-builder/builder-v2.dc.html)
                'pw-in': 'pwIn 0.4s ease-out both',
                'pw-fade': 'pwFade 0.4s ease-out both',
                'pw-scan': 'pwScan 1.6s ease-in-out infinite alternate',
                'pw-shimmer': 'pwShimmer 1.4s linear infinite',
                'pw-sweep': 'pwSweep 1.2s ease-out both',
                'pw-shine': 'pwSweep 1s ease-in-out both',
                'pw-caret': 'pwCaret 1s steps(1) infinite',
                'pw-ring': 'pwRing 1.6s ease-out infinite',
                'pw-glow': 'pwGlow 2.4s ease-out infinite',
                // Help Center intro video: ring around the big Play button until the video is watched
                'intro-pulse': 'introPulse 2.4s cubic-bezier(.22,1,.36,1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                slideInRight: {
                    '0%': { transform: 'translateX(24px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                pwIn: {
                    from: { opacity: '0', transform: 'translateY(10px)' },
                    to: { opacity: '1', transform: 'none' },
                },
                pwFade: { from: { opacity: '0' }, to: { opacity: '1' } },
                pwScan: {
                    from: { transform: 'translateY(0)' },
                    to: { transform: 'translateY(196px)' },
                },
                pwShimmer: {
                    from: { backgroundPosition: '150% 0' },
                    to: { backgroundPosition: '-50% 0' },
                },
                pwSweep: {
                    from: { transform: 'translateX(-120%)' },
                    to: { transform: 'translateX(330%)' },
                },
                pwCaret: { '50%': { opacity: '0' } },
                pwRing: {
                    from: { transform: 'scale(1)', opacity: '0.85' },
                    to: { transform: 'scale(1.9)', opacity: '0' },
                },
                introPulse: {
                    '0%': { transform: 'scale(1)', opacity: '0.45' },
                    '70%, 100%': { transform: 'scale(1.65)', opacity: '0' },
                },
                pwGlow: {
                    '0%': { boxShadow: '0 0 0 0 rgba(56,189,248,.5), 0 0 12px rgba(45,212,191,.3)' },
                    '70%': { boxShadow: '0 0 0 8px rgba(56,189,248,0), 0 0 18px rgba(45,212,191,.45)' },
                    '100%': { boxShadow: '0 0 0 0 rgba(56,189,248,0), 0 0 12px rgba(45,212,191,.3)' },
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-mesh': 'linear-gradient(135deg, var(--tw-gradient-stops))',
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.1)',
                'glow': '0 0 24px rgba(14, 165, 233, 0.3)',
                'glow-accent': '0 0 24px rgba(217, 70, 239, 0.3)',
            },
        },
    },
    // Safelist: arbitrary z-index classes from NAV_Z_CLASS design tokens.
    // JIT may not scan src/lib/design-tokens.ts string values; explicit safelist guarantees generation.
    safelist: [
        'z-[50]', 'z-[51]', 'z-[52]', 'z-[53]',
    ],
    // Disable Preflight — its CSS reset overrides Payload admin styles
    // (globals.css has custom resets in @layer base instead)
    corePlugins: {
        preflight: false,
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
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
            },
            colors: {
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
    // Disable Preflight — its CSS reset overrides Payload admin styles
    // (globals.css has custom resets in @layer base instead)
    corePlugins: {
        preflight: false,
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}

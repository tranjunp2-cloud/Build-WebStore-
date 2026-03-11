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
        './src/app/sites/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/templates/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
                heading: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
            },
            colors: {
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
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'scale-in': 'scaleIn 0.3s ease-out',
                'shimmer': 'shimmer 2s linear infinite',
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

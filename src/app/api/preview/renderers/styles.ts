/**
 * Shared CSS styles and Google Fonts for all template renderers.
 * Each industry template selects its own font pair and color scheme.
 */

export interface TemplateTheme {
    primary: string
    secondary: string
    bg: string
    text: string
    muted: string
    accent: string
    fontHeading: string
    fontBody: string
    navStyle: 'transparent' | 'sticky-dark' | 'centered-logo' | 'minimal' | 'classic'
    heroStyle: 'split' | 'centered' | 'slider' | 'video-bg' | 'gradient-mockup' | 'fullscreen-search' | 'diagonal' | 'masonry' | 'geometric'
}

// Industry theme presets
export const THEMES: Record<string, TemplateTheme> = {
    restaurant: {
        primary: '#D97706', secondary: '#92400E', bg: '#0C0A09', text: '#FAFAF9', muted: '#A8A29E', accent: '#FDE68A',
        fontHeading: 'Playfair Display', fontBody: 'Inter', navStyle: 'transparent', heroStyle: 'split',
    },
    ecommerce: {
        primary: '#E11D48', secondary: '#9F1239', bg: '#FFF1F2', text: '#1C1917', muted: '#78716C', accent: '#FE9F4B',
        fontHeading: 'Syne', fontBody: 'Inter', navStyle: 'sticky-dark', heroStyle: 'slider',
    },
    beauty: {
        primary: '#BE185D', secondary: '#9D174D', bg: '#FDF2F8', text: '#1C1917', muted: '#9CA3AF', accent: '#F9A8D4',
        fontHeading: 'Cormorant Garamond', fontBody: 'Nunito Sans', navStyle: 'centered-logo', heroStyle: 'video-bg',
    },
    tech: {
        primary: '#6366F1', secondary: '#4F46E5', bg: '#0F172A', text: '#F8FAFC', muted: '#94A3B8', accent: '#38BDF8',
        fontHeading: 'Space Grotesk', fontBody: 'Inter', navStyle: 'sticky-dark', heroStyle: 'gradient-mockup',
    },
    health: {
        primary: '#059669', secondary: '#047857', bg: '#FFFFFF', text: '#111827', muted: '#6B7280', accent: '#A7F3D0',
        fontHeading: 'DM Sans', fontBody: 'Inter', navStyle: 'classic', heroStyle: 'centered',
    },
    education: {
        primary: '#7C3AED', secondary: '#6D28D9', bg: '#0F172A', text: '#F8FAFC', muted: '#94A3B8', accent: '#C4B5FD',
        fontHeading: 'Plus Jakarta Sans', fontBody: 'Inter', navStyle: 'sticky-dark', heroStyle: 'centered',
    },
    realestate: {
        primary: '#0891B2', secondary: '#0E7490', bg: '#111827', text: '#F9FAFB', muted: '#9CA3AF', accent: '#67E8F9',
        fontHeading: 'Outfit', fontBody: 'Inter', navStyle: 'transparent', heroStyle: 'fullscreen-search',
    },
    fitness: {
        primary: '#EF4444', secondary: '#DC2626', bg: '#0A0A0A', text: '#FAFAFA', muted: '#A1A1AA', accent: '#4ADE80',
        fontHeading: 'Oswald', fontBody: 'Inter', navStyle: 'minimal', heroStyle: 'diagonal',
    },
    creative: {
        primary: '#F59E0B', secondary: '#D97706', bg: '#FAFAF9', text: '#1C1917', muted: '#78716C', accent: '#FDE68A',
        fontHeading: 'Syne', fontBody: 'Inter', navStyle: 'minimal', heroStyle: 'masonry',
    },
    business: {
        primary: '#2563EB', secondary: '#1D4ED8', bg: '#FFFFFF', text: '#111827', muted: '#6B7280', accent: '#93C5FD',
        fontHeading: 'DM Sans', fontBody: 'Inter', navStyle: 'classic', heroStyle: 'geometric',
    },
}

export function getGoogleFontsLink(theme: TemplateTheme): string {
    const fonts = [theme.fontHeading, theme.fontBody].filter((v, i, a) => a.indexOf(v) === i)
    const params = fonts.map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700;800;900`).join('&')
    return `https://fonts.googleapis.com/css2?${params}&display=swap`
}

export function baseCSS(t: TemplateTheme): string {
    return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { font-family: '${t.fontBody}', sans-serif; background: ${t.bg}; color: ${t.text}; line-height: 1.7; -webkit-font-smoothing: antialiased; }
    h1,h2,h3,h4 { font-family: '${t.fontHeading}', serif; line-height: 1.15; letter-spacing: -0.02em; }
    a { color: inherit; text-decoration: none; }
    img { max-width: 100%; display: block; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    .section { padding: 100px 0; }
    .section-label { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: ${t.primary}; margin-bottom: 12px; }
    .section-title { font-size: clamp(28px, 4vw, 42px); font-weight: 700; margin-bottom: 16px; }
    .section-subtitle { font-size: 17px; color: ${t.muted}; max-width: 560px; }
    .btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 14px 32px; background: ${t.primary}; color: #fff; border-radius: 10px; font-weight: 600; font-size: 15px; border: none; cursor: pointer; transition: all .25s; }
    .btn-primary:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 8px 24px ${t.primary}40; }
    .btn-outline { display: inline-flex; align-items: center; gap: 8px; padding: 14px 32px; background: transparent; color: ${t.text}; border: 2px solid ${t.muted}40; border-radius: 10px; font-weight: 600; font-size: 15px; cursor: pointer; transition: all .25s; }
    .btn-outline:hover { border-color: ${t.primary}; color: ${t.primary}; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
    @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-12px); } }
    @keyframes pulse { 0%,100% { opacity:.6; } 50% { opacity:1; } }
    @keyframes slideIn { from { opacity:0; transform:translateX(-20px); } to { opacity:1; transform:translateX(0); } }
    @keyframes countUp { from { opacity:0; transform:scale(.8); } to { opacity:1; transform:scale(1); } }
    .fade-up { animation: fadeUp .7s ease both; }
    .fade-up-d1 { animation-delay: .1s; }
    .fade-up-d2 { animation-delay: .2s; }
    .fade-up-d3 { animation-delay: .3s; }
    .fade-up-d4 { animation-delay: .4s; }
    .card-hover { transition: transform .3s ease, box-shadow .3s ease; }
    .card-hover:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,.1); }
    .card-hover:hover div[style*="height:3px"] { opacity: 1 !important; }
    img { max-width: 100%; display: block; }
    img[loading="lazy"] { animation: fadeUp .5s ease both; }
    @media (max-width: 768px) {
      .section { padding: 60px 0; }
      .container { padding: 0 16px; }
      .hide-mobile { display: none !important; }
      .section-title { font-size: 28px; }
      h1 { font-size: 32px !important; }
      section[style*="grid-template-columns: 1fr 1fr"],
      section[style*="grid-template-columns:1fr 1fr"] { display: block !important; }
      section[style*="min-height:100vh"] { min-height: auto !important; padding: 80px 0 60px !important; }
      section[style*="min-height:90vh"] { min-height: auto !important; padding: 80px 0 60px !important; }
      section[style*="min-height:85vh"] { min-height: auto !important; padding: 80px 0 60px !important; }
      div[style*="grid-template-columns: 1fr 1fr"],
      div[style*="grid-template-columns:1fr 1fr"],
      div[style*="grid-template-columns:1.1fr"] { grid-template-columns: 1fr !important; }
      div[style*="padding:80px 60px"] { padding: 40px 20px !important; }
      div[style*="padding:80px 60px 80px 80px"] { padding: 40px 20px !important; }
      .btn-primary, .btn-outline { width: 100%; justify-content: center; padding: 16px 24px; min-height: 48px; }
      footer div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; gap: 24px !important; }
      nav .container { flex-wrap: wrap; }
    }
    @media (max-width: 480px) {
      .section { padding: 40px 0; }
      .container { padding: 0 12px; }
      h1 { font-size: 26px !important; }
      .section-title { font-size: 24px; }
      .section-subtitle { font-size: 15px; }
      .btn-primary, .btn-outline { font-size: 14px; padding: 14px 20px; }
    }
  `
}

import type { CustomerStatus, CustomerSource } from './customer-record'

// Figma spec: node-id=32179-5360 (list) + 32182-12278 (detail panel)
// All badges use tinted style: transparent bg, colored border, colored text.

export const STATUS_COLORS: Record<CustomerStatus, { bg: string; border: string; text: string }> = {
    new:        { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  text: '#fbbf24' },
    read:       { bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.3)', text: '#818cf8' },
    contacted:  { bg: 'rgba(45,212,191,0.1)',  border: 'rgba(45,212,191,0.3)',  text: '#2dd4bf' },
    ignored:    { bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)', text: '#9ca3af' },
    subscribed: { bg: 'rgba(167,139,250,0.1)', border: 'rgba(138,129,245,0.3)', text: '#8a81f5' },
}

export const SOURCE_COLORS: Record<CustomerSource, { bg: string; border: string; text: string }> = {
    'contact-form': { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)',  text: '#3b82f6' },
    'newsletter':   { bg: 'rgba(138,129,245,0.1)', border: 'rgba(138,129,245,0.3)', text: '#8a81f5' },
}

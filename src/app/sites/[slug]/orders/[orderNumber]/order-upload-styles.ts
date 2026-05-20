import type React from 'react'

export const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#eff1f3',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "var(--font-body,'Inter',system-ui,sans-serif)",
    color: '#0c1014',
}

export const headerStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 4,
    background: '#fff',
    borderBottom: '1px solid #e6e9ed',
    padding: '18px 28px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
}

export const h1Style: React.CSSProperties = {
    fontFamily: "var(--font-heading,'Outfit',sans-serif)",
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '-0.005em',
    margin: 0,
    color: '#0c1014',
}

export const shellStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 560,
    margin: '0 auto',
    width: '100%',
    padding: '28px 16px',
    gap: 18,
}

export const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 1px 2px rgba(15,23,42,.04),0 4px 14px -8px rgba(15,23,42,.10)',
    padding: '24px 26px',
}

export const referenceBoxStyle: React.CSSProperties = {
    background: 'rgba(14,117,86,.07)',
    border: '1px solid rgba(14,117,86,.22)',
    borderRadius: 12,
    padding: '14px 18px',
    textAlign: 'center',
    marginBottom: 18,
}

export const referenceCodeStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: 22,
    fontWeight: 800,
    color: '#0e7556',
    letterSpacing: '0.08em',
    margin: 0,
}

export const referenceLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: '#7b8390',
    marginBottom: 4,
}

export const bankRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontSize: 13,
    padding: '6px 0',
    borderBottom: '1px solid #eef0f2',
    gap: 12,
}

export const bankLabelStyle: React.CSSProperties = {
    color: '#7b8390',
    flexShrink: 0,
}

export const bankValueStyle: React.CSSProperties = {
    fontWeight: 700,
    color: '#0c1014',
    textAlign: 'right' as const,
    wordBreak: 'break-all' as const,
}

export const countdownStyle: React.CSSProperties = {
    display: 'inline-block',
    fontFamily: 'monospace',
    fontWeight: 700,
    fontSize: 15,
    color: '#8a5c0a',
    background: '#fff4dc',
    border: '1px solid #f1d693',
    borderRadius: 8,
    padding: '4px 12px',
}

export const dropZoneStyle: React.CSSProperties = {
    border: '2px dashed #c8d0d9',
    borderRadius: 12,
    padding: '28px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color .15s, background .15s',
    background: '#f7f9fb',
}

export const dropZoneActiveStyle: React.CSSProperties = {
    ...dropZoneStyle,
    borderColor: '#0e7556',
    background: 'rgba(14,117,86,.05)',
}

export const uploadBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    background: '#0e7556',
    color: '#fff',
    width: '100%',
    marginTop: 14,
    boxShadow: '0 4px 12px -4px rgba(14,117,86,.40)',
    transition: 'background .15s',
}

export const uploadBtnDisabledStyle: React.CSSProperties = {
    ...uploadBtnStyle,
    background: '#a8b0b9',
    cursor: 'not-allowed',
    boxShadow: 'none',
}

export const stateCardStyle: React.CSSProperties = {
    ...cardStyle,
    textAlign: 'center',
    padding: '40px 28px',
}

export const stateIconStyle: React.CSSProperties = {
    width: 64,
    height: 64,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 18px',
}

export const sectionTitleStyle: React.CSSProperties = {
    fontFamily: "var(--font-heading,'Outfit',sans-serif)",
    fontSize: 17,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: '#0c1014',
    margin: '0 0 14px',
}

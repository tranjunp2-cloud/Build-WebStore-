/** Normalize CSS RGB/HSL/named colors for the native hex-only color picker. */
export function colorToHex(value: string | undefined, fallback = '#000000'): string {
    if (!value || typeof document === 'undefined') return fallback
    const probe = document.createElement('span')
    probe.style.color = value
    if (!probe.style.color) return fallback
    probe.hidden = true
    document.body.appendChild(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    const channels = color.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
    return channels ? '#' + channels.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, '0')).join('') : fallback
}

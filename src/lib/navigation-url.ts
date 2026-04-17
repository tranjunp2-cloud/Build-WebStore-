function isValidIpv4Hostname(hostname: string) {
    const parts = hostname.split('.')
    if (parts.length !== 4) return false

    return parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
}

function isValidDomainLabel(label: string) {
    if (!label || label.length > 63) return false
    if (label.startsWith('-') || label.endsWith('-')) return false
    return /^[a-z0-9-]+$/i.test(label)
}

function isValidDomainHostname(hostname: string) {
    if (!hostname.includes('.')) return false

    const labels = hostname.split('.')
    if (labels.some(label => !isValidDomainLabel(label))) return false

    const topLevelLabel = labels[labels.length - 1]
    return /^[a-z]{2,63}$/i.test(topLevelLabel) || /^xn--[a-z0-9-]{2,59}$/i.test(topLevelLabel)
}

export function isValidExternalNavigationUrl(value: string) {
    const trimmedValue = value.trim()
    if (!trimmedValue) return false

    try {
        const parsedUrl = new URL(trimmedValue)
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return false
        }

        const hostname = parsedUrl.hostname.trim().toLowerCase()
        if (!hostname) return false
        if (hostname === 'localhost') return true
        if (isValidIpv4Hostname(hostname)) return true

        return isValidDomainHostname(hostname)
    } catch {
        return false
    }
}

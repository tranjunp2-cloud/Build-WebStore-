/**
 * Client-safe UUID v4.
 *
 * `crypto.randomUUID()` is only exposed in secure contexts (HTTPS, localhost).
 * On plain-HTTP LAN hosts (e.g. `http://192.168.x.x:3000` — allowed for dev via
 * `isDevAccessHost` in proxy.ts) it is `undefined` and throws
 * "crypto.randomUUID is not a function". `crypto.getRandomValues` remains
 * available in insecure contexts, so the fallback keeps real randomness.
 * `Math.random()` is the last resort for ancient runtimes.
 */
export function uuid(): string {
    if (typeof crypto !== 'undefined') {
        if (typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID()
        }
        if (typeof crypto.getRandomValues === 'function') {
            const bytes = crypto.getRandomValues(new Uint8Array(16))
            bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
            bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
            const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
        }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
}

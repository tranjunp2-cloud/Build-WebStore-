// Navigation is distinct from media downloads. Unknown query parameters still need review.
const navigationParameters = new Set([
  'width', 'height', 'w', 'h', 'q', 'quality', 'format', 'fit', 'v',
  'page', 'search', 'category', 'sort', 'order', 'lang',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
])
const sensitiveValue = /(?:password|secret|token|credential|authorization|api[_-]?key|signature)\s*[:=]/i

export function isSafeContentLink(href: string): boolean {
  try {
    if (!href || /[\u0000-\u0020\u007f\\]/.test(href) || /^\/\//.test(href)) return false
    // Reject encoded controls and nested escapes, including mail header injection.
    const decoded = decodeURIComponent(href)
    if (/[\u0000-\u001f\u007f\\]/.test(decoded) || /%[0-9a-f]{2}/i.test(decoded) || sensitiveValue.test(decoded)) return false
    if (/^mailto:/i.test(href))
      return /^mailto:[a-z0-9.!#$&'*+\-/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(href)
    if (/^tel:/i.test(href)) return /^tel:\+?[0-9][0-9().-]{2,30}$/i.test(href)
    const scheme = href.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]
    if (scheme && !/^https?$/i.test(scheme)) return false
    if (scheme && !/^https?:\/\//i.test(href)) return false
    const url = new URL(href, 'https://migration.invalid')
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false
    if (url.hash && !/^#[a-z0-9_.:-]+$/i.test(url.hash)) return false
    return [...url.searchParams.keys()].every((key) => navigationParameters.has(key.toLowerCase()))
  } catch {
    return false
  }
}

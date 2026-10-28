import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import { parseTemplates, templatesForChip } from '@/components/landing-v2/template-picks'

const CSS = readFileSync(path.resolve(__dirname, '../../../components/landing-v2/landing-v2.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** Flattens `@media`/`@container` blocks and returns every style-rule selector plus every keyframes name. */
function collect(src: string, selectors: string[] = [], keyframes: string[] = []) {
  let i = 0
  while (i < src.length) {
    const open = src.indexOf('{', i)
    if (open < 0) break
    const prelude = src.slice(i, open).trim()
    let depth = 1
    let j = open + 1
    while (depth && j < src.length) { depth += src[j] === '{' ? 1 : src[j] === '}' ? -1 : 0; j++ }
    const body = src.slice(open + 1, j - 1)
    if (prelude.startsWith('@keyframes')) keyframes.push(prelude.replace('@keyframes', '').trim())
    else if (prelude.startsWith('@')) collect(body, selectors, keyframes)
    else selectors.push(...prelude.split(',').map((s) => s.trim()))
    i = j
  }
  return { selectors, keyframes }
}

describe('F45 landing v2 — CSS isolation', () => {
  const { selectors, keyframes } = collect(CSS)

  it('TC-F45-11: every selector is scoped under .lv (nothing can restyle the dashboard)', () => {
    const leaking = selectors.filter((s) => !s.startsWith('.lv'))
    expect(selectors.length).toBeGreaterThan(300)
    expect(leaking).toEqual([])
  })

  it('TC-F45-11: keyframes are namespaced with lv-', () => {
    expect(keyframes.length).toBeGreaterThan(5)
    expect(keyframes.filter((k) => !k.startsWith('lv-'))).toEqual([])
  })

  it('TC-F45-06: the "Store" wordmark keeps #06B6D4 and is not overridden per theme', () => {
    expect(CSS).toMatch(/\.lv \.wordmark b\{[^}]*color:#06B6D4/)
    expect(selectors.filter((s) => /wordmark/.test(s) && /data-theme/.test(s))).toEqual([])
  })

  it('TC-F45-08: keeps the container queries and 1100 / 960 / 600 breakpoints from the prototype', () => {
    expect(CSS).toContain('container: lv / inline-size')
    ;['600px', '960px', '1100px'].forEach((bp) => expect(CSS).toContain(`@container lv (min-width:${bp})`))
  })
})

describe('F45 landing v2 — i18n namespace', () => {
  const shape = (o: unknown, p = ''): string[] =>
    o && typeof o === 'object' && !Array.isArray(o)
      ? Object.entries(o).flatMap(([k, v]) => shape(v, `${p}${k}.`))
      : [`${p}${Array.isArray(o) ? `[${o.length}]` : ''}`]

  it('TC-F45-05: landingV2 has identical keys in EN and MS', () => {
    expect(shape(ms.landingV2)).toEqual(shape(en.landingV2))
  })

  it('TC-F45-02: dropped prototype keys are gone', () => {
    const raw = JSON.stringify(en.landingV2)
    ;['"strip"', '"reviews"', '"pointsToVerify"', '"bubble"', '"xendit"'].forEach((k) => expect(raw).not.toContain(k))
    expect(Object.keys(en.landingV2.nav.items)).toEqual(['how', 'features', 'templates', 'faq'])
  })
})

describe('F45 landing v2 — template picks', () => {
  it('TC-F45-07: parseTemplates drops malformed docs and sorts by id', () => {
    const out = parseTemplates({ docs: [{ id: 9, name: 'B', category: 'beauty' }, { id: 2, name: 'A', category: ['tech', 3] }, { id: 5 }, null, { name: 'x' }] })
    expect(out).toEqual([{ id: '2', name: 'A', category: ['tech'] }, { id: '9', name: 'B', category: ['beauty'] }])
    expect(parseTemplates(null)).toEqual([])
    expect(parseTemplates({ docs: 'x' })).toEqual([])
  })

  it('TC-F45-07: "All" falls back to the first 8 templates when none match the curated categories', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), name: `T${i}`, category: ['events'] }))
    expect(templatesForChip(many, 'all')).toHaveLength(8)
    expect(templatesForChip(many, 'events')).toHaveLength(12)
    expect(templatesForChip(many, 'travel')).toEqual([])
  })
})

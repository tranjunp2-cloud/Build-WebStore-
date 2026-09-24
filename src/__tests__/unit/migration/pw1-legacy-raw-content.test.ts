// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { emptyStore } from '@/lib/migration/pw1-export/contracts'
import { legacyModelSettingsValid, legacyRawContentValid } from '@/lib/migration/pw1-export/legacy-raw-content'
describe('[TC-F42-EXP-111] Legacy raw column boundaries', () => {
  it('accepts old registered Page fields without interpreting their raw strings', () => {
    // Arrange
    const store = emptyStore()
    store.pages.push({ _ref: '@pages:pages:1', id: '1', store_id: '1', content: '{source', components: [], model_settings: [] })
    // Act / Assert
    expect(legacyRawContentValid(store)).toBe(true)
  })
  it.each(['page', 'component', 'menu'])('denies newly opaque %s columns under old contracts', target => {
    // Arrange
    const store = emptyStore()
    if (target === 'page') store.pages.push({ _ref: '@pages:pages:1', components: [], model_settings: [], new_column: 'source' })
    if (target === 'component') store.pages.push({ _ref: '@pages:pages:1', components: [{ frontend_component: null, banners: [], shortlist_items: [], model_settings: [], new_column: 'source' }], model_settings: [] })
    if (target === 'menu') store.sites.push({ menus: [{ menu_items: [], model_settings: [], new_column: 'source' }] })
    // Act / Assert
    expect(legacyRawContentValid(store)).toBe(false)
  })
})

describe('[TC-F42-EXP-112] Legacy model setting column boundaries', () => {
  it.each(['page', 'component', 'menu', 'item', 'line', 'fallback'])('rejects opaque setting columns at %s only for the historical schema', target => {
    // Arrange
    const store = emptyStore()
    const source = { id: '1', key: 'content', value: '<p>Original</p>' }
    const settingRows = [source]
    store.pages.push({ model_settings: target === 'page' ? settingRows : [], components: [{ model_settings: target === 'component' ? settingRows : [] }] })
    store.sites.push({ menus: [{ model_settings: target === 'menu' ? settingRows : [], menu_items: [{ model_settings: target === 'item' ? settingRows : [], menu_lines: [{ model_settings: target === 'line' ? settingRows : [] }] }] }] })
    // Act / Assert
    expect(legacyModelSettingsValid(store)).toBe(true)
    if (target === 'fallback') store.sites[0].raw_model_settings = []
    else Object.assign(source, { future_column: 'opaque' })
    expect(legacyModelSettingsValid(store)).toBe(false)
  })
})

export type EditorSettingsTab = 'global' | 'seo'
export type EditorSettingsSection =
    | 'brand'
    | 'contact'
    | 'localBusiness'
    | 'searchVerification'
export type EditorSettingsFocus =
    | 'address'
    | 'phone'
    | 'schemaSubtype'
    | 'openingHours'
    | 'map'
    | 'priceRange'

export interface EditorSettingsDeepLinkTarget {
    tab: EditorSettingsTab
    section: EditorSettingsSection
    focus?: EditorSettingsFocus
}

const globalSections = new Set<EditorSettingsSection>([
    'brand',
    'contact',
    'localBusiness',
])
const localBusinessFocus = new Set<EditorSettingsFocus>([
    'address',
    'schemaSubtype',
    'openingHours',
    'map',
    'priceRange',
])

export function parseEditorSettingsDeepLink(
    searchParams: URLSearchParams,
): EditorSettingsDeepLinkTarget | null {
    const tab = searchParams.get('settingsTab')
    const section = searchParams.get('section')
    const focus = searchParams.get('focus')

    if (tab === 'seo' && section === 'searchVerification' && focus === null) {
        return { tab, section }
    }
    if (
        tab !== 'global' ||
        !section ||
        !globalSections.has(section as EditorSettingsSection)
    ) {
        return null
    }
    if (section === 'brand' && focus === null) return { tab, section }
    if (
        section === 'contact' &&
        (focus === 'phone' || focus === 'address')
    )
        return { tab, section, focus }
    if (
        section === 'localBusiness' &&
        focus &&
        localBusinessFocus.has(focus as EditorSettingsFocus)
    ) {
        return { tab, section, focus: focus as EditorSettingsFocus }
    }
    return null
}

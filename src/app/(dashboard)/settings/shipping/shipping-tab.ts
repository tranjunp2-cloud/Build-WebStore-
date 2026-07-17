export type ShippingTab = 'flat-rate' | 'easyparcel'

export function resolveShippingTab(tab?: string, ep?: string): ShippingTab | undefined {
    if (tab === 'flat-rate' || tab === 'easyparcel') return tab
    return ep ? 'easyparcel' : undefined
}

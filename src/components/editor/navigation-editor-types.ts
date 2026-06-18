export type NavLinkItem = {
    id: string
    label: string
    url: string
    type: 'page' | 'external'
    children: NavLinkItem[]
}

export type DropTarget = {
    id: string
    mode: 'sibling' | 'child'
} | null

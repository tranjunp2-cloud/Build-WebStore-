'use client'
import Image from 'next/image'
import { GripVertical, ImageIcon, Search, Plus, PackagePlus } from 'lucide-react'
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useState } from 'react'
import { SettingHelp } from './SettingHelp'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProductCategorySetting } from './ProductCategorySetting'

type ProductChoice = { id: string | number; name: string; images?: Array<{ image?: { url?: string } | number | null }> }
function ProductThumbnail({ src }: { src?: string }) {
    const [failed, setFailed] = useState(false)
    useEffect(() => setFailed(false), [src])
    return <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--editor-surface-elevated)]">
        {src && !failed ? <Image src={src} alt="" fill sizes="48px" className="object-contain" onError={() => setFailed(true)} /> : <ImageIcon aria-hidden="true" className="h-5 w-5 text-[var(--editor-text-muted)]" />}
    </span>
}
function productImage(product: ProductChoice): string | undefined {
    const image = product.images?.[0]?.image
    return image && typeof image === 'object' ? image.url : undefined
}
function SortableProduct({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
    return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} className="relative flex items-center gap-2 rounded-lg border border-solid border-[var(--editor-border)] bg-[var(--editor-surface)] p-2">
        <Button ref={setActivatorNodeRef} variant="ghost" size="icon" type="button" className="h-8 w-6 shrink-0 touch-none cursor-grab active:cursor-grabbing" {...attributes} {...listeners} aria-label={label}><GripVertical /></Button>
        {children}
    </li>
}
type Props = { siteId?: string; block: Record<string, unknown>; locale: string; onChange: (field: string, value: unknown) => void }
export function ProductListingSettings({ siteId, block, locale, onChange }: Props) {
    const ms = locale.startsWith('ms')
    const category = block.selectionMode === 'random' && typeof block.category === 'string' ? block.category : ''
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [retry, setRetry] = useState(0)
    const [selectedStatus, setSelectedStatus] = useState<'loading' | 'ready' | 'error'>('loading')
    const [matchingIds, setMatchingIds] = useState<string[]>([])
    const limit = typeof block.limit === 'number' ? block.limit : 6
    const [limitDraft, setLimitDraft] = useState(String(limit))
    const [limitError, setLimitError] = useState(false)
    useEffect(() => { setLimitDraft(String(limit)); setLimitError(false) }, [limit])
    const [search, setSearch] = useState('')
    const [choices, setChoices] = useState<ProductChoice[]>([])
    const [names, setNames] = useState<Record<string, string>>({})
    const [error, setError] = useState(false)
    const [loading, setLoading] = useState(false)
    const [images, setImages] = useState<Record<string, string | undefined>>({})
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
    const mode = typeof block.selectionMode === 'string' ? block.selectionMode : 'all'
    const ids = Array.isArray(block.selectedProductIds) ? block.selectedProductIds.filter((id): id is string => typeof id === 'string') : []
    const idsKey = JSON.stringify(ids)
    useEffect(() => { setNames({}); setImages({}); setChoices([]); setPage(1) }, [siteId, category])
    useEffect(() => {
        if (!siteId || mode !== 'fixed') return
        const controller = new AbortController()
        setLoading(true)
        setError(false)
        const timer = setTimeout(() => {
            void (async () => {
                try {
                    const params = new URLSearchParams({ site: siteId, limit: '20', search, page: String(page) })
                    if (category) params.set('categoryId', category)
                    const response = await fetch(`/api/storefront/products?${params}`, { signal: controller.signal })
                    if (!response.ok) throw new Error('Product request failed')
                    const data = await response.json()
                    if (controller.signal.aborted) return
                    const docs: ProductChoice[] = Array.isArray(data.docs) ? data.docs : []
                    setImages(previous => ({ ...previous, ...Object.fromEntries(docs.map(doc => [String(doc.id), productImage(doc)])) }))
                    setChoices(previous => page === 1 ? docs : [...new Map([...previous, ...docs].map(doc => [String(doc.id), doc])).values()])
                    setTotalPages(data.totalPages || 1)
                    setNames(previous => ({ ...previous, ...Object.fromEntries(docs.map(doc => [String(doc.id), doc.name])) }))
                } catch (error) { if (!controller.signal.aborted) { setError(true); console.error('Product settings:', error) } }
                finally { if (!controller.signal.aborted) setLoading(false) }
            })()
        }, 250)
        return () => { clearTimeout(timer); controller.abort() }
    }, [siteId, mode, search, category, page, retry])
    useEffect(() => {
        const selected = JSON.parse(idsKey) as string[]
        if (!siteId || mode !== 'fixed' || !selected.length) return
        const controller = new AbortController()
        setSelectedStatus('loading')
        void (async () => {
            try {
                const labels: Record<string, string> = {}
                const matches: string[] = []
                const thumbnails: Record<string, string | undefined> = {}
                for (let offset = 0; offset < selected.length; offset += 100) {
                    const params = new URLSearchParams({ site: siteId, selectionMode: 'fixed', limit: '100' })
                    selected.slice(offset, offset + 100).forEach(id => params.append('productId', id))
                    const response = await fetch(`/api/storefront/products?${params}`, { signal: controller.signal })
                    if (!response.ok) throw new Error('Selected products request failed')
                    const data = await response.json()
                    for (const doc of (data.docs ?? []) as ProductChoice[]) { labels[String(doc.id)] = doc.name; thumbnails[String(doc.id)] = productImage(doc) }
                    if (category) {
                        params.set('categoryId', category)
                        const matchingResponse = await fetch(`/api/storefront/products?${params}`, { signal: controller.signal })
                        if (!matchingResponse.ok) throw new Error('Category matching request failed')
                        const matchingData = await matchingResponse.json()
                        for (const doc of matchingData.docs ?? []) matches.push(String(doc.id))
                    }
                }
                if (!controller.signal.aborted) { setNames(labels); setImages(previous => ({ ...previous, ...thumbnails })); setMatchingIds(matches); setSelectedStatus('ready') }
            } catch (error) { if (!controller.signal.aborted) { setSelectedStatus('error'); console.error('Selected products:', error) } }
        })()
        return () => controller.abort()
    }, [siteId, mode, idsKey, category, retry])
    function move(from: number, to: number) {
        if (to < 0 || to >= ids.length) return
        const next = [...ids]
        next.splice(to, 0, next.splice(from, 1)[0])
        onChange('selectedProductIds', next)
    }
    return <div className="space-y-5 text-sm text-[var(--editor-text)]" data-testid="product-listing-settings">
        <div className="space-y-2">
            <div className="flex items-center gap-1"><span>{ms ? 'Pilih produk' : 'Choose products'}</span><SettingHelp label={ms ? 'Bantuan pilih produk' : 'About choosing products'}>{ms ? 'Semua produk: paparkan semua produk yang layak. Produk terpilih: pilih senarai sendiri. Produk rawak: paparkan produk dalam urutan rawak.' : 'All products: show all eligible products. Selected products: choose your own list. Random products: show products in a randomized order.'}</SettingHelp></div>
            <Select value={mode} onValueChange={value => onChange('selectionMode', value)}>
                <SelectTrigger aria-label={ms ? 'Pilih produk' : 'Choose products'} className="border-[var(--editor-border)] bg-[var(--editor-surface-elevated)] text-[var(--editor-text)]"><SelectValue /></SelectTrigger>
                <SelectContent side="bottom" align="start">
                    <SelectItem value="all">{ms ? 'Semua produk' : 'All products'}</SelectItem>
                    <SelectItem value="fixed">{ms ? 'Produk terpilih' : 'Selected products'}</SelectItem>
                    <SelectItem value="random">{ms ? 'Produk rawak' : 'Random products'}</SelectItem>
                </SelectContent>
            </Select>
            {mode === 'random' && <ProductCategorySetting siteId={siteId} value={typeof block.category === 'string' ? block.category : ''} locale={locale} onChange={value => { setPage(1); setChoices([]); onChange('category', value) }} />}
        {mode === 'fixed' && <div className="space-y-3 rounded-xl bg-[var(--editor-surface)] p-3">
            <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--editor-text-muted)]" />
                <Input variant="editor" aria-label={ms ? 'Cari produk' : 'Search products'} placeholder={ms ? 'Cari nama produk…' : 'Search product names…'} className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1); setChoices([]) }} />
            </div>
            {loading && <p role="status">{ms ? 'Memuatkan…' : 'Loading…'}</p>}
            {(error || selectedStatus === 'error') && <div role="alert"><p>{ms ? 'Gagal memuatkan produk' : 'Could not load products'}</p><Button type="button" variant="ghost" size="sm" onClick={() => setRetry(value => value + 1)}>{ms ? 'Cuba lagi' : 'Try again'}</Button></div>}
            {!loading && !error && !choices.length && <p className="text-xs text-[var(--editor-text-muted)]">{ms ? 'Tiada produk dijumpai.' : 'No products found.'}</p>}
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {choices.filter(item => !ids.includes(String(item.id))).map(item => <Button variant="ghost" className="h-auto w-full justify-start gap-3 rounded-lg px-2 py-2 text-left font-normal text-[var(--editor-text)] hover:bg-[var(--editor-surface-elevated)]" type="button" key={item.id} aria-label={`+ ${item.name}`} disabled={loading} onClick={() => onChange('selectedProductIds', [...ids, String(item.id)])}>
                    <ProductThumbnail src={productImage(item)} />
                    <span className="min-w-0 flex-1 whitespace-normal text-xs leading-5 line-clamp-2">{item.name}</span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--editor-surface-elevated)] text-[hsl(var(--primary))]"><Plus aria-hidden="true" /></span>
                </Button>)}
            </div>
            {page < totalPages && <Button type="button" variant="ghost" size="sm" className="w-full text-xs" disabled={loading} onClick={() => setPage(value => value + 1)}>{ms ? 'Muat lagi' : 'Load more'}</Button>}
            <div className="flex items-center justify-between border-0 border-t border-solid border-[var(--editor-border)] pt-3">
                <span className="text-xs font-medium">{ms ? 'Produk dipilih' : 'Selected products'} <span className="ml-1 rounded-full bg-[var(--editor-surface-elevated)] px-2 py-0.5 tabular-nums">{ids.length}</span></span>
            </div>
            {!ids.length && <div className="flex flex-col items-center gap-2 px-3 py-5 text-center text-[var(--editor-text-muted)]"><PackagePlus aria-hidden="true" className="h-6 w-6 opacity-60" /><p className="m-0 text-xs leading-5">{ms ? 'Klik + untuk menambah produk.' : 'Click + to add your first product.'}</p></div>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (over && active.id !== over.id) move(ids.indexOf(String(active.id)), ids.indexOf(String(over.id))) }}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ol className="max-h-72 space-y-2 overflow-y-auto">
                {ids.map((id, index) => <SortableProduct key={id} id={id} label={`${ms ? 'Seret untuk menyusun' : 'Drag to reorder'} ${names[id] || id}`}>
                    <ProductThumbnail src={images[id]} />
                    <span className="min-w-0 flex-1 break-words text-xs leading-5">{index + 1}. {names[id] || `#${id}`}
                        <span className="block text-xs text-[var(--editor-text-muted)]">{selectedStatus === 'loading' ? (ms ? 'Memuatkan…' : 'Loading…') : selectedStatus === 'error' ? (ms ? 'Gagal memuatkan maklumat' : 'Could not load details') : !names[id] ? (ms ? 'Produk tidak tersedia' : 'Product unavailable') : category && !matchingIds.includes(id) ? (ms ? 'Di luar kategori — tidak dipaparkan' : 'Outside category — hidden from this block') : null}</span>
                    </span>
                    <Button variant="ghost" size="icon" type="button" aria-label={`${ms ? 'Buang' : 'Remove'} ${names[id] || id}`} onClick={() => onChange('selectedProductIds', ids.filter(value => value !== id))}>×</Button>
                </SortableProduct>)}
            </ol>
            </SortableContext>
            </DndContext>
        </div>}
        </div>
        <div className="space-y-2"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-1"><span>{ms ? 'Produk setiap halaman' : 'Products per page'}</span><SettingHelp label={ms ? 'Bantuan produk setiap halaman' : 'About products per page'}>{ms ? 'Bilangan maksimum produk pada setiap halaman, pada desktop dan mudah alih. Masukkan 1 hingga 20.' : 'Maximum products shown on each page, on desktop and mobile. Enter a number from 1 to 20.'}</SettingHelp></div><span className="text-xs text-[var(--editor-text-muted)]">1–20</span></div>
            <Input aria-label={ms ? 'Produk setiap halaman' : 'Products per page'} variant="editor" type="number" min={1} max={20} value={limitDraft} aria-invalid={limitError} onChange={e => { setLimitDraft(e.target.value); setLimitError(false) }} onBlur={() => {
                const value = Number(limitDraft)
                if (Number.isInteger(value) && value >= 1 && value <= 20) { onChange('limit', value); setLimitError(false) }
                else { setLimitDraft(String(limit)); setLimitError(true) }
            }} />
            {limitError && <span className="block text-xs text-[var(--editor-text-muted)]" role="alert">{ms ? 'Masukkan nombor 1–20. Nilai sebelumnya dikekalkan.' : 'Enter a number from 1–20. Previous value restored.'}</span>}
        </div>
        <fieldset className="space-y-2 border-0 p-0">
        <legend className="mb-2 text-xs font-medium text-[var(--editor-text-muted)]">{ms ? 'Paparan' : 'Display'}</legend>
        <div className="group flex cursor-pointer items-center gap-3 rounded-xl border border-solid border-[var(--editor-border)] bg-[var(--editor-surface-elevated)] px-3 py-2 text-sm text-[var(--editor-text)] transition-colors hover:border-[hsl(var(--primary)/0.45)] focus-within:border-[hsl(var(--ring)/0.65)]">
            <label className="flex flex-1 cursor-pointer items-center gap-3">
            <Checkbox checked={block.includeOutOfStock !== false} onCheckedChange={checked => onChange('includeOutOfStock', checked === true)} className="h-5 w-5 rounded-md border-solid border-[hsl(var(--input-border))] bg-[var(--editor-surface-deep)] text-[hsl(var(--primary-foreground))] transition-colors focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--editor-surface-elevated)] data-[state=checked]:border-[hsl(var(--primary))] data-[state=checked]:bg-[hsl(var(--primary))] data-[state=checked]:text-[hsl(var(--primary-foreground))]" />
            <span>{ms ? 'Paparkan produk kehabisan stok' : 'Show out-of-stock products'}</span>
            </label>
            <SettingHelp label={ms ? 'Bantuan produk kehabisan stok' : 'About out-of-stock products'}>{ms ? 'Apabila diaktifkan, produk kehabisan stok turut dipaparkan. Matikan untuk memaparkan produk yang mempunyai stok sahaja.' : 'When enabled, out-of-stock products are included. Turn off to show only products with available stock.'}</SettingHelp>
        </div>
        <div className="group flex cursor-pointer items-center gap-3 rounded-xl border border-solid border-[var(--editor-border)] bg-[var(--editor-surface-elevated)] px-3 py-2 text-sm text-[var(--editor-text)] transition-colors hover:border-[hsl(var(--primary)/0.45)] focus-within:border-[hsl(var(--ring)/0.65)]">
            <label className="flex flex-1 cursor-pointer items-center gap-3">
            <Checkbox checked={Boolean(block.showCategoryFilter)} onCheckedChange={checked => onChange('showCategoryFilter', checked === true)} className="h-5 w-5 rounded-md border-solid border-[hsl(var(--input-border))] bg-[var(--editor-surface-deep)] text-[hsl(var(--primary-foreground))] transition-colors focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--editor-surface-elevated)] data-[state=checked]:border-[hsl(var(--primary))] data-[state=checked]:bg-[hsl(var(--primary))] data-[state=checked]:text-[hsl(var(--primary-foreground))]" />
            <span>{ms ? 'Paparkan penapis' : 'Show filters'}</span>
            </label>
            <SettingHelp label={ms ? 'Bantuan penapis kategori' : 'About category filter'}>{ms ? 'Pilih penapis yang tersedia untuk pelawat.' : 'Choose which filters visitors can use in this block.'}</SettingHelp>
        </div>
        {Boolean(block.showCategoryFilter) && <div className="space-y-3 pl-3 pt-2">
            {(['category', 'price', 'search', 'attributes'] as const).map(key => {
                const controls = (block.filterControls ?? { category: true, price: true, search: true, attributes: true }) as Record<string, boolean>
                const labels = ms ? { category: 'Kategori', price: 'Harga', search: 'Carian', attributes: 'Atribut' } : { category: 'Categories', price: 'Price', search: 'Search', attributes: 'Attributes' }
                return <label key={key} className="flex items-center gap-3 text-sm text-[var(--editor-text)]"><Checkbox checked={controls[key]} onCheckedChange={checked => onChange('filterControls', { ...controls, [key]: checked === true })} /><span>{labels[key]}</span></label>
            })}
        </div>}
        </fieldset>
    </div>
}

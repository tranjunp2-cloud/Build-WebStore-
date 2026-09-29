'use client'
import { useEffect, useState } from 'react'
import { SettingHelp } from './SettingHelp'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function ProductCategorySetting({ siteId, value, onChange, locale }: { siteId?: string; value: string; onChange: (value: string) => void; locale: string }) {
    const [categories, setCategories] = useState<Array<{ id: string | number; name: string }>>([])
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
    const [retry, setRetry] = useState(0)
    const malay = locale.startsWith('ms')
    useEffect(() => {
        const controller = new AbortController()
        setCategories([])
        setStatus('loading')
        if (!siteId) return () => controller.abort()
        async function load() {
            try {
                const response = await fetch(`/api/storefront/categories?site=${encodeURIComponent(siteId!)}`, { signal: controller.signal })
                if (!response.ok) throw new Error('Category request failed')
                const data = await response.json()
                setCategories(Array.isArray(data.docs) ? data.docs : [])
                setStatus('ready')
            } catch (error) {
                if (!controller.signal.aborted) { setStatus('error'); console.error('Category settings:', error) }
            }
        }
        void load()
        return () => controller.abort()
    }, [siteId, retry])
    return <div className="space-y-2 text-sm">
        <div className="flex items-center gap-1"><span>{malay ? 'Kategori produk' : 'Product category'}</span><SettingHelp label={malay ? 'Bantuan kategori produk' : 'About product category'}>{value ? (malay ? 'Hadkan produk blok ini kepada kategori yang dipilih.' : 'Only products in the selected category appear in this block.') : (malay ? 'Produk daripada semua kategori boleh dipaparkan.' : 'Products from all categories can appear in this block.')}</SettingHelp></div>
        <Select value={value || 'all'} disabled={status !== 'ready'} onValueChange={selected => onChange(selected === 'all' ? '' : selected)}>
            <SelectTrigger aria-label={malay ? 'Kategori produk' : 'Product category'} className="border-[var(--editor-border)] bg-[var(--editor-surface-elevated)] text-[var(--editor-text)]"><SelectValue /></SelectTrigger>
            <SelectContent side="bottom" align="start">
                <SelectItem value="all">{malay ? 'Semua kategori' : 'All categories'}</SelectItem>
                {value && !categories.some(category => String(category.id) === value) && <SelectItem value={value}>{value}</SelectItem>}
                {categories.map(category => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}
            </SelectContent>
        </Select>

        {status === 'loading' && <span className="block text-xs text-[var(--editor-text-muted)]" role="status">{malay ? 'Memuatkan kategori…' : 'Loading categories…'}</span>}
        {status === 'error' && <span className="block" role="alert">{malay ? 'Gagal memuatkan kategori' : 'Could not load categories'}<Button type="button" variant="ghost" size="sm" onClick={() => setRetry(value => value + 1)}>{malay ? 'Cuba lagi' : 'Try again'}</Button></span>}
    </div>
}

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, TrendingUp, TrendingDown, Minus, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n'

interface TrackedKeyword {
    id: string
    keyword: string
    rank: number | null
    trend: 'up' | 'down' | 'same'
    lastCheckedAt: string
}

export function KeywordTracker({ siteId }: { siteId: string | null }) {
    const { t: dict } = useI18n()
    const t = dict.dashboard.seo.keywordTracker

    const [keywords, setKeywords] = useState<TrackedKeyword[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [newKeyword, setNewKeyword] = useState('')

    const trackEvent = async (eventName: string, metadata?: any) => {
        if (!siteId) return
        try {
            await fetch('/api/analytics/track', {
                method: 'POST',
                body: JSON.stringify({
                    siteId,
                    event: eventName,
                    pageUrl: window.location.pathname,
                    metadata
                })
            })
        } catch {}
    }

    useEffect(() => {
        if (!siteId) return
        loadKeywords()
    }, [siteId])

    const loadKeywords = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/seo/keywords?siteId=${siteId}`)
            const json = await res.json()
            if (json.success) {
                setKeywords(json.data.keywords)
            } else {
                toast.error(json.error?.message || t.errorLoad)
            }
        } catch (error) {
            console.error(error)
            toast.error(t.errorLoad)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newKeyword.trim() || !siteId || isAdding) return

        setIsAdding(true)
        try {
            const res = await fetch('/api/seo/keywords', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId, keyword: newKeyword.trim() })
            })
            const json = await res.json()
            if (json.success) {
                setKeywords(prev => [...prev, json.data])
                setNewKeyword('')
                toast.success(t.successAdd)
                trackEvent('add_seo_keyword', { keyword: newKeyword.trim() })
            } else {
                const errCode = json.error?.code
                if (errCode === 'MAX_KEYWORDS_REACHED') {
                    toast.error(t.errorMaxKeywords)
                } else if (errCode === 'KEYWORD_EXISTS') {
                    toast.error(t.errorKeywordExists)
                } else {
                    toast.error(json.error?.message || t.errorAdd)
                }
            }
        } catch (error) {
            toast.error(t.errorConnect)
        } finally {
            setIsLoading(false)
            setIsAdding(false)
        }
    }

    const handleDelete = async (keywordId: string) => {
        if (!siteId) return
        const previous = [...keywords]
        // Optimistic UI update
        setKeywords(keywords.filter(k => k.id !== keywordId))
        
        try {
            const res = await fetch(`/api/seo/keywords?siteId=${siteId}&keywordId=${keywordId}`, {
                method: 'DELETE'
            })
            const json = await res.json()
            if (!json.success) {
                setKeywords(previous)
                toast.error(json.error?.message || t.errorDelete)
            } else {
                trackEvent('remove_seo_keyword')
            }
        } catch (error) {
            setKeywords(previous)
            toast.error(t.errorDelete)
        }
    }

    if (!siteId) return null

    return (
        <Card className="col-span-1 border-muted/50 bg-background/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            {t.title}
                        </CardTitle>
                        <CardDescription>
                            {t.description}
                        </CardDescription>
                    </div>
                    <div className="text-xs font-medium bg-muted/50 px-2 py-1 rounded-md text-muted-foreground">
                        {keywords.length} / 5
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <form onSubmit={handleAdd} className="flex gap-2">
                    <Input
                        placeholder={t.placeholder}
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        disabled={isLoading || isAdding || keywords.length >= 5}
                        className="flex-1"
                    />
                    <Button 
                        type="submit" 
                        disabled={!newKeyword.trim() || isLoading || isAdding || keywords.length >= 5}
                        size="sm"
                    >
                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> {t.add}</>}
                    </Button>
                </form>

                <div className="space-y-2 mt-4">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full rounded-md" />
                        ))
                    ) : keywords.length === 0 ? (
                        <div className="text-center py-6 border border-dashed rounded-md bg-muted/20">
                            <p className="text-sm text-muted-foreground">{t.empty}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {keywords.map(kw => (
                                <div key={kw.id} className="flex items-center justify-between p-3 rounded-md border bg-card hover:bg-muted/30 transition-colors">
                                    <div className="font-medium flex-1 truncate pr-4" title={kw.keyword}>
                                        {kw.keyword}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex items-center gap-1.5 min-w-16 justify-end">
                                            {kw.rank ? (
                                                <>
                                                    <span className="font-bold">#{kw.rank}</span>
                                                    {kw.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
                                                    {kw.trend === 'down' && <TrendingDown className="w-4 h-4 text-rose-500" />}
                                                    {kw.trend === 'same' && <Minus className="w-4 h-4 text-muted-foreground" />}
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground text-xs font-medium bg-muted/30 px-1.5 py-0.5 rounded cursor-help" title={t.notInTopResults}>&gt;30</span>
                                            )}
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(kw.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

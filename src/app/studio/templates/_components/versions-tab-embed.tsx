'use client'
/**
 * versions-tab-embed.tsx
 * Client component for the Versions tab inside the template drawer.
 * Fetches versions for a single template and renders VersionsTimeline.
 */
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { VersionsTimeline, type VersionEntry } from '@/app/studio/versions/_components/versions-timeline'

interface Props {
    templateId: number
}

interface ApiVersion {
    id: number | string
    versionNumber: number
    changelog?: string | null
    createdAt: string
}

export function VersionsTabEmbed({ templateId }: Props) {
    const [versions, setVersions] = useState<VersionEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)

        fetch(`/api/admin/templates/${templateId}/versions`)
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const json = await res.json() as { data: ApiVersion[] }
                return json.data
            })
            .then((data) => {
                if (cancelled) return
                setVersions(
                    data.map((v) => ({
                        id: v.id,
                        versionNumber: v.versionNumber,
                        changelog: v.changelog,
                        createdAt: v.createdAt,
                    })),
                )
            })
            .catch((err: unknown) => {
                if (cancelled) return
                setError(err instanceof Error ? err.message : 'Failed to load versions')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => { cancelled = true }
    }, [templateId])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 text-sm text-destructive">{error}</div>
        )
    }

    return (
        <div className="p-4">
            <VersionsTimeline versions={versions} />
        </div>
    )
}

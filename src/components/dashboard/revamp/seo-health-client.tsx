'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AIFixModal } from '@/components/dashboard/AIFixModal'
import { SeoHealthCard } from './seo-health-card'
import { createSeoHealthBucketViewModel } from '@/lib/dashboard/seo-health-view-model'
import type {
    SeoHealthCardLoadState,
    SeoHealthIssueAction,
} from '@/lib/dashboard/dashboard-types'
import {
    localSeoMetadataDetailResponseSchema,
    localSeoScoreResponseSchema,
    type LocalSeoScoreResponse,
    type MetadataFixItem,
} from '@/lib/seo/local-seo-score-contract'

function bucketProgress(score: number, maximum: number): number {
    return Math.floor((score * 100) / maximum)
}

export function mapLocalSeoResponse(
    response: LocalSeoScoreResponse,
): Extract<SeoHealthCardLoadState, { state: 'ready' }> {
    return {
        state: 'ready',
        score: response.score,
        aiFixableItemCount: response.aiFixableItemCount,
        buckets: {
            business: createSeoHealthBucketViewModel(
                bucketProgress(response.breakdown.businessData, 20),
            ),
            schema: createSeoHealthBucketViewModel(
                bucketProgress(response.breakdown.schema, 35),
            ),
            aiDiscoverability: createSeoHealthBucketViewModel(
                bucketProgress(response.breakdown.aiDiscoverability, 15),
            ),
            technical: createSeoHealthBucketViewModel(
                bucketProgress(response.breakdown.technicalHealth, 30),
            ),
        },
        issues: response.issues,
    }
}

export function seoHealthActionHref(
    action: SeoHealthIssueAction,
): string | null {
    const editor = (siteId: string, query: Record<string, string>) => {
        const params = new URLSearchParams(query)
        return `/editor/${encodeURIComponent(siteId)}?${params.toString()}`
    }

    switch (action.kind) {
        case 'fix-meta-title':
        case 'fix-meta-description':
            return null
        case 'edit-store-name':
            return editor(action.siteId, {
                settingsTab: 'global',
                section: 'brand',
            })
        case 'edit-business-address':
            return editor(action.siteId, {
                settingsTab: 'global',
                section: 'contact',
                focus: 'address',
            })
        case 'edit-phone':
            return editor(action.siteId, {
                settingsTab: 'global',
                section: 'contact',
                focus: 'phone',
            })
        case 'edit-schema-subtype':
            return editor(action.siteId, {
                settingsTab: 'global',
                section: 'localBusiness',
                focus: 'schemaSubtype',
            })
        case 'edit-opening-hours':
            return editor(action.siteId, {
                settingsTab: 'global',
                section: 'localBusiness',
                focus: 'openingHours',
            })
        case 'edit-map-location':
            return editor(action.siteId, {
                settingsTab: 'global',
                section: 'localBusiness',
                focus: 'map',
            })
        case 'edit-price-range':
            return editor(action.siteId, {
                settingsTab: 'global',
                section: 'localBusiness',
                focus: 'priceRange',
            })
        case 'setup-primary-domain':
            return '/settings/domains'
        case 'publish-store':
            return editor(action.siteId, { publish: '1' })
        case 'edit-content':
            return editor(action.siteId, { pageId: action.pageId })
        case 'edit-image-alt':
            return `/products/${encodeURIComponent(action.productId)}`
        case 'setup-search-verification':
            return editor(action.siteId, {
                settingsTab: 'seo',
                section: 'searchVerification',
            })
        default: {
            const exhaustive: never = action
            return exhaustive
        }
    }
}

export function SeoHealthClient({ siteId }: { siteId: string }) {
    const router = useRouter()
    const [data, setData] = useState<SeoHealthCardLoadState>({
        state: 'loading',
    })
    const [fixItems, setFixItems] = useState<MetadataFixItem[] | null>(null)
    const scoreRequest = useRef<AbortController | null>(null)
    const detailRequest = useRef<AbortController | null>(null)
    const generation = useRef(0)
    const revisionToken = useRef<string | null>(null)
    const fixSettledSinceOpen = useRef(false)

    const loadScore = useCallback(async () => {
        const requestGeneration = ++generation.current
        scoreRequest.current?.abort()
        const controller = new AbortController()
        scoreRequest.current = controller
        revisionToken.current = null
        setData({ state: 'loading' })

        try {
            const response = await fetch(
                `/api/sites/${encodeURIComponent(siteId)}/local-seo-score`,
                {
                    cache: 'no-store',
                    signal: controller.signal,
                },
            )
            if (!response.ok)
                throw new Error(
                    `SEO score request failed with ${response.status}`,
                )
            const parsed = localSeoScoreResponseSchema.parse(
                await response.json(),
            )
            if (
                controller.signal.aborted ||
                requestGeneration !== generation.current
            )
                return
            revisionToken.current = parsed.revisionToken
            setData(mapLocalSeoResponse(parsed))
        } catch (error: unknown) {
            if (
                controller.signal.aborted ||
                requestGeneration !== generation.current
            )
                return
            console.error(
                '[SEO Health Client]',
                error instanceof Error
                    ? error.message
                    : 'Invalid score response',
            )
            setData({ state: 'error' })
        }
    }, [siteId])

    useEffect(() => {
        setFixItems(null)
        fixSettledSinceOpen.current = false
        void loadScore()
        return () => {
            generation.current += 1
            scoreRequest.current?.abort()
            detailRequest.current?.abort()
        }
    }, [loadScore])

    const loadMetadataDetails = useCallback(
        async (field?: 'title' | 'description') => {
            if (detailRequest.current) return
            const expectedRevision = revisionToken.current
            if (!expectedRevision) return
            const controller = new AbortController()
            detailRequest.current = controller
            const items: MetadataFixItem[] = []

            try {
                const detailUrl =
                    '/api/sites/' +
                    encodeURIComponent(siteId) +
                    '/local-seo-score?detail=metadata&page=1' +
                    (field ? '&field=' + field : '')
                const response = await fetch(detailUrl, {
                    cache: 'no-store',
                    signal: controller.signal,
                })
                if (!response.ok)
                    throw new Error(
                        `SEO detail request failed with ${response.status}`,
                    )
                const detail = localSeoMetadataDetailResponseSchema.parse(
                    await response.json(),
                )
                if (detail.revisionToken !== expectedRevision) {
                    throw new Error(
                        'SEO inputs changed before metadata details loaded',
                    )
                }
                items.push(...detail.items)
                if (controller.signal.aborted) return
                fixSettledSinceOpen.current = false
                setFixItems(
                    field
                        ? items.filter((item) =>
                              item.missingFields.includes(field),
                          )
                        : items,
                )
            } catch (error: unknown) {
                if (controller.signal.aborted) return
                console.error(
                    '[SEO Health Detail]',
                    error instanceof Error
                        ? error.message
                        : 'Invalid detail response',
                )
                revisionToken.current = null
                setData({ state: 'error' })
            } finally {
                if (detailRequest.current === controller)
                    detailRequest.current = null
            }
        },
        [siteId],
    )

    const handleIssueAction = useCallback(
        (action: SeoHealthIssueAction) => {
            if (action.kind === 'fix-meta-title') {
                void loadMetadataDetails('title')
                return
            }
            if (action.kind === 'fix-meta-description') {
                void loadMetadataDetails('description')
                return
            }
            const href = seoHealthActionHref(action)
            if (href) router.push(href)
        },
        [loadMetadataDetails, router],
    )

    const closeFixModal = useCallback(() => {
        setFixItems(null)
        if (!fixSettledSinceOpen.current) void loadScore()
        fixSettledSinceOpen.current = false
    }, [loadScore])

    return (
        <>
            <SeoHealthCard
                data={data}
                onIssueAction={handleIssueAction}
                onFixAllMetadata={() => {
                    void loadMetadataDetails()
                }}
                onRetry={() => {
                    void loadScore()
                }}
            />
            <AIFixModal
                isOpen={fixItems !== null}
                onClose={closeFixModal}
                onSettled={() => {
                    fixSettledSinceOpen.current = true
                    void loadScore()
                }}
                siteId={siteId}
                revisionToken={revisionToken.current}
                missingSeoItems={fixItems ?? []}
            />
        </>
    )
}

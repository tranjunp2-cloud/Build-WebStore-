import type { BasePayload } from 'payload'
import type {
    ImageAspect,
    StockImageCandidate,
    StockProvider,
} from '@/lib/ai/image-sourcing/contracts'
import { hasReusableStockLicense } from '@/lib/ai/image-sourcing/license'

import {
    createS3StockObjectStore,
    downloadAndValidateStockImage,
    stockObjectKey,
    type StockObjectStore,
} from './stock-image'

export interface CatalogDemand {
    subject: string
    category: string
    aspect: ImageAspect
}

export interface CatalogImage {
    catalogId: number
    mediaId: number
    provider: StockProvider
    providerImageId: string
    objectKey: string
    sourceUrl: string
    creator: string
    licenseName: string
    licenseUrl: string
    attribution: string
    tags: string[]
    normalizedTerms: string
    category: string
    width: number
    height: number
    aspect: number
    active: boolean
    useCount: number
    lastUsedAt: Date | null
}

export type CatalogStockImageCandidate = StockImageCandidate & {
    catalogId: number
    mediaId: number
    objectKey: string
}

type QueryResult<T> = { rows: T[] }
type Queryable = {
    query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<T>>
}
type TransactionClient = Queryable & { release(): void }
type CatalogPool = Queryable & { connect(): Promise<TransactionClient> }

interface CatalogRow {
    id: string | number
    media_id: number
    provider: StockProvider
    provider_image_id: string
    object_key: string
    source_url: string
    creator: string | null
    license_name: string
    license_url: string
    attribution: string | null
    tags: string[]
    normalized_terms: string
    category: string
    width: number
    height: number
    aspect: number
    active: boolean
    use_count: number
    last_used_at: Date | string | null
}

export interface StockCatalogRepository {
    searchCatalog(demand: CatalogDemand, selectedIds: ReadonlySet<string>): Promise<CatalogImage[]>
    persistStockCandidate(candidate: StockImageCandidate): Promise<CatalogImage>
    markCatalogUsed(ids: readonly number[]): Promise<void>
    objectExists(objectKey: string): Promise<boolean>
}

function getPool(payload: BasePayload): CatalogPool {
    return (payload.db as unknown as { pool: CatalogPool }).pool
}

export function stockProviderIdentity(provider: StockProvider, providerImageId: string): string {
    return `${provider}:${providerImageId}`
}

export function normalizeCatalogTerms(value: string): string {
    return value
        .normalize('NFC')
        .toLocaleLowerCase('en')
        .replace(/[\p{P}\p{S}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ')
}

function mapCatalogRow(row: CatalogRow): CatalogImage {
    return {
        catalogId: Number(row.id),
        mediaId: row.media_id,
        provider: row.provider,
        providerImageId: row.provider_image_id,
        objectKey: row.object_key,
        sourceUrl: row.source_url,
        creator: row.creator ?? '',
        licenseName: row.license_name,
        licenseUrl: row.license_url,
        attribution: row.attribution ?? '',
        tags: row.tags ?? [],
        normalizedTerms: row.normalized_terms,
        category: row.category,
        width: row.width,
        height: row.height,
        aspect: row.aspect,
        active: row.active,
        useCount: row.use_count,
        lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
    }
}

export function catalogImageToCandidate(image: CatalogImage): CatalogStockImageCandidate {
    return {
        provider: image.provider,
        providerImageId: image.providerImageId,
        previewUrl: image.sourceUrl,
        downloadUrl: image.sourceUrl,
        sourceUrl: image.sourceUrl,
        creator: image.creator,
        licenseName: image.licenseName,
        licenseUrl: image.licenseUrl,
        attribution: image.attribution,
        tags: image.tags,
        category: image.category,
        width: image.width,
        height: image.height,
        aspect: image.aspect,
        active: image.active,
        mediaId: image.mediaId,
        objectKey: image.objectKey,
        useCount: image.useCount,
        lastUsedAt: image.lastUsedAt,
        alt: image.tags[0],
        catalogId: image.catalogId,
    }
}

function validateCandidate(candidate: StockImageCandidate): void {
    if (!candidate.providerImageId.trim()) throw new Error('STOCK_PROVIDER_ID_REQUIRED')
    try {
        const source = new URL(candidate.sourceUrl)
        const license = new URL(candidate.licenseUrl)
        const expectedSourceHost =
            candidate.provider === 'wikimedia' ? 'commons.wikimedia.org' : 'pixabay.com'
        if (
            source.protocol !== 'https:'
            || source.hostname !== expectedSourceHost
            || license.protocol !== 'https:'
        ) {
            throw new Error('invalid')
        }
    } catch {
        throw new Error('STOCK_SOURCE_URL_REQUIRED')
    }
    if (!candidate.licenseName.trim()) throw new Error('STOCK_LICENSE_REQUIRED')
    if (!hasReusableStockLicense(candidate)) throw new Error('STOCK_LICENSE_NOT_REUSABLE')
    if (candidate.width <= 0 || candidate.height <= 0 || candidate.aspect <= 0) {
        throw new Error('STOCK_DIMENSIONS_REQUIRED')
    }
    if (!candidate.attribution.trim()) throw new Error('STOCK_ATTRIBUTION_REQUIRED')
    if (candidate.provider === 'wikimedia' && !candidate.creator.trim()) {
        throw new Error('WIKIMEDIA_ATTRIBUTION_REQUIRED')
    }
}

const CATALOG_COLUMNS = `id, media_id, provider, provider_image_id, object_key,
    source_url, creator, license_name, license_url, attribution, tags,
    normalized_terms, category, width, height, aspect, active, use_count, last_used_at`

export function createStockCatalogRepository(
    payload: BasePayload,
    {
        objectStore = createS3StockObjectStore(),
        fetchImpl = fetch,
    }: {
        objectStore?: StockObjectStore
        fetchImpl?: typeof fetch
    } = {},
): StockCatalogRepository {
    const pool = getPool(payload)

    return {
        async searchCatalog(demand, selectedIds) {
            const subjectTerms = normalizeCatalogTerms(demand.subject).split(' ').filter(Boolean)
            if (subjectTerms.length === 0) return []
            const tsQuery = [...new Set(subjectTerms)]
                .map((term) => term.replace(/[':&|!()]/g, ''))
                .filter(Boolean)
                .join(' | ')
            if (!tsQuery) return []

            const selected = [...selectedIds]
            const rows = await pool.query<CatalogRow>(
                `SELECT ${CATALOG_COLUMNS},
                    ts_rank(search_vector, to_tsquery('simple', $1)) AS text_rank
                 FROM stock_image_catalog
                 WHERE active = true
                   AND license_name <> ''
                   AND license_url <> ''
                   AND category = $2
                   AND media_id IS NOT NULL
                   AND object_key IS NOT NULL
                   AND (
                     ($3 = 'landscape' AND width::numeric / NULLIF(height, 0) >= 1.25)
                     OR ($3 = 'square' AND width::numeric / NULLIF(height, 0) BETWEEN 0.80 AND 1.25)
                   )
                   AND search_vector @@ to_tsquery('simple', $1)
                   AND NOT ((provider || ':' || provider_image_id) = ANY($4::text[]))
                 ORDER BY text_rank DESC, use_count ASC, last_used_at ASC NULLS FIRST,
                          provider ASC, provider_image_id ASC
                 LIMIT 200`,
                [tsQuery, normalizeCatalogTerms(demand.category), demand.aspect, selected],
            )

            return rows.rows.map(mapCatalogRow)
        },

        async persistStockCandidate(candidate) {
            validateCandidate(candidate)
            const existing = await pool.query<CatalogRow>(
                `SELECT ${CATALOG_COLUMNS}
                 FROM stock_image_catalog
                 WHERE provider = $1 AND provider_image_id = $2
                 LIMIT 1`,
                [candidate.provider, candidate.providerImageId],
            )
            if (existing.rows[0] && await objectStore.objectExists(existing.rows[0].object_key)) {
                return mapCatalogRow(existing.rows[0])
            }

            const image = await downloadAndValidateStockImage(candidate.downloadUrl, fetchImpl)
            const objectKey = stockObjectKey(candidate.provider, candidate.providerImageId, image.extension)
            await objectStore.put(objectKey, image)

            const client = await pool.connect()
            let committed: CatalogRow
            try {
                await client.query('BEGIN')
                await client.query(
                    'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
                    [candidate.provider, candidate.providerImageId],
                )
                const winner = await client.query<CatalogRow>(
                    `SELECT ${CATALOG_COLUMNS}
                     FROM stock_image_catalog
                     WHERE provider = $1 AND provider_image_id = $2
                     LIMIT 1`,
                    [candidate.provider, candidate.providerImageId],
                )
                if (winner.rows[0]) {
                    committed = winner.rows[0]
                } else {
                    const media = await client.query<{ id: number }>(
                        `INSERT INTO media (
                           alt, filename, mime_type, filesize, width, height,
                           ai_generated, source_provider, source_url, license_name,
                           license_url, attribution, updated_at, created_at
                         )
                         VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8, $9, $10, $11, now(), now())
                         RETURNING id`,
                        [
                            candidate.alt || candidate.tags.join(' ') || candidate.category,
                            objectKey,
                            image.mimeType,
                            image.size,
                            candidate.width,
                            candidate.height,
                            candidate.provider,
                            candidate.sourceUrl,
                            candidate.licenseName,
                            candidate.licenseUrl,
                            candidate.attribution || null,
                        ],
                    )
                    const inserted = await client.query<CatalogRow>(
                        `INSERT INTO stock_image_catalog (
                           provider, provider_image_id, object_key, media_id, source_url,
                           creator, license_name, license_url, attribution, tags,
                           normalized_terms, category, width, height, aspect, active
                         )
                         VALUES (
                           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[],
                           $11, $12, $13, $14, $15, $16
                         )
                         ON CONFLICT (provider, provider_image_id) DO UPDATE
                           SET updated_at = now()
                         RETURNING ${CATALOG_COLUMNS}`,
                        [
                            candidate.provider,
                            candidate.providerImageId,
                            objectKey,
                            media.rows[0].id,
                            candidate.sourceUrl,
                            candidate.creator || null,
                            candidate.licenseName,
                            candidate.licenseUrl,
                            candidate.attribution || null,
                            candidate.tags,
                            normalizeCatalogTerms(
                                [...candidate.tags, candidate.alt ?? '', candidate.category].join(' '),
                            ),
                            normalizeCatalogTerms(candidate.category),
                            candidate.width,
                            candidate.height,
                            candidate.aspect,
                            candidate.active,
                        ],
                    )
                    committed = inserted.rows[0]
                }
                await client.query('COMMIT')
            } catch (error) {
                await client.query('ROLLBACK')
                throw error
            } finally {
                client.release()
            }

            if (!await objectStore.objectExists(committed.object_key, true)) {
                throw new Error('STOCK_OBJECT_MISSING_AFTER_COMMIT')
            }
            return mapCatalogRow(committed)
        },

        async markCatalogUsed(ids) {
            const uniqueIds = [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))]
            if (uniqueIds.length === 0) return
            await pool.query(
                `UPDATE stock_image_catalog
                 SET use_count = use_count + 1, last_used_at = now(), updated_at = now()
                 WHERE id = ANY($1::bigint[])`,
                [uniqueIds],
            )
        },

        objectExists(objectKey) {
            return objectStore.objectExists(objectKey)
        },
    }
}

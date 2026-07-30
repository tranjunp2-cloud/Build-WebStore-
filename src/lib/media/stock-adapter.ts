import type { BasePayload } from 'payload'

import {
    catalogImageToCandidate,
    createStockCatalogRepository,
    type CatalogDemand,
    type CatalogImage,
    type CatalogStockImageCandidate,
} from './stock-catalog'
import { createS3StockObjectStore, type StockImageCandidate } from './stock-image'

const objectStore = createS3StockObjectStore()

export function createF38StockInfrastructure(payload: BasePayload) {
    const repository = createStockCatalogRepository(payload, { objectStore })
    const pool = (payload.db as unknown as {
        pool: {
            query<T = Record<string, unknown>>(
                text: string,
                values?: unknown[],
            ): Promise<{ rows: T[] }>
        }
    }).pool

    return {
        async searchCatalog(
            demand: CatalogDemand,
            selectedIds: ReadonlySet<string> = new Set<string>(),
        ): Promise<CatalogStockImageCandidate[]> {
            const images = await repository.searchCatalog(demand, selectedIds)
            return images.map(catalogImageToCandidate)
        },
        async persistStockCandidate(candidate: StockImageCandidate): Promise<CatalogImage> {
            return repository.persistStockCandidate(candidate)
        },
        async persistExternal(candidate: StockImageCandidate) {
            const image = await repository.persistStockCandidate(candidate)
            return {
                candidate: catalogImageToCandidate(image),
                mediaId: image.mediaId,
                objectKey: image.objectKey,
            }
        },
        markCatalogUsed: repository.markCatalogUsed,
        objectExists: repository.objectExists,
        async readSiteStockAssignments(siteId: number) {
            const result = await pool.query<{ image_library: Record<string, number> | null }>(
                'SELECT image_library FROM sites WHERE id = $1 LIMIT 1',
                [siteId],
            )
            return Object.entries(result.rows[0]?.image_library ?? {}).map(([slot, mediaId]) => ({
                slot,
                mediaId,
            }))
        },
        async replaceSiteStockAssignments(
            siteId: number,
            assignments: ReadonlyArray<{ slot: string; mediaId: number }>,
        ) {
            const imageLibrary = Object.fromEntries(
                assignments.map(({ slot, mediaId }) => [slot, mediaId]),
            )
            await pool.query(
                'UPDATE sites SET image_library = $2::jsonb, updated_at = now() WHERE id = $1',
                [siteId, JSON.stringify(imageLibrary)],
            )
            return assignments
        },
    }
}

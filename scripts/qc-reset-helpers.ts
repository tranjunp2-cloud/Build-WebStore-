import type { Payload } from 'payload'

const MAX_QC_RESET_BATCHES = 10_000

export async function wipeQcCollection(
  payload: Payload,
  slug: string,
): Promise<number> {
  let total = 0
  const deletedDocumentIds = new Set<string>()

  for (let batch = 0; batch < MAX_QC_RESET_BATCHES; batch++) {
    const { docs } = await payload.find({
      collection: slug as never,
      limit: 100,
      overrideAccess: true,
      depth: 0,
    })
    if (!docs.length) return total

    const failedDeletes: string[] = []
    for (const doc of docs) {
      const documentId = String(doc.id)
      if (deletedDocumentIds.has(documentId)) {
        throw new Error(
          `QC reset made no progress for ${slug}: document ${documentId} was returned after deletion`,
        )
      }
      try {
        await payload.delete({ collection: slug as never, id: doc.id, overrideAccess: true })
        deletedDocumentIds.add(documentId)
        total++
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 120) : 'unknown'
        failedDeletes.push(`${slug}#${doc.id}: ${msg}`)
      }
    }
    if (failedDeletes.length > 0) {
      throw new Error(
        `Failed to delete ${failedDeletes.length} document(s): ${failedDeletes.slice(0, 3).join('; ')}`,
      )
    }
  }

  throw new Error(
    `QC reset exceeded ${MAX_QC_RESET_BATCHES} batches for ${slug}; refusing to report a partial reset as successful`,
  )
}

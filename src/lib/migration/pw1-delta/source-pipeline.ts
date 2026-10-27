/**
 * Runs the read side of the original PW1 pipeline for one CSV snapshot, calling its library functions
 * (no old script is executed and no old file is modified):
 *   createSnapshotConfig → exportMaster → prepareImportArtifact → loadImportArtifact
 * Entities are then produced per store with the same `buildEntities` arguments the original runner used.
 */
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import type { SanitizedCollectionConfig } from 'payload'
import { createSnapshotConfig } from '../pw1-export/snapshot-config'
import { exportMaster } from '../pw1-export/export-master'
import { prepareImportArtifact } from '../pw1-json/credentials'
import { loadImportArtifact, readImportStore } from '../pw1-json/artifact'
import { buildEntities, type Entity } from '../pw1-json/projection'
import type { ImportArtifact } from '../pw1-json/types'

export type Side = 'old' | 'new'
export type Log = (line: string) => void

export interface PreparedSide {
  side: Side
  artifact: ImportArtifact
  namespace: string
  actorRefs: Set<string>
  exportOutcome: unknown
  timings: Record<string, number>
}

async function timed<T>(timings: Record<string, number>, step: string, log: Log, run: () => Promise<T>): Promise<T> {
  const started = Date.now()
  log(`  ${step}…`)
  const result = await run()
  timings[step] = Date.now() - started
  log(`  ${step} done in ${(timings[step] / 1000).toFixed(1)}s (rss ${(process.memoryUsage().rss / 1024 ** 3).toFixed(1)} GB)`)
  return result
}

export async function prepareSide(options: {
  side: Side; csvDir: string; profile: string; snapshotId: string; asOf: string; runDir: string; log: Log
}): Promise<PreparedSide> {
  const { side, csvDir, log } = options
  const sideDir = path.join(options.runDir, side)
  const timings: Record<string, number> = {}
  await mkdir(sideDir, { mode: 0o700 })
  const configPath = path.join(sideDir, 'source-config.json')
  const exportDir = path.join(sideDir, 'export'), importDir = path.join(sideDir, 'import')
  log(`[${side}] ${csvDir}`)
  await timed(timings, 'snapshot-config', log, () => createSnapshotConfig({
    inputDir: csvDir, profile: options.profile, snapshotId: options.snapshotId, asOf: options.asOf, output: configPath,
  }))
  const exported = await timed(timings, 'export', log, () => exportMaster(csvDir, configPath, exportDir))
  const { manifestPath } = await timed(timings, 'prepare', log, () => prepareImportArtifact({ exportArtifact: exportDir, output: importDir }))
  // The prepared artifact holds a verified copy of every export file; drop the duplicate to save disk.
  await rm(exportDir, { recursive: true, force: true })
  const artifact = await timed(timings, 'load', log, () => loadImportArtifact(manifestPath, { spoolDirectory: sideDir }))
  return {
    side, artifact, timings,
    namespace: `${artifact.manifest.sourceInstance}:${artifact.manifest.snapshotId}`,
    actorRefs: new Set(artifact.actors?.actors.map(actor => actor._ref) ?? []),
    exportOutcome: (exported as { outcome?: unknown }).outcome ?? null,
  }
}

/** Same call as the original runner (`pw1-json/runner.ts`), so checksums are comparable with its ledger. */
export async function storeEntities(prepared: PreparedSide, storeId: string, configs: Record<string, SanitizedCollectionConfig>): Promise<Entity[]> {
  const { artifact } = prepared
  if (!artifact.storeIds.includes(storeId)) return []
  return buildEntities(await readImportStore(artifact, storeId), configs, prepared.namespace, prepared.actorRefs,
    artifact.preserveInvalidUserEmails, artifact.delegateRawPageContent, artifact.delegateRawModelSettings)
}

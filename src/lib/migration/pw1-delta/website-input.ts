/**
 * Builds `website-input.json` for `npm run migrate:pw1:website -- <file>`: master store bundles (new side)
 * with `destination` set to the PW2 tenant/site, so the website migration never provisions a duplicate.
 * Included stores: stores created by this delta, and stores whose pages/site content changed while their
 * website was not generated yet. Without the old snapshot, "changed" means a changed `sites` (or `pages`)
 * document in this run. Generated websites are listed separately and never included.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { checksum } from '../pw1-json/projection'
import type { PreparedSide } from './source-pipeline'
import type { TargetResolver } from './delta-targets'

type Bundle = Record<string, unknown> & { pages?: unknown; sites?: unknown[] }

function storeIdOf(bundle: Bundle): string | null {
  const tenant = Array.isArray(bundle.tenants) ? bundle.tenants[0] as { metaData?: unknown } | undefined : undefined
  let meta = tenant?.metaData
  if (typeof meta === 'string') { try { meta = JSON.parse(meta) } catch { meta = null } }
  const id = meta && typeof meta === 'object' ? (meta as { pw1StoreId?: unknown }).pw1StoreId : undefined
  return /^\d+$/.test(String(id)) ? String(id) : null
}

/** Website-relevant content of a store: its raw pages and its site document. */
const websiteHash = (bundle: Bundle) => checksum({ pages: bundle.pages ?? null, sites: bundle.sites ?? null })

async function* bundles(side: PreparedSide): AsyncGenerator<Bundle> {
  for (const part of side.artifact.masterParts ?? []) {
    const stores = JSON.parse(await readFile(path.join(side.artifact.directory, part.filename), 'utf8')) as Bundle[]
    for (const store of stores) yield store
  }
}

export async function buildWebsiteInput(input: {
  old: PreparedSide | null; next: PreparedSide; resolver: TargetResolver; createdStores: ReadonlySet<string>
  siteChanged: ReadonlySet<string>; generatedStores: ReadonlySet<string>
  /** Stores with a failed or conflicting write this run: never handed to the website migration. */
  failedStores: ReadonlySet<string>
  /** --store: only these stores. */
  onlyStores: ReadonlySet<string> | null
}): Promise<{ entries: Bundle[]; skippedGenerated: string[]; missingDestination: string[]; skippedFailed: string[] }> {
  const before = new Map<string, string>()
  if (input.old) for await (const bundle of bundles(input.old)) { const id = storeIdOf(bundle); if (id) before.set(id, websiteHash(bundle)) }
  const entries: Bundle[] = [], skippedGenerated: string[] = [], missingDestination: string[] = [], skippedFailed: string[] = []
  for await (const bundle of bundles(input.next)) {
    const id = storeIdOf(bundle)
    if (!id || (input.onlyStores && !input.onlyStores.has(id))) continue
    const created = input.createdStores.has(id)
    const changed = input.old ? before.get(id) !== websiteHash(bundle) : input.siteChanged.has(id)
    if (!created && !changed) continue
    if (input.generatedStores.has(id)) { skippedGenerated.push(id); continue }
    if (input.failedStores.has(id)) { skippedFailed.push(id); continue }
    const tenantId = input.resolver.lookup(`@tenants:stores:${id}`, 'tenants')
    const siteId = input.resolver.lookup(`@sites:stores:${id}`, 'sites')
    if (tenantId === undefined || siteId === undefined) { missingDestination.push(id); continue }
    entries.push({ ...bundle, destination: { tenantId, siteId, productCategories: [] } })
  }
  return { entries, skippedGenerated, missingDestination, skippedFailed }
}

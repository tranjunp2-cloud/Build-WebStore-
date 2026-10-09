import { parseArgs } from 'node:util'
import { dirname, resolve } from 'node:path'
import { z } from 'zod'
import { readBoundFile } from './artifact'
import { argumentsFor, type Arguments } from './runner'
import { MigrationError } from './errors'
import { normalizeStoreId, compareStoreIds } from './selectors'

const path = z.string().min(1)
export const workflowConfigSchema = z.object({
  version: z.literal(1), exportArtifact: path, credentials: path.optional(),
  localDatabase: z.string().regex(/^[a-zA-Z0-9_]+$/), targetHost: z.string().regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+neon\.tech$/i).optional(), outputRoot: path,
  systemCreator: z.object({ sourceRef: z.string().regex(/^@users:users:[1-9]\d*$/), approvedBy: z.string().trim().min(1) }).strict().optional(),
  creatorBindings: path.optional(),
}).strict().refine(value => !(value.systemCreator && value.creatorBindings), 'Only one creator binding mode allowed')
export type WorkflowConfig = z.infer<typeof workflowConfigSchema>
export async function loadWorkflowConfig(filename: string): Promise<WorkflowConfig> {
  const file = resolve(filename)
  const result = workflowConfigSchema.safeParse((await readBoundFile(file, { json: true, maxBytes: 64 * 1024 })).value)
  if (!result.success) throw new MigrationError('WORKFLOW_CONFIG_INVALID')
  const config = result.data
  return { ...config, exportArtifact: resolve(dirname(file), config.exportArtifact), outputRoot: resolve(dirname(file), config.outputRoot),
    ...(config.credentials ? { credentials: resolve(dirname(file), config.credentials) } : {}),
    ...(config.creatorBindings ? { creatorBindings: resolve(dirname(file), config.creatorBindings) } : {}) }
}
export interface WorkflowArgs { config?: string; run?: string; continue?: boolean; exportOnly?: boolean; selection: Arguments }
export function workflowArguments(args: string[]): WorkflowArgs {
  const { values } = parseArgs({ args, strict: true, allowPositionals: false, options: {
    config: { type: 'string' }, run: { type: 'string' }, continue: { type: 'boolean' }, 'export-only': { type: 'boolean' },
    all: { type: 'boolean' }, store: { type: 'string' }, stores: { type: 'string' }, 'from-store': { type: 'string' }, 'to-store': { type: 'string' },
    'dry-run': { type: 'boolean' }, 'group-size': { type: 'string' },
  } })
  if (Boolean(values.config) === Boolean(values.run)) throw new MigrationError('WORKFLOW_INPUT_REQUIRED')
  if (values.run) {
    if (Boolean(values.continue) === Boolean(values['export-only']) || Object.keys(values).some(key => !['run', 'continue', 'export-only'].includes(key))) throw new MigrationError('WORKFLOW_CONTINUE_FLAGS_INVALID')
    return { run: resolve(values.run), continue: values.continue, exportOnly: values['export-only'], selection: {} }
  }
  if (values.continue !== undefined || values['export-only'] !== undefined) throw new MigrationError('WORKFLOW_CONTINUE_FLAGS_INVALID')
  const legacy = ['--manifest', '/unused']
  for (const [key, value] of Object.entries(values)) {
    if (key === 'config' || value === undefined) continue
    if (value === true) legacy.push(`--${key}`)
    else if (typeof value === 'string') legacy.push(`--${key}`, value)
  }
  const { manifest: _manifest, ...selection } = argumentsFor(legacy)
  if (selection.store !== undefined) normalizeStoreId(selection.store)
  if (selection.stores !== undefined) selection.stores.split(',').forEach(normalizeStoreId)
  if (selection.fromStore !== undefined && selection.toStore !== undefined) {
    const from = normalizeStoreId(selection.fromStore), to = normalizeStoreId(selection.toStore)
    if (compareStoreIds(from, to) > 0) throw new MigrationError('STORE_RANGE_REVERSED')
  }
  return { config: resolve(values.config!), selection }
}

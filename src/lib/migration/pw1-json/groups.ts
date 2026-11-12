import { MigrationError } from './errors'
export function storeGroups(ids: readonly string[], size = 100): string[][] {
  if (!Number.isSafeInteger(size) || size < 1 || size > 100) throw new MigrationError('GROUP_SIZE_ARGUMENT_INVALID')
  return Array.from({ length: Math.ceil(ids.length / size) }, (_, i) => ids.slice(i * size, (i + 1) * size))
}

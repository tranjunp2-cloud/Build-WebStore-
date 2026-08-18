import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const DB_SETUP = fs.readFileSync(path.resolve(process.cwd(), 'scripts/db-setup.js'), 'utf8')

describe('retired stock image catalog', () => {
  it('does not provision or destructively drop the catalog table', () => {
    expect(DB_SETUP).not.toContain('CREATE TABLE IF NOT EXISTS stock_image_catalog')
    expect(DB_SETUP).not.toContain('CREATE INDEX IF NOT EXISTS stock_image_catalog_')
    expect(DB_SETUP).not.toMatch(/DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+stock_image_catalog/i)
  })

  it('does not ship the retired catalog runtime modules', () => {
    for (const file of [
      'src/lib/media/stock-catalog.ts',
      'src/lib/media/stock-adapter.ts',
      'src/lib/media/stock-image.ts',
      'src/lib/ai/image-sourcing/runtime.ts',
    ]) {
      expect(fs.existsSync(path.resolve(process.cwd(), file))).toBe(false)
    }
  })
})

/**
 * TC-AISEC-037 — the CI guard finds an import chain from src/payload.config.ts back to itself (the C5 production-build
 * break) and ignores the safe forms: type-only imports and a lazy `await import('@payload-config')`.
 * Real: scripts/check-payload-cycles.mjs on a throwaway repo in a temp dir. Faked: nothing.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { findPayloadCycles } from '../../../../scripts/check-payload-cycles.mjs'

let root = ''
const write = (file: string, source: string) => {
    const full = path.join(root, 'src', file)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, source)
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-cycles-'))
    write(
        'payload.config.ts',
        [
            "import { buildConfig } from 'payload'",
            "import { Users } from './collections/Users'",
            "import { Pages } from './collections/Pages'",
            'export default buildConfig({ collections: [Users, Pages] })',
        ].join('\n'),
    )
    write('collections/Pages.ts', "import type { Config } from '@payload-config'\nimport { type Payload } from '@/lib/types'\nexport const Pages = {}\n")
    write('lib/types.ts', "import config from '@payload-config'\nexport type Payload = typeof config\n")
    write(
        'collections/Users.ts',
        "import { sendEmail } from '@/lib/email/send'\nexport const Users = { hooks: { afterChange: [sendEmail] } }\n",
    )
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('Payload import cycle guard [TC-AISEC-037]', () => {
    it('reports the chain when a collection reaches the config through a static import', () => {
        write('lib/email/send.ts', "import config from '@payload-config'\nexport async function sendEmail() { return config }\n")

        const cycles = findPayloadCycles(root)

        expect(cycles).toEqual([['payload.config.ts', 'collections/Users.ts', 'lib/email/send.ts', 'payload.config.ts']])
    })

    it('ignores type-only imports and a lazy await import() of the config', () => {
        write(
            'lib/email/send.ts',
            "export async function sendEmail() {\n  const { default: config } = await import('@payload-config')\n  return config\n}\n",
        )

        const cycles = findPayloadCycles(root)

        expect(cycles).toEqual([])
    })
})

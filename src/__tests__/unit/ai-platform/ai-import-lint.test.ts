/**
 * TC-AILG-01 — prime-web source may not import a model SDK. ESLint (no-restricted-imports in
 * eslint.config.mjs) forbids `openai`, `ai` and `openai/*`, `@ai-sdk/*` in src/** (tests excluded).
 * The rule is run through the project's own ESLint config, on probe files whose paths are inside src/.
 * This app lints with the flat config (`eslint .`), hence the default ESLint class.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { ESLint } from 'eslint'

let eslint: ESLint

beforeAll(() => {
    eslint = new ESLint({ cwd: process.cwd() })
})

async function restrictedImportMessages(code: string, filePath: string): Promise<string[]> {
    const [result] = await eslint.lintText(code, { filePath })
    return (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-imports').map((m) => m.message)
}

describe('no-restricted-imports: model SDKs stay in ai-platform [TC-AILG-01]', () => {
    it('flags a direct openai import in prime-web source', async () => {
        const messages = await restrictedImportMessages("import OpenAI from 'openai'\nexport default OpenAI\n", 'src/lib/ai/probe.ts')

        expect(messages).toHaveLength(1)
        expect(messages[0]).toContain('Call an AI platform task instead')
    })

    it('flags the Vercel AI SDK and the provider sub-packages', async () => {
        const aiSdk = await restrictedImportMessages("import { generateText } from 'ai'\nexport { generateText }\n", 'src/lib/ai/probe.ts')
        const provider = await restrictedImportMessages("import { openai } from '@ai-sdk/openai'\nexport { openai }\n", 'src/lib/ai/probe.ts')
        const subpath = await restrictedImportMessages("import x from 'openai/resources'\nexport default x\n", 'src/lib/ai/probe.ts')

        expect(aiSdk).toHaveLength(1)
        expect(provider).toHaveLength(1)
        expect(subpath).toHaveLength(1)
    })

    it('allows the platform helpers prime-web is meant to use', async () => {
        const messages = await restrictedImportMessages(
            "import { completeComposed } from '@/lib/ai-platform/actor-scope'\nexport { completeComposed }\n",
            'src/lib/ai/probe.ts',
        )

        expect(messages).toEqual([])
    })

    it('does not apply inside the test tree', async () => {
        const messages = await restrictedImportMessages("import OpenAI from 'openai'\nexport default OpenAI\n", 'src/__tests__/unit/probe.test.ts')

        expect(messages).toEqual([])
    })

    it('exempts no route: the former edit-block path is restricted like every other file', async () => {
        const code = "import OpenAI from 'openai'\nexport default OpenAI\n"
        const formerEditBlock = await restrictedImportMessages(code, 'src/app/api/ai/edit-block/route.ts')
        const sibling = await restrictedImportMessages(code, 'src/app/api/ai/rewrite-text/route.ts')

        expect(formerEditBlock).toHaveLength(1)
        expect(sibling).toHaveLength(1)
    })
})

import { expect, test, type Page } from '@playwright/test'
import {
    CONTENT_FIELDS,
    USER_PRESERVE_MEDIA_FIELDS,
    USER_PRESERVE_NESTED_MEDIA_FIELDS,
} from '../src/lib/ai/pages-schema'
import { assertAllowedAuthenticatedE2ETarget } from './helpers/authenticated-target'

type Block = Record<string, unknown> & { blockType?: string; id?: string }

type EditorData = {
    site?: {
        theme?: Record<string, unknown>
        headerBlock?: Block | null
        footerBlock?: Block | null
        globalBlocks?: Record<string, Block | null> | null
    }
    page?: {
        layout?: Block[]
        localeContent?: Record<string, unknown>
    } | null
}

type TemplateApplyEnvelope = {
    success?: boolean
    data?: { unmatchedBlocks?: string[] }
}

const SYSTEM_KEYS = new Set(['id', '_uuid', '_order', '_parent_id', '_path', 'createdAt', 'updatedAt'])
const MINIMUM_SWAP_COUNT = 10

function canonicalizeContent(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalizeContent)
    if (!value || typeof value !== 'object') return value

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(([key]) => !SYSTEM_KEYS.has(key))
            .map(([key, child]) => [key, canonicalizeContent(child)]),
    )
}

function preservableFields(blockType: string): string[] {
    const nestedField = USER_PRESERVE_NESTED_MEDIA_FIELDS[blockType]?.field
    return [
        ...(CONTENT_FIELDS[blockType] ?? []),
        ...(USER_PRESERVE_MEDIA_FIELDS[blockType] ?? []),
        ...(nestedField ? [nestedField] : []),
    ]
}

function expectEquivalentContentPreserved(
    before: Block[],
    after: Block[],
    unmatchedBlockTypes: ReadonlySet<string> = new Set(),
): void {
    const afterByType = new Map<string, Block[]>()
    for (const block of after) {
        if (!block.blockType) continue
        const group = afterByType.get(block.blockType) ?? []
        group.push(block)
        afterByType.set(block.blockType, group)
    }

    const seenByType = new Map<string, number>()
    for (const block of before) {
        const blockType = block.blockType
        if (!blockType) continue
        const index = seenByType.get(blockType) ?? 0
        seenByType.set(blockType, index + 1)
        const equivalent = afterByType.get(blockType)?.[index]
        if (!equivalent) {
            expect(
                unmatchedBlockTypes.has(blockType),
                `${blockType}[${index}] must be preserved or explicitly reported as unmatched`,
            ).toBe(true)
            continue
        }

        if (block.id) expect(equivalent.id, `${blockType}[${index}] stable id`).toBe(block.id)
        for (const field of preservableFields(blockType)) {
            if (!Object.prototype.hasOwnProperty.call(block, field)) continue
            expect(
                canonicalizeContent(equivalent[field]),
                `${blockType}[${index}].${field}`,
            ).toEqual(canonicalizeContent(block[field]))
        }
    }
}

function expectEditorContentPreserved(
    before: EditorData,
    after: EditorData,
    unmatchedBlockTypes: ReadonlySet<string> = new Set(),
): void {
    expectEquivalentContentPreserved(before.page?.layout ?? [], after.page?.layout ?? [], unmatchedBlockTypes)
    if (before.site?.headerBlock) {
        expect(after.site?.headerBlock, 'header block must remain present').toBeTruthy()
        expectEquivalentContentPreserved([before.site.headerBlock], [after.site!.headerBlock!])
        expect(after.site!.headerBlock!._localeContent).toEqual(before.site.headerBlock._localeContent)
    }
    if (before.site?.footerBlock) {
        expect(after.site?.footerBlock, 'footer block must remain present').toBeTruthy()
        expectEquivalentContentPreserved([before.site.footerBlock], [after.site!.footerBlock!])
        expect(after.site!.footerBlock!._localeContent).toEqual(before.site.footerBlock._localeContent)
    }
    for (const [key, block] of Object.entries(before.site?.globalBlocks ?? {})) {
        if (!block) continue
        const afterBlock = after.site?.globalBlocks?.[key]
        expect(afterBlock, `global block ${key} must remain present`).toBeTruthy()
        expectEquivalentContentPreserved([block], [afterBlock!])
    }
    expect(canonicalizeContent(after.page?.localeContent ?? {})).toEqual(
        canonicalizeContent(before.page?.localeContent ?? {}),
    )
}

function expectEditorStateRestored(before: EditorData, restored: EditorData): void {
    expect(canonicalizeContent(restored.page?.layout ?? [])).toEqual(
        canonicalizeContent(before.page?.layout ?? []),
    )
    expect(canonicalizeContent(restored.site?.theme ?? {})).toEqual(
        canonicalizeContent(before.site?.theme ?? {}),
    )
    expect(canonicalizeContent(restored.site?.headerBlock ?? null)).toEqual(
        canonicalizeContent(before.site?.headerBlock ?? null),
    )
    expect(canonicalizeContent(restored.site?.footerBlock ?? null)).toEqual(
        canonicalizeContent(before.site?.footerBlock ?? null),
    )
    expect(canonicalizeContent(restored.site?.globalBlocks ?? null)).toEqual(
        canonicalizeContent(before.site?.globalBlocks ?? null),
    )
    expect(canonicalizeContent(restored.page?.localeContent ?? {})).toEqual(
        canonicalizeContent(before.page?.localeContent ?? {}),
    )
}

function hasPersistedUserMedia(blocks: Block[]): boolean {
    return blocks.some(block => {
        const blockType = block.blockType
        if (!blockType) return false
        if ((USER_PRESERVE_MEDIA_FIELDS[blockType] ?? []).some(field => block[field] != null && block[field] !== '')) {
            return true
        }
        const nested = USER_PRESERVE_NESTED_MEDIA_FIELDS[blockType]
        if (!nested || !Array.isArray(block[nested.field])) return false
        return (block[nested.field] as Record<string, unknown>[]).some(item => item[nested.mediaField] != null)
    })
}

async function getEditorData(page: Page, url: string): Promise<EditorData> {
    const response = await page.request.get(url)
    expect(response.ok(), `GET ${url}`).toBe(true)
    return await response.json() as EditorData
}

async function openTemplateConfirmation(page: Page, templateName: string): Promise<void> {
    await page.getByTitle(/Templates|Templat/i).first().click()
    const card = page.locator('div.group').filter({
        has: page.getByRole('heading', { name: templateName, exact: true }),
    }).first()
    await expect(card).toBeVisible({ timeout: 30_000 })
    await card.hover()
    await card.getByRole('button', { name: /Use(?: this)? template|Guna(?:kan)? templat(?: ini)?/i }).click()
}

test.describe('GH-191 content-preserving template swap', () => {
    test('[TC-F07.039, TC-F07.040] preserves all equivalent content across 10+ swaps', async ({ page }, testInfo) => {
        assertAllowedAuthenticatedE2ETarget(testInfo.project.use.baseURL)
        const siteId = process.env.E2E_F07_SITE_ID
        const configuredTemplates = (
            process.env.E2E_F07_TEMPLATE_NAMES ?? ''
        ).split(',').map(name => name.trim()).filter(Boolean)
        const requestedSwapCount = Number(process.env.E2E_F07_SWAP_COUNT ?? MINIMUM_SWAP_COUNT)
        const swapCount = Number.isSafeInteger(requestedSwapCount)
            ? Math.max(MINIMUM_SWAP_COUNT, requestedSwapCount)
            : MINIMUM_SWAP_COUNT
        test.skip(
            process.env.RUN_GH191_TEMPLATE_SWAP_E2E !== 'true' || !siteId || configuredTemplates.length === 0,
            'Set RUN_GH191_TEMPLATE_SWAP_E2E=true, E2E_F07_SITE_ID, and E2E_F07_TEMPLATE_NAMES for a dedicated draft fixture.',
        )

        const editorDataUrl = `/api/sites/${siteId}/editor-data`
        const before = await getEditorData(page, editorDataUrl)
        const originalLayout = before.page?.layout ?? []
        const originalHeroHeadline = originalLayout.find(block => block.blockType === 'hero')?.headline
        expect(before.site?.headerBlock, 'fixture must contain a canonical header').toBeTruthy()
        expect(before.site?.footerBlock, 'fixture must contain a canonical footer').toBeTruthy()
        expect(typeof originalHeroHeadline === 'string' && originalHeroHeadline.trim().length > 0, 'fixture must contain custom hero text').toBe(true)
        expect(hasPersistedUserMedia(originalLayout), 'fixture must contain at least one persisted user image').toBe(true)

        await page.goto(`/editor/${siteId}`)
        await expect(page.getByTitle(/Templates|Templat/i).first()).toBeVisible({ timeout: 30_000 })

        let sawUnmatchedBlock = false
        for (let index = 0; index < swapCount; index += 1) {
            const templateName = configuredTemplates[index % configuredTemplates.length]
            await test.step(`swap ${index + 1}/${swapCount}: ${templateName}`, async () => {
                await openTemplateConfirmation(page, templateName)
                const applyButton = page.getByRole('button', { name: /Apply template|Guna(?:kan)? templat/i })
                await expect(applyButton).toBeVisible()

                const applyResponsePromise = page.waitForResponse(response =>
                    response.url().includes('/api/ai/apply-template') && response.request().method() === 'POST',
                )
                const refreshResponsePromise = page.waitForResponse(response =>
                    response.url().includes(`/api/sites/${siteId}/editor-data`) && response.request().method() === 'GET',
                )

                const renderedSnapshot = page.frameLocator('iframe[title]').locator('[data-template-swap-revision]')
                const previousRevision = await renderedSnapshot.evaluateAll(elements =>
                    elements[0]?.getAttribute('data-template-swap-revision') ?? '',
                )
                const renderStartedAt = Date.now()
                await applyButton.click()

                const transition = page.locator('[data-template-transition]').first()
                await expect(transition).toHaveAttribute('data-template-apply-pending', 'true')
                await expect(transition).toHaveCSS('opacity', '1', { timeout: 500 })
                const transitionDurationMs = await transition.evaluate(element => {
                    const raw = window.getComputedStyle(element).transitionDuration.split(',')[0]?.trim() ?? '0s'
                    return raw.endsWith('ms') ? Number.parseFloat(raw) : Number.parseFloat(raw) * 1000
                })
                expect(transitionDurationMs).toBeLessThanOrEqual(500)

                // A preserved headline is already visible before Apply. Wait for the
                // complete body/theme/system-block snapshot to render in the iframe.
                await expect(renderedSnapshot).toHaveAttribute('data-template-swap-revision', /.+/, { timeout: 2_000 })
                await expect.poll(() => renderedSnapshot.getAttribute('data-template-swap-revision'), { timeout: 2_000 }).not.toBe(previousRevision)
                await renderedSnapshot.evaluate(() => new Promise<void>(resolve =>
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                ))
                await expect(
                    page.frameLocator('iframe[title]').getByText(originalHeroHeadline as string, { exact: false }).first(),
                ).toBeVisible()
                expect(Date.now() - renderStartedAt).toBeLessThan(2_000)

                const applyResponse = await applyResponsePromise
                expect(applyResponse.ok()).toBe(true)
                const applyBody = await applyResponse.json() as TemplateApplyEnvelope
                expect(applyBody.success).toBe(true)
                await expect(transition).toHaveAttribute('data-template-apply-pending', 'false')

                // The UI renders from the exact transaction result; the background
                // editor-data refresh independently verifies and warms canonical state.
                expect((await refreshResponsePromise).ok()).toBe(true)

                const unmatchedBlockTypes = new Set(applyBody.data?.unmatchedBlocks ?? [])
                const after = await getEditorData(page, editorDataUrl)
                expectEditorContentPreserved(before, after, unmatchedBlockTypes)

                if ((applyBody.data?.unmatchedBlocks?.length ?? 0) > 0) {
                    sawUnmatchedBlock = true
                    await expect(page.getByText(/had no match|tidak sepadan/i).first()).toBeVisible()
                }

                const undoSavePromise = page.waitForResponse(response =>
                    response.url().includes(`/api/sites/${siteId}/save`) && response.request().method() === 'PATCH',
                )
                await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
                expect((await undoSavePromise).ok()).toBe(true)
                const restored = await getEditorData(page, editorDataUrl)
                expectEditorStateRestored(before, restored)
                expectEditorContentPreserved(before, restored)
            })
        }
        expect(sawUnmatchedBlock, 'fixture/templates must exercise AC-2 unmatched-block handling').toBe(true)
    })
})

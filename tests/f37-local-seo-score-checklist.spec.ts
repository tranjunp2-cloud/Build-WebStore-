import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { seoHealthActionHref } from '@/components/dashboard/revamp/seo-health-client'
import {
    localSeoMetadataDetailResponseSchema,
    localSeoScoreResponseSchema,
    type LocalSeoScoreResponse,
} from '@/lib/seo/local-seo-score-contract'
import { assertAllowedAuthenticatedE2ETarget } from '../e2e/helpers/authenticated-target'

const AUTH_STATE_PATH = './e2e/.auth/user.json'
const MAX_AI_PROPOSAL_FIXTURE_ITEMS = 3

interface TenantDocument {
    id: string | number
}

type TenantReference = string | number | TenantDocument | null

interface TenantMembership {
    tenant?: TenantReference
    status?: string
}

interface SiteDocument {
    id: string | number
    tenant?: TenantReference
}

interface CurrentUserResponse {
    email?: string
    tenants?: TenantMembership[]
    sites?: SiteDocument[]
}

interface ScoreFixture {
    siteId: string
    editorIssueIndex: number
    editorHref: string
    expectedFocus: string
}

let authenticatedRequest: APIRequestContext
let fixture: ScoreFixture

function requireEnvironment(name: string): string {
    const value = process.env[name]?.trim()
    if (!value) {
        throw new Error(
            `${name} is required for the F37-04 authenticated browser acceptance fixture`,
        )
    }
    return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function relationshipId(value: TenantReference | undefined): string | null {
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value)
    }
    if (isRecord(value) && (typeof value.id === 'string' || typeof value.id === 'number')) {
        return String(value.id)
    }
    return null
}

async function requireJson<T>(response: APIResponse, label: string): Promise<T> {
    if (!response.ok()) {
        throw new Error(`${label} failed with HTTP ${response.status()}`)
    }
    return (await response.json()) as T
}

function editorFocusFromHref(href: string): string | null {
    const url = new URL(href, 'http://phase3.local')
    if (url.searchParams.get('settingsTab') === null) return null
    return (
        url.searchParams.get('focus') ??
        (url.searchParams.get('section') === 'searchVerification' ? 'searchVerification' : null)
    )
}

function findFocusedEditorIssue(
    score: LocalSeoScoreResponse,
): Pick<ScoreFixture, 'editorIssueIndex' | 'editorHref' | 'expectedFocus'> {
    for (const [index, issue] of score.issues.entries()) {
        const href = seoHealthActionHref(issue.action)
        if (!href?.startsWith('/editor/')) continue
        const expectedFocus = editorFocusFromHref(href)
        if (!expectedFocus) continue
        return {
            editorIssueIndex: index,
            editorHref: href,
            expectedFocus,
        }
    }
    throw new Error(
        'The F37-04 fixture needs one unresolved allowlisted Editor settings issue with a focus target',
    )
}

async function discoverFixture(
    request: APIRequestContext,
    expectedEmail: string,
): Promise<ScoreFixture> {
    const currentUser = await requireJson<CurrentUserResponse>(
        await request.get('/api/users/me?include=site-status'),
        'Loading the authenticated F37-04 user',
    )
    if (currentUser.email?.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()) {
        throw new Error('The saved Playwright auth state does not belong to TEST_EMAIL')
    }

    const activeMemberships = (currentUser.tenants ?? []).filter(
        (membership) => membership.status === 'active',
    )
    if (activeMemberships.length !== 1) {
        throw new Error('The F37-04 test account must have exactly one active tenant membership')
    }
    const tenantId = relationshipId(activeMemberships[0].tenant)
    if (!tenantId) {
        throw new Error('/api/users/me must expose the active tenant relationship for F37-04')
    }

    const sites = (currentUser.sites ?? []).filter(
        (site) => relationshipId(site.tenant) === tenantId,
    )
    if (sites.length !== 1) {
        throw new Error('The F37-04 test account must own exactly one site in its active tenant')
    }
    const siteId = String(sites[0].id)
    const score = localSeoScoreResponseSchema.parse(
        await requireJson<unknown>(
            await request.get(`/api/sites/${encodeURIComponent(siteId)}/local-seo-score`),
            'Loading the F37-04 score fixture',
        ),
    )
    if (score.aiFixableItemCount < 1) {
        throw new Error(
            'The F37-04 fixture needs at least one missing metadata record for the metadata-only flow',
        )
    }

    if (score.aiFixableItemCount > MAX_AI_PROPOSAL_FIXTURE_ITEMS) {
        throw new Error(
            `The F37-04 fixture has ${score.aiFixableItemCount} metadata records; cap it at ${MAX_AI_PROPOSAL_FIXTURE_ITEMS} before running a real AI proposal`,
        )
    }
    return {
        siteId,
        ...findFocusedEditorIssue(score),
    }
}

async function openDashboardScore(page: Page): Promise<LocalSeoScoreResponse> {
    const scoreResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return (
            response.request().method() === 'GET' &&
            url.pathname === `/api/sites/${encodeURIComponent(fixture.siteId)}/local-seo-score` &&
            url.search === ''
        )
    })

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    const scoreResponse = await scoreResponsePromise
    expect(
        scoreResponse.ok(),
        `Dashboard score request failed with HTTP ${scoreResponse.status()}`,
    ).toBe(true)
    const score = localSeoScoreResponseSchema.parse(await scoreResponse.json())
    await expect(page.getByTestId('seo-health-ready')).toBeVisible()
    return score
}

function metadataOnlyItem(item: unknown): boolean {
    if (!isRecord(item) || !Array.isArray(item.missingFields)) return false
    const allowedKeys = new Set(['collection', 'id', 'title', 'context', 'missingFields'])
    return (
        Object.keys(item).every((key) => allowedKeys.has(key)) &&
        item.missingFields.length > 0 &&
        item.missingFields.every((field) => field === 'title' || field === 'description')
    )
}

async function assertLocalBusinessPanelLayout(page: Page): Promise<void> {
    const overflowBefore = await page.evaluate(
        () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    )
    const toggle = page.getByTestId("settings-section-toggle-localBusiness")
    await expect(toggle).toBeVisible()
    if ((await toggle.getAttribute("aria-expanded")) !== "true") {
        await toggle.click()
    }
    await expect(toggle).toHaveAttribute("aria-expanded", "true")

    const fieldset = page.getByTestId("settings-local-business-fieldset")
    await expect(fieldset).toBeVisible()
    expect(
        await fieldset.evaluate((element) => {
            const style = getComputedStyle(element)
            return [
                style.borderTopWidth,
                style.borderRightWidth,
                style.borderBottomWidth,
                style.borderLeftWidth,
            ]
        }),
    ).toEqual(["0px", "0px", "0px", "0px"])

    const section = page.locator("[data-settings-section=localBusiness]")
    await expect(section.getByText("Street Address", { exact: true })).toHaveCount(0)
    await expect(section.getByText("Country", { exact: true })).toHaveCount(0)

    const overflowAfter = await page.evaluate(
        () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    )
    expect(overflowAfter).toBeLessThanOrEqual(Math.max(overflowBefore, 1))

    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
}

test.describe.serial('[US-F37-04] Dashboard SEO Health real-browser acceptance', () => {
    test.beforeAll(async ({ playwright }, testInfo) => {
        const baseURL = requireEnvironment('BASE_URL')
        const expectedEmail = requireEnvironment('TEST_EMAIL')
        requireEnvironment('TEST_PASSWORD')
        requireEnvironment('E2E_TEST_OTP_CODE')
        assertAllowedAuthenticatedE2ETarget(baseURL)

        if (testInfo.project.use.storageState !== AUTH_STATE_PATH) {
            throw new Error(`F37-04 project must use authenticated state ${AUTH_STATE_PATH}`)
        }
        authenticatedRequest = await playwright.request.newContext({
            baseURL,
            storageState: AUTH_STATE_PATH,
        })
        fixture = await discoverFixture(authenticatedRequest, expectedEmail)
    })

    test.afterAll(async () => {
        await authenticatedRequest?.dispose()
    })

    test('[TC-F37-04-26] keeps Local Business layout contained on desktop', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto('/editor/' + encodeURIComponent(fixture.siteId), {
            waitUntil: 'domcontentloaded',
        })
        await expect(page.getByTestId('settings-panel')).toBeVisible()

        await assertLocalBusinessPanelLayout(page)
    })

    test('[TC-F37-04-10, TC-F37-04-12] renders the authoritative score and focuses an allowlisted Editor action', async ({
        page,
    }) => {
        // Arrange
        const score = await openDashboardScore(page)
        const card = page.getByTestId('seo-health-ready')
        const expectedIssue = score.issues[fixture.editorIssueIndex]
        expect(expectedIssue).toBeDefined()
        expect(seoHealthActionHref(expectedIssue.action)).toBe(fixture.editorHref)

        // Act + Assert — the sole score surface mirrors the runtime contract.
        await expect(card.locator('.g-score')).toHaveText(String(score.score))
        await expect(card.locator('[role="progressbar"]')).toHaveCount(4)
        await expect(card.locator('.seo-target-issue-row')).toHaveCount(score.issues.length)

        // Act — use the real rendered issue row, not a constructed URL.
        await card
            .locator('.seo-target-issue-row')
            .nth(fixture.editorIssueIndex)
            .locator('button')
            .click()
        await page.waitForURL(
            (url) => url.pathname === `/editor/${encodeURIComponent(fixture.siteId)}`,
        )

        // Assert — Editor consumed the allowlisted query, expanded the owner
        // section, scrolled it into view, and focused a real field/control.
        const focusTarget = page.locator(`[data-settings-focus="${fixture.expectedFocus}"]`)
        await expect(focusTarget).toBeVisible()
        await expect
            .poll(() =>
                focusTarget.evaluate(
                    (element) =>
                        element === document.activeElement ||
                        element.contains(document.activeElement),
                ),
            )
            .toBe(true)
    })

    test('[TC-F37-04-16] sends only bounded title/description records into the metadata proposal flow', async ({
        page,
    }) => {
        // Arrange
        const score = await openDashboardScore(page)
        expect(score.aiFixableItemCount).toBeGreaterThan(0)
        let applyRequestCount = 0
        page.on('request', (request) => {
            if (
                request.method() === 'POST' &&
                new URL(request.url()).pathname === '/api/seo/apply-fixes'
            ) {
                applyRequestCount += 1
            }
        })
        const detailResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                response.request().method() === 'GET' &&
                url.pathname ===
                    `/api/sites/${encodeURIComponent(fixture.siteId)}/local-seo-score` &&
                url.searchParams.get('detail') === 'metadata'
            )
        })
        const proposalRequestPromise = page.waitForRequest((request) => {
            return (
                request.method() === 'POST' &&
                new URL(request.url()).pathname === '/api/seo/fix-all'
            )
        })

        // Act — this opens the existing modal and starts proposal generation.
        // It never clicks Apply, so the shared staging fixture is read-only.
        await page.locator('.seo-target-ai-action').click()
        const detailResponse = await detailResponsePromise
        const detail = localSeoMetadataDetailResponseSchema.parse(await detailResponse.json())
        const proposalRequest = await proposalRequestPromise
        const proposalBody = proposalRequest.postDataJSON() as unknown

        // Assert
        expect(detail.revisionToken).toBe(score.revisionToken)
        expect(detail.items.length).toBeGreaterThan(0)
        expect(detail.items.length).toBeLessThanOrEqual(100)
        expect(detail.items.length).toBeLessThanOrEqual(score.aiFixableItemCount)
        expect(detail.hasNextPage).toBe(score.aiFixableItemCount > detail.items.length)
        expect(isRecord(proposalBody)).toBe(true)
        if (!isRecord(proposalBody)) return
        expect(Object.keys(proposalBody).sort()).toEqual([
            'missingSeo',
            'revisionToken',
            'siteId',
        ])
        expect(proposalBody.siteId).toBe(fixture.siteId)
        expect(Array.isArray(proposalBody.missingSeo)).toBe(true)
        expect(proposalBody.missingSeo).toEqual(
            detail.items.map(({ collection, id, title, context, missingFields }) => ({
                collection,
                id,
                title,
                ...(context ? { context } : {}),
                missingFields,
            })),
        )
        expect((proposalBody.missingSeo as unknown[]).every(metadataOnlyItem)).toBe(true)
        expect(JSON.stringify(proposalBody)).not.toMatch(
            /localBusiness|contactInfo|openingHours|streetAddress|phone/i,
        )
        expect(applyRequestCount).toBe(0)
    })

    test('[TC-F37-09-16] keeps SEO actions within 375px with 44px touch targets', async ({
        page,
    }) => {
        // Arrange
        await page.setViewportSize({ width: 375, height: 844 })
        await openDashboardScore(page)
        const card = page.getByTestId('seo-health-ready')
        const actionButtons = card.locator('.seo-target-issue-action, .seo-target-ai-action')
        expect(await actionButtons.count()).toBeGreaterThan(0)

        // Act
        await card.scrollIntoViewIfNeeded()

        // Assert
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow).toBeLessThanOrEqual(1)
        const cardBox = await card.boundingBox()
        expect(cardBox).not.toBeNull()
        expect(cardBox!.x).toBeGreaterThanOrEqual(0)
        expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(375)
        await expect(card.locator('.seo-target-issue-grid')).toHaveCSS(
            'grid-template-columns',
            /^\d+(?:\.\d+)?px$/,
        )

        for (let index = 0; index < (await actionButtons.count()); index += 1) {
            const button = actionButtons.nth(index)
            await button.scrollIntoViewIfNeeded()
            const box = await button.boundingBox()
            expect(box, `SEO action ${index + 1} must render`).not.toBeNull()
            expect(box!.height, `SEO action ${index + 1} height`).toBeGreaterThanOrEqual(44)
            expect(box!.x, `SEO action ${index + 1} left edge`).toBeGreaterThanOrEqual(0)
            expect(box!.x + box!.width, `SEO action ${index + 1} right edge`).toBeLessThanOrEqual(
                375,
            )
        }

        // Act — click the real unresolved Editor action while still at 375px.
        await card
            .locator('.seo-target-issue-row')
            .nth(fixture.editorIssueIndex)
            .locator('button')
            .click()
        await page.waitForURL(
            (url) => url.pathname === `/editor/${encodeURIComponent(fixture.siteId)}`,
        )

        // Assert — compact Editor mounts its settings-only sheet and delegates
        // expand/scroll/focus to the existing SettingsPanel implementation.
        const focusTarget = page.locator(`[data-settings-focus="${fixture.expectedFocus}"]`)
        await expect(focusTarget).toBeVisible()
        await expect
            .poll(() =>
                focusTarget.evaluate(
                    (element) =>
                        element === document.activeElement ||
                        element.contains(document.activeElement),
                ),
            )
            .toBe(true)
        await expect(page.getByText('Move Up', { exact: true })).toHaveCount(0)
        await expect(page.getByText('Delete Block', { exact: true })).toHaveCount(0)
        await assertLocalBusinessPanelLayout(page)
    })
})

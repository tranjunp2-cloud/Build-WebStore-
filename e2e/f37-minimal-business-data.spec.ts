import {
    expect,
    test,
    type APIRequestContext,
    type Page,
    type Request,
} from '@playwright/test'
import { isValidBusinessPhone } from '@/lib/seo/local-business-constants'
import { saveSiteSchema } from '@/lib/validations/sites'

type ContactInfoSnapshot = {
    phone?: string | null
}

type LocalBusinessSnapshot = Record<string, unknown> & {
    streetAddress?: string | null
    city?: string | null
    state?: string | null
    postcode?: string | null
    country?: string | null
}

type RawSiteSnapshot = {
    id: string | number
    name: string
    contactInfo?: ContactInfoSnapshot | null
    localBusiness?: LocalBusinessSnapshot | null
    pendingHeaderBlock?: Record<string, unknown> | null
}

type SitesResponse = {
    docs: RawSiteSnapshot[]
    totalDocs: number
}

type RestorableSiteSnapshot = {
    siteName: string
    contactInfo: {
        phone: string | null
    }
    localBusiness: LocalBusinessSnapshot
    headerBlock: Record<string, unknown> | null
}

let siteId: string | undefined
let restorePayload: RestorableSiteSnapshot | undefined
let expectedSiteSnapshot: RestorableSiteSnapshot | undefined
let authenticatedRequest: APIRequestContext | undefined

function restorableSiteSnapshot(site: RawSiteSnapshot): RestorableSiteSnapshot {
    return {
        siteName: site.name,
        contactInfo: {
            phone: site.contactInfo?.phone ?? null,
        },
        localBusiness: {
            ...(site.localBusiness ?? {}),
            streetAddress: site.localBusiness?.streetAddress ?? null,
            city: site.localBusiness?.city ?? null,
            state: site.localBusiness?.state ?? null,
            postcode: site.localBusiness?.postcode ?? null,
            country: site.localBusiness?.country ?? null,
        },
        headerBlock: site.pendingHeaderBlock ?? null,
    }
}

function recordExpectedSiteMutation(body: Record<string, unknown>) {
    if (!expectedSiteSnapshot) {
        throw new Error('F37 expected fixture state was not initialized.')
    }

    const contactInfo = body.contactInfo as { phone?: string | null } | undefined
    expectedSiteSnapshot = {
        ...expectedSiteSnapshot,
        ...(typeof body.siteName === 'string' ? { siteName: body.siteName } : {}),
        ...(contactInfo && Object.prototype.hasOwnProperty.call(contactInfo, 'phone')
            ? { contactInfo: { phone: contactInfo.phone ?? null } }
            : {}),
        ...(body.localBusiness && typeof body.localBusiness === 'object'
            ? { localBusiness: body.localBusiness as LocalBusinessSnapshot }
            : {}),
        ...(Object.prototype.hasOwnProperty.call(body, 'headerBlock')
            ? { headerBlock: body.headerBlock as Record<string, unknown> | null }
            : {}),
    }
}

function saveBody(request: Request): Record<string, unknown> | null {
    if (
        request.method() !== 'PATCH'
        || new URL(request.url()).pathname !== `/api/sites/${siteId}/save`
    ) return null

    try {
        return request.postDataJSON() as Record<string, unknown>
    } catch {
        return null
    }
}

async function expectSave(
    page: Page,
    matches: (body: Record<string, unknown>) => boolean,
    action: () => Promise<void>,
) {
    const responsePromise = page.waitForResponse(response => {
        const body = saveBody(response.request())
        return body !== null && matches(body)
    })

    await action()
    const response = await responsePromise
    expect(response.ok(), await response.text()).toBeTruthy()
    const body = saveBody(response.request())
    if (!body) throw new Error('F37 matching save response had no readable request body.')
    recordExpectedSiteMutation(body)
}

async function openMobileSettings(page: Page) {
    await page.setViewportSize({ width: 375, height: 844 })
    await page.goto(`/editor/${siteId}`)
    await expect(page.getByTestId('editor-tools-trigger')).toBeVisible()
    await page.getByTestId('editor-tools-trigger').click()
    await page.getByTestId('editor-tools-tab-settings').click()
    await expect(page.getByTestId('settings-business-name')).toBeVisible()
}

async function chooseDifferentOption(page: Page, triggerTestId: string): Promise<string> {
    const trigger = page.getByTestId(triggerTestId)
    const current = (await trigger.textContent())?.trim()
    await trigger.click()
    const options = page.getByRole('option')
    await expect(options.first()).toBeVisible()

    const count = await options.count()
    for (let index = 0; index < count; index += 1) {
        const option = options.nth(index)
        const text = (await option.textContent())?.trim() || ''
        if (text && text !== current) {
            await option.click()
            return text
        }
    }

    throw new Error(`No alternative option available for ${triggerTestId}`)
}

test.describe.serial('[US-F37-01] Minimal Business Data browser regression', () => {
    test.beforeAll(async ({ playwright }, testInfo) => {
        const baseURL = testInfo.project.use.baseURL
        const storageState = testInfo.project.use.storageState
        if (typeof baseURL !== 'string' || !storageState) {
            throw new Error('F37 E2E requires configured baseURL and authenticated storageState.')
        }

        authenticatedRequest = await playwright.request.newContext({ baseURL, storageState })
        const sitesResponse = await authenticatedRequest.get('/api/sites?limit=2&depth=0')
        if (!sitesResponse.ok()) {
            throw new Error(`F37 tenant-site lookup failed: ${await sitesResponse.text()}`)
        }
        const sites = await sitesResponse.json() as SitesResponse
        if (sites.totalDocs !== 1 || sites.docs.length !== 1) {
            throw new Error(`F37 E2E requires exactly one tenant-owned site; found ${sites.totalDocs}.`)
        }

        const rawSite = sites.docs[0]
        const openingHours = rawSite.localBusiness?.openingHours
        if (Array.isArray(openingHours) && openingHours.length > 0) {
            throw new Error(
                'F37 E2E requires the reserved site to have empty openingHours; '
                + 'address saves re-submit localBusiness and must not rewrite F37-02 row metadata.',
            )
        }
        siteId = String(rawSite.id)
        if (!Object.prototype.hasOwnProperty.call(rawSite, 'pendingHeaderBlock')) {
            throw new Error('F37 raw fixture response must expose pendingHeaderBlock for lossless teardown.')
        }

        const rawRestorePayload = restorableSiteSnapshot(rawSite)
        const parsedRestore = saveSiteSchema.safeParse(rawRestorePayload)
        if (!parsedRestore.success) {
            const issues = parsedRestore.error.issues
                .map(issue => `${issue.path.join('.')}: ${issue.message}`)
                .join('; ')
            throw new Error(`F37 tenant site is not safely restorable: ${issues}`)
        }
        expect(parsedRestore.data, 'F37 tenant site is not losslessly restorable').toEqual(rawRestorePayload)
        restorePayload = rawRestorePayload
        expectedSiteSnapshot = {
            ...rawRestorePayload,
            contactInfo: { ...rawRestorePayload.contactInfo },
            localBusiness: { ...rawRestorePayload.localBusiness },
        }
    })

    test.afterAll(async () => {
        if (!authenticatedRequest) return

        try {
            if (!siteId || !restorePayload || !expectedSiteSnapshot) return
            const currentRawResponse = await authenticatedRequest.get(`/api/sites/${siteId}?depth=0`)
            if (!currentRawResponse.ok()) {
                throw new Error(`Pre-restore fixture lookup failed: ${await currentRawResponse.text()}`)
            }
            const currentRawSite = await currentRawResponse.json() as RawSiteSnapshot
            expect(
                restorableSiteSnapshot(currentRawSite),
                'F37 fixture changed outside this test run; refusing to overwrite concurrent edits.',
            ).toEqual(expectedSiteSnapshot)

            const response = await authenticatedRequest.patch(`/api/sites/${siteId}/save`, {
                data: restorePayload,
            })
            expect(response.ok(), `Fixture restore failed: ${await response.text()}`).toBeTruthy()

            const restoredRawResponse = await authenticatedRequest.get(`/api/sites/${siteId}?depth=0`)
            if (!restoredRawResponse.ok()) {
                throw new Error(`Raw fixture verification failed: ${await restoredRawResponse.text()}`)
            }
            const restoredRawSite = await restoredRawResponse.json() as RawSiteSnapshot
            expect(restorableSiteSnapshot(restoredRawSite)).toEqual(restorePayload)
        } finally {
            await authenticatedRequest.dispose()
            authenticatedRequest = undefined
        }
    })

    test('[TC-F37-01-26] valid phone persists; invalid blur rolls back without PATCH', async ({ page }) => {
        // Arrange
        await page.route('**/api/analytics/track', route => route.fulfill({ status: 204, body: '' }))
        await openMobileSettings(page)
        const phoneInput = page.getByTestId('settings-contact-phone')
        const currentPhone = await phoneInput.inputValue()
        const validPhone = currentPhone === '+60123456789' ? '+60198765432' : '+60123456789'
        expect(isValidBusinessPhone(validPhone)).toBe(true)

        // Act: a valid value produces a confirmed save.
        await expectSave(
            page,
            body => (body.contactInfo as { phone?: string } | undefined)?.phone === validPhone,
            async () => {
                await phoneInput.fill(validPhone)
                await phoneInput.blur()
            },
        )

        // Assert: reload proves persistence.
        await page.reload()
        await page.getByTestId('editor-tools-trigger').click()
        await page.getByTestId('editor-tools-tab-settings').click()
        await expect(page.getByTestId('settings-contact-phone')).toHaveValue(validPhone)

        const invalidPhone = '12A3'
        expect(isValidBusinessPhone(invalidPhone)).toBe(false)

        await page.getByTestId('settings-contact-phone').fill(invalidPhone)
        const unexpectedSiteSaveDetected = page.waitForRequest(
            request => saveBody(request) !== null,
            { timeout: 1_000 },
        ).then(() => true, () => false)
        await page.getByTestId('settings-contact-phone').blur()
        await expect(page.locator('[data-sonner-toast]')).toBeVisible()
        await expect(page.getByTestId('settings-contact-phone')).toHaveValue(validPhone)

        // The current invalid branch is synchronous and has no debounce. This bounded
        // network-negative assertion also catches a future queued/timer-based regression.
        expect(await unexpectedSiteSaveDetected).toBe(false)

        // Navigation ends the old document lifecycle; reload then proves persisted state.
        await page.reload()
        await page.getByTestId('editor-tools-trigger').click()
        await page.getByTestId('editor-tools-tab-settings').click()
        await expect(page.getByTestId('settings-contact-phone')).toHaveValue(validPhone)
    })

    test('[TC-F37-01-27] name, address and phone persist at 375px', async ({ page }) => {
        // Arrange
        await page.route('**/api/analytics/track', route => route.fulfill({ status: 204, body: '' }))
        await openMobileSettings(page)
        const suffix = Date.now().toString().slice(-6)
        const businessName = `F37 E2E ${suffix}`
        const streetAddress = `${suffix} Jalan Regression`
        const phone = '+60111222333'

        // Act: wait for every field's successful PATCH before editing the next field.
        await expectSave(page, body => body.siteName === businessName, async () => {
            await page.getByTestId('settings-business-name').fill(businessName)
            await page.getByTestId('settings-business-name').blur()
        })
        await expectSave(
            page,
            body => (body.localBusiness as { streetAddress?: string } | undefined)?.streetAddress === streetAddress,
            async () => {
                await page.getByTestId('settings-local-business-street-address').fill(streetAddress)
                await page.getByTestId('settings-local-business-street-address').blur()
            },
        )

        let state = ''
        await expectSave(page, body => {
            state = (body.localBusiness as { state?: string } | undefined)?.state || ''
            return Boolean(state)
        }, async () => {
            await chooseDifferentOption(page, 'settings-local-business-state')
        })

        let city = ''
        await expectSave(page, body => {
            city = (body.localBusiness as { city?: string } | undefined)?.city || ''
            return Boolean(city)
        }, async () => {
            await chooseDifferentOption(page, 'settings-local-business-city')
        })

        let postcode = ''
        await expectSave(page, body => {
            postcode = (body.localBusiness as { postcode?: string } | undefined)?.postcode || ''
            return /^\d{5}$/.test(postcode)
        }, async () => {
            await chooseDifferentOption(page, 'settings-local-business-postcode')
        })

        await expectSave(
            page,
            body => (body.contactInfo as { phone?: string } | undefined)?.phone === phone,
            async () => {
                await page.getByTestId('settings-contact-phone').fill(phone)
                await page.getByTestId('settings-contact-phone').blur()
            },
        )

        // Assert: reload restores every value without horizontal overflow.
        await page.reload()
        await page.getByTestId('editor-tools-trigger').click()
        await page.getByTestId('editor-tools-tab-settings').click()
        await expect(page.getByTestId('settings-business-name')).toHaveValue(businessName)
        await expect(page.getByTestId('settings-local-business-street-address')).toHaveValue(streetAddress)
        await expect(page.getByTestId('settings-local-business-state')).toContainText(state)
        await expect(page.getByTestId('settings-local-business-city')).toContainText(city)
        await expect(page.getByTestId('settings-local-business-postcode')).toContainText(postcode)
        await expect(page.getByTestId('settings-contact-phone')).toHaveValue(phone)

        if (!authenticatedRequest) throw new Error('F37 authenticated request context was not initialized.')
        const persistedResponse = await authenticatedRequest.get(`/api/sites/${siteId}/editor-data`)
        if (!persistedResponse.ok()) {
            throw new Error(`Persisted fixture lookup failed: ${await persistedResponse.text()}`)
        }
        const persistedSite = (await persistedResponse.json()).site as {
            localBusiness?: LocalBusinessSnapshot
        }
        expect(persistedSite.localBusiness?.country).toBe('MY')

        const scoreResponse = await authenticatedRequest.get(`/api/sites/${siteId}/local-seo-score`)
        if (!scoreResponse.ok()) {
            throw new Error(`Business score lookup failed: ${await scoreResponse.text()}`)
        }
        const scoreBody = await scoreResponse.json() as {
            minimalBusinessData?: {
                score: number
                maxScore: number
                breakdown: { name: number; address: number; phone: number }
            }
        }
        expect(scoreBody.minimalBusinessData).toEqual({
            score: 20,
            maxScore: 20,
            breakdown: { name: 7, address: 8, phone: 5 },
        })

        const horizontalOverflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(horizontalOverflow).toBeLessThanOrEqual(1)
        for (const testId of [
            'settings-business-name',
            'settings-contact-phone',
            'settings-local-business-street-address',
        ]) {
            const field = page.getByTestId(testId)
            await field.scrollIntoViewIfNeeded()
            const box = await field.boundingBox()
            expect(box, `${testId} must be rendered`).not.toBeNull()
            expect(box!.x, `${testId} left edge`).toBeGreaterThanOrEqual(0)
            expect(box!.x + box!.width, `${testId} right edge`).toBeLessThanOrEqual(375)
        }
    })
})

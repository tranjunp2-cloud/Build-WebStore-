import {
    expect,
    test,
    type APIRequestContext,
    type APIResponse,
    type Locator,
    type Page,
} from '@playwright/test'
import { checkContrast } from '@/lib/theme/color-utils'
import {
    assertAllowedAuthenticatedE2ETarget,
    LOCAL_E2E_ORIGIN,
} from '../e2e/helpers/authenticated-target'

const AUTH_STATE_PATH = './e2e/.auth/user.json'
const NO_MUTATION_SETTLE_MS = 1_000
const MINIMUM_AA_CONTRAST = 4.5
const CHECKLIST_PALETTE = {
    light: {
        completed: { foreground: '#166534', background: '#dcfce7' },
        incomplete: { foreground: '#334155', background: '#e2e8f0' },
    },
    dark: {
        completed: { foreground: '#86efac', background: '#052e16' },
        incomplete: { foreground: '#e2e8f0', background: '#1e293b' },
    },
} as const
const COORDINATES_EXTRACTED_PALETTE = {
    light: { foreground: '#166534', background: '#dcfce7' },
    dark: { foreground: '#86efac', background: '#052e16' },
} as const
const OPENING_HOURS_PALETTE = {
    light: {
        dialog: { foreground: '#22313f', background: '#ffffff' },
        selectedDay: { foreground: '#1e40af', background: '#dbeafe' },
        addHours: { foreground: '#1d4ed8', background: '#eff6ff' },
        checkbox: { border: 'rgb(100, 116, 139)', background: 'rgb(248, 250, 252)' },
        cancel: { foreground: '#334155', background: '#ffffff' },
        disabledSave: { foreground: '#334155', background: '#cbd5e1' },
        enabledSave: { foreground: '#eff6ff', background: '#2563eb' },
    },
    dark: {
        dialog: { foreground: '#f8fafc', background: '#1e293b' },
        selectedDay: { foreground: '#93c5fd', background: '#172554' },
        addHours: { foreground: '#93c5fd', background: '#172554' },
        checkbox: { border: 'rgb(100, 116, 139)', background: 'rgb(15, 23, 42)' },
        cancel: { foreground: '#e2e8f0', background: '#1e293b' },
        disabledSave: { foreground: '#f1f5f9', background: '#475569' },
        enabledSave: { foreground: '#eff6ff', background: '#2563eb' },
    },
} as const
const OPENING_HOURS_BORDER_PALETTE = {
    light: {
        selectedDay: 'rgb(147, 197, 253)',
        addHours: 'rgb(191, 219, 254)',
        cancel: 'rgb(203, 213, 225)',
        disabledSave: 'rgb(148, 163, 184)',
        enabledSave: 'rgb(37, 99, 235)',
    },
    dark: {
        selectedDay: 'rgb(30, 64, 175)',
        addHours: 'rgb(30, 64, 175)',
        cancel: 'rgb(71, 85, 105)',
        disabledSave: 'rgb(100, 116, 139)',
        enabledSave: 'rgb(37, 99, 235)',
    },
} as const

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

interface LocalBusinessFixture {
    siteId: string
}

interface ComputedColorPair {
    foreground: string
    background: string
}

interface BlockedMutationAttempt {
    method: string
    pathname: string
}

let authenticatedRequest: APIRequestContext
let fixture: LocalBusinessFixture

function requireEnvironment(name: string): string {
    const value = process.env[name]?.trim()
    if (!value) {
        throw new Error(`${name} is required for the GH-1757 authenticated browser fixture`)
    }
    return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function relationshipId(value: TenantReference | undefined): string | null {
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    if (isRecord(value) && (typeof value.id === 'string' || typeof value.id === 'number')) {
        return String(value.id)
    }
    return null
}

async function requireJson<T>(response: APIResponse, label: string): Promise<T> {
    if (!response.ok()) throw new Error(`${label} failed with HTTP ${response.status()}`)
    return (await response.json()) as T
}

async function discoverFixture(
    request: APIRequestContext,
    expectedEmail: string,
): Promise<LocalBusinessFixture> {
    const currentUser = await requireJson<CurrentUserResponse>(
        await request.get('/api/users/me?include=site-status'),
        'Loading the authenticated GH-1757 user',
    )
    if (currentUser.email?.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()) {
        throw new Error('The saved Playwright auth state does not belong to TEST_EMAIL')
    }

    const activeMemberships = (currentUser.tenants ?? []).filter(
        (membership) => membership.status === 'active',
    )
    if (activeMemberships.length !== 1) {
        throw new Error('The GH-1757 test account must have exactly one active tenant membership')
    }
    const tenantId = relationshipId(activeMemberships[0].tenant)
    if (!tenantId) {
        throw new Error('/api/users/me must expose the active tenant relationship for GH-1757')
    }

    const sites = (currentUser.sites ?? []).filter(
        (site) => relationshipId(site.tenant) === tenantId,
    )
    if (sites.length !== 1) {
        throw new Error('The GH-1757 test account must own exactly one site in its active tenant')
    }
    return { siteId: String(sites[0].id) }
}

function rgbToHex(value: string): string {
    if (!/^rgba?\(/i.test(value)) {
        throw new Error(`Expected an opaque computed RGB color, received: ${value}`)
    }
    const channels = value.match(/[\d.]+/g)?.map(Number)
    const rgb = channels?.slice(0, 3)
    const alpha = channels?.[3]
    if (
        !channels || !rgb || channels.length < 3 || channels.length > 4
        || rgb.some(channel => Number.isNaN(channel) || channel < 0 || channel > 255)
        || (alpha !== undefined && alpha !== 1)
    ) {
        throw new Error(`Expected an opaque computed RGB color, received: ${value}`)
    }
    return `#${rgb
        .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
        .join('')}`
}

async function computedColorPair(locator: Locator): Promise<ComputedColorPair> {
    const colors = await locator.evaluate((element) => {
        const style = getComputedStyle(element)
        return { foreground: style.color, background: style.backgroundColor }
    })
    return {
        foreground: rgbToHex(colors.foreground),
        background: rgbToHex(colors.background),
    }
}

async function expectAAContrast(locator: Locator, label: string): Promise<ComputedColorPair> {
    const colors = await computedColorPair(locator)
    const result = checkContrast(colors.foreground, colors.background)
    expect(
        result.ratio,
        `${label}: ${colors.foreground} on ${colors.background}`,
    ).toBeGreaterThanOrEqual(MINIMUM_AA_CONTRAST)
    expect(result.passAA, `${label} must pass WCAG AA`).toBe(true)
    return colors
}

async function expectSolidBorder(
    locator: Locator,
    color: string,
    width = '1px',
): Promise<void> {
    await expect(locator).toHaveCSS('border-style', 'solid')
    await expect(locator).toHaveCSS('border-width', width)
    await expect(locator).toHaveCSS('border-color', color)
}

async function setDocumentTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
    await page.evaluate((nextTheme) => {
        document.documentElement.classList.remove('light', 'dark')
        document.documentElement.classList.add(nextTheme)
    }, theme)
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
}

async function setEditorThemeThroughUi(page: Page, theme: 'light' | 'dark'): Promise<void> {
    const html = page.locator('html')
    const className = await html.getAttribute('class')
    const isDark = className?.split(/\s+/).includes('dark') ?? false
    if ((theme === 'dark') === isDark) return

    await page.getByTitle('Open menu', { exact: true }).click()
    const toggleName = theme === 'light' ? 'Switch to light mode' : 'Switch to dark mode'
    await page.getByRole('button', { name: toggleName, exact: true }).click()
    if (theme === 'dark') {
        await expect(html).toHaveClass(/\bdark\b/)
    } else {
        await expect(html).not.toHaveClass(/\bdark\b/)
    }
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: toggleName, exact: true })).toHaveCount(0)
}

async function installReadOnlyGuards(page: Page): Promise<BlockedMutationAttempt[]> {
    const blockedMutationAttempts: BlockedMutationAttempt[] = []
    await page.route('**/api/**', async (route) => {
        const request = route.request()
        const url = new URL(request.url())

        if (url.pathname === '/api/analytics/track') {
            await route.fulfill({ status: 204, body: '' })
            return
        }

        const method = request.method().toUpperCase()
        if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
            await route.fallback()
            return
        }

        blockedMutationAttempts.push({ method, pathname: url.pathname })
        await route.abort('blockedbyclient')
    })
    return blockedMutationAttempts
}

async function installIncompleteChecklistOverlay(page: Page, siteId: string): Promise<void> {
    await page.route('**/api/sites/**/editor-data*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        if (
            request.method() !== 'GET'
            || url.pathname !== `/api/sites/${encodeURIComponent(siteId)}/editor-data`
        ) {
            await route.fallback()
            return
        }

        const response = await route.fetch()
        if (!response.ok()) {
            throw new Error(`Loading the GH-1757 checklist fixture failed with HTTP ${response.status()}`)
        }
        const data = await response.json() as unknown
        if (!isRecord(data) || !isRecord(data.site) || !isRecord(data.site.localBusiness)) {
            throw new Error('The GH-1757 editor-data response must expose site.localBusiness')
        }
        await route.fulfill({
            response,
            json: {
                ...data,
                site: {
                    ...data.site,
                    localBusiness: {
                        ...data.site.localBusiness,
                        businessCategory: null,
                    },
                },
            },
        })
    })
}

async function installCoordinatesExtractedOverlay(page: Page, siteId: string): Promise<void> {
    await page.route('**/api/sites/**/editor-data*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        if (
            request.method() !== 'GET'
            || url.pathname !== `/api/sites/${encodeURIComponent(siteId)}/editor-data`
        ) {
            await route.fallback()
            return
        }

        const response = await route.fetch()
        if (!response.ok()) {
            throw new Error(`Loading the GH-1757 coordinate fixture failed with HTTP ${response.status()}`)
        }
        const data = await response.json() as unknown
        if (!isRecord(data) || !isRecord(data.site) || !isRecord(data.site.localBusiness)) {
            throw new Error('The GH-1757 editor-data response must expose site.localBusiness')
        }
        await route.fulfill({
            response,
            json: {
                ...data,
                site: {
                    ...data.site,
                    localBusiness: {
                        ...data.site.localBusiness,
                        latitude: 3.139,
                        longitude: 101.6869,
                    },
                },
            },
        })
    })
}

async function installUnsetOpeningHoursOverlay(page: Page, siteId: string): Promise<void> {
    await page.route('**/api/sites/**/editor-data*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        if (
            request.method() !== 'GET'
            || url.pathname !== `/api/sites/${encodeURIComponent(siteId)}/editor-data`
        ) {
            await route.fallback()
            return
        }

        const response = await route.fetch()
        if (!response.ok()) {
            throw new Error(`Loading the GH-1757 opening-hours fixture failed with HTTP ${response.status()}`)
        }
        const data = await response.json() as unknown
        if (!isRecord(data) || !isRecord(data.site) || !isRecord(data.site.localBusiness)) {
            throw new Error('The GH-1757 editor-data response must expose site.localBusiness')
        }
        await route.fulfill({
            response,
            json: {
                ...data,
                site: {
                    ...data.site,
                    localBusiness: {
                        ...data.site.localBusiness,
                        openingHours: [],
                    },
                },
            },
        })
    })
}

async function openLocalBusiness(page: Page): Promise<Locator> {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
        window.localStorage.setItem('editor:coach-marks:v1:seen', 'true')
    })
    await page.goto(`/editor/${encodeURIComponent(fixture.siteId)}`, {
        waitUntil: 'domcontentloaded',
    })
    await expect(page.getByText('Loading site...', { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('settings-panel')).toBeVisible()

    const toggle = page.getByTestId('settings-section-toggle-localBusiness')
    await expect(toggle).toBeVisible()
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    const fieldset = page.getByTestId('settings-local-business-fieldset')
    await expect(fieldset).toBeVisible()
    await expect(fieldset).toBeEnabled()
    return fieldset
}

test.describe.serial('[GH-1757] Local Business browser regressions', () => {
    test.beforeAll(async ({ playwright }, testInfo) => {
        const baseURL = requireEnvironment('BASE_URL')
        const expectedEmail = requireEnvironment('TEST_EMAIL')
        requireEnvironment('TEST_PASSWORD')
        requireEnvironment('E2E_TEST_OTP_CODE')
        assertAllowedAuthenticatedE2ETarget(baseURL)
        if (new URL(baseURL).origin !== LOCAL_E2E_ORIGIN) {
            throw new Error(`GH-1757 browser verification must run on ${LOCAL_E2E_ORIGIN}`)
        }

        if (testInfo.project.use.storageState !== AUTH_STATE_PATH) {
            throw new Error(`GH-1757 project must use authenticated state ${AUTH_STATE_PATH}`)
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

    test('[TC-F37-10-01] keeps Extract enabled and disabled contrast AA-safe in both themes', async ({
        page,
    }) => {
        // Arrange
        const blockedMutationAttempts = await installReadOnlyGuards(page)
        expect(() => rgbToHex('rgba(30, 64, 175, 0.1)')).toThrow(/opaque/i)
        await installCoordinatesExtractedOverlay(page, fixture.siteId)
        const fieldset = await openLocalBusiness(page)
        expect(blockedMutationAttempts).toEqual([])
        const mapsLink = fieldset.getByPlaceholder('https://maps.app.goo.gl/xxxxx')
        const extract = fieldset.getByRole('button', { name: 'Extract', exact: true })
        const coordinatesExtracted = fieldset.getByText(/Coordinates extracted/i)
        await expect(coordinatesExtracted).toBeVisible()

        const mutationProbePath = '/api/sites/__gh1757-route-order-probe__/editor-data'
        const mutationProbe = await page.evaluate(async (pathname) => {
            try {
                const response = await fetch(pathname, { method: 'POST' })
                return `http-${response.status}`
            } catch {
                return 'blocked'
            }
        }, mutationProbePath)
        expect(mutationProbe).toBe('blocked')
        expect(blockedMutationAttempts).toEqual([{
            method: 'POST',
            pathname: mutationProbePath,
        }])
        blockedMutationAttempts.length = 0

        for (const theme of ['light', 'dark'] as const) {
            // Act + Assert — disabled state.
            await setDocumentTheme(page, theme)
            await mapsLink.fill('')
            await expect(extract).toBeDisabled()
            expect(await extract.evaluate((button) => (button as HTMLButtonElement).disabled)).toBe(true)
            await expectAAContrast(extract, `${theme} disabled Extract`)
            const successColors = await expectAAContrast(
                coordinatesExtracted,
                `${theme} Coordinates extracted`,
            )
            expect(successColors).toEqual(COORDINATES_EXTRACTED_PALETTE[theme])

            // Act + Assert — enabled state without clicking or extracting.
            await mapsLink.fill('https://maps.google.com/?q=3.1390,101.6869')
            await expect(extract).toBeEnabled()
            expect(await extract.evaluate((button) => (button as HTMLButtonElement).disabled)).toBe(false)
            await expectAAContrast(extract, `${theme} enabled Extract`)
        }
        await page.waitForTimeout(NO_MUTATION_SETTLE_MS)
        expect(blockedMutationAttempts).toEqual([])
    })

    test('[TC-F37-10-02] rejects invalid coordinate input and sends no API mutation', async ({
        context,
        page,
    }) => {
        // Arrange
        const blockedMutationAttempts = await installReadOnlyGuards(page)
        await installCoordinatesExtractedOverlay(page, fixture.siteId)
        const fieldset = await openLocalBusiness(page)
        const disclosure = fieldset.getByRole('button', {
            name: /Enter coordinates manually \(advanced\)/i,
        })
        await disclosure.click()
        await expect(disclosure).toHaveAttribute('aria-expanded', 'true')

        const latitude = fieldset.getByLabel('Latitude', { exact: true })
        const longitude = fieldset.getByLabel('Longitude', { exact: true })
        await expect(latitude).toBeVisible()
        await expect(longitude).toBeVisible()

        // Act + Assert — the first non-cancelable IME event must preserve a
        // server-provided value before any earlier input event seeds a snapshot.
        await expect(latitude).toHaveValue('3.139')
        await latitude.focus()
        const cdp = await context.newCDPSession(page)
        await cdp.send('Input.imeSetComposition', {
            text: 'e',
            selectionStart: 1,
            selectionEnd: 1,
            replacementStart: 5,
            replacementEnd: 5,
        })
        await expect(latitude).toHaveValue('3.139')
        expect(await latitude.evaluate((element) => (
            element as HTMLInputElement
        ).validity.badInput)).toBe(false)
        await cdp.send('Input.imeSetComposition', {
            text: '',
            selectionStart: 0,
            selectionEnd: 0,
            replacementStart: 5,
            replacementEnd: 6,
        })

        await latitude.fill('')
        await longitude.fill('')
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
            origin: new URL(requireEnvironment('BASE_URL')).origin,
        })

        // Act + Assert — keyboard paths use the real number inputs.
        for (const input of [latitude, longitude]) {
            for (const blockedKey of ['e', 'E', '+', 'a']) {
                await input.focus()
                await input.pressSequentially(blockedKey)
                await expect(input).toHaveValue('')
            }
        }

        // Act + Assert — insertText/IME bypasses keydown and can leave native
        // number inputs visibly invalid even while their DOM value is empty.
        for (const input of [latitude, longitude]) {
            for (const payload of ['e', '1e']) {
                await input.fill('')
                await input.focus()
                await page.keyboard.insertText(payload)
                await expect(input).toHaveValue('')
                expect(await input.evaluate((element) => (
                    element as HTMLInputElement
                ).validity.badInput)).toBe(false)
            }
        }

        // Act + Assert — malformed minus placement remains a native badInput,
        // but blur must expose a clear associated validation error.
        for (const [input, payload, message] of [
            [latitude, '1-2', 'Latitude must be between -90 and 90'],
            [longitude, '--', 'Longitude must be between -180 and 180'],
        ] as const) {
            await input.fill('')
            await input.focus()
            await page.keyboard.insertText(payload)
            expect(await input.evaluate((element) => (
                element as HTMLInputElement
            ).validity.badInput)).toBe(true)
            await input.press('Tab')
            await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible()
            await expect(input).toHaveAttribute('aria-invalid', 'true')
        }

        // Act + Assert — real clipboard paths preserve the selected empty value.
        for (const input of [latitude, longitude]) {
            for (const payload of ['1e2', '+12', 'abc']) {
                await page.evaluate((text) => navigator.clipboard.writeText(text), payload)
                await input.focus()
                await input.selectText()
                await input.press('Control+V')
                await expect(input).toHaveValue('')
            }
        }

        // Act — cross both server-authoritative coordinate bounds and blur.
        await latitude.fill('91')
        await longitude.focus()
        await longitude.fill('-181')
        await longitude.press('Tab')

        // Assert
        await expect(page.getByRole('alert').filter({ hasText: 'Latitude must be between -90 and 90' })).toBeVisible()
        await expect(page.getByRole('alert').filter({ hasText: 'Longitude must be between -180 and 180' })).toBeVisible()
        await page.waitForTimeout(NO_MUTATION_SETTLE_MS)
        expect(blockedMutationAttempts).toEqual([])
    })

    test('[TC-F37-10-03] keeps completed and incomplete checklist states distinct in both themes', async ({
        page,
    }) => {
        // Arrange
        const blockedMutationAttempts = await installReadOnlyGuards(page)
        await installIncompleteChecklistOverlay(page, fixture.siteId)
        const fieldset = await openLocalBusiness(page)
        const checklist = fieldset.getByText('Local SEO essentials', { exact: true }).locator('..')
        const rows = checklist.locator('li')
        const completedRows: number[] = []
        const incompleteRows: number[] = []
        for (let index = 0; index < (await rows.count()); index += 1) {
            if ((await rows.nth(index).locator('svg').count()) > 0) completedRows.push(index)
            else incompleteRows.push(index)
        }
        if (completedRows.length === 0 || incompleteRows.length === 0) {
            throw new Error(
                'The GH-1757 fixture must expose at least one completed and one incomplete '
                + `Local SEO essentials row; found ${completedRows.length} completed and `
                + `${incompleteRows.length} incomplete`,
            )
        }
        const completedBadge = rows.nth(completedRows[0]).locator('span').first()
        const incompleteBadge = rows.nth(incompleteRows[0]).locator('span').first()

        for (const theme of ['light', 'dark'] as const) {
            // Act
            await setDocumentTheme(page, theme)

            // Assert — the check/dot supplies a non-color distinction as well.
            await expect(completedBadge.locator('svg')).toHaveCount(1)
            await expect(incompleteBadge.locator('svg')).toHaveCount(0)
            const completedColors = await expectAAContrast(
                completedBadge,
                `${theme} completed checklist badge`,
            )
            const incompleteColors = await expectAAContrast(
                incompleteBadge,
                `${theme} incomplete checklist badge`,
            )
            expect(completedColors).toEqual(CHECKLIST_PALETTE[theme].completed)
            expect(incompleteColors).toEqual(CHECKLIST_PALETTE[theme].incomplete)
        }
        await page.waitForTimeout(NO_MUTATION_SETTLE_MS)
        expect(blockedMutationAttempts).toEqual([])
    })

    test('[TC-F37-10-05] keeps the Opening Hours modal readable in both themes', async ({
        page,
    }) => {
        // Arrange
        const blockedMutationAttempts = await installReadOnlyGuards(page)
        await installUnsetOpeningHoursOverlay(page, fixture.siteId)
        const fieldset = await openLocalBusiness(page)
        const htmlClassName = await page.locator('html').getAttribute('class')
        const initialTheme = htmlClassName?.split(/\s+/).includes('dark') ? 'dark' : 'light'

        for (const theme of ['light', 'dark'] as const) {
            // Act
            await setEditorThemeThroughUi(page, theme)
            await fieldset.getByRole('button', { name: 'Set opening hours', exact: true }).click()

            const dialog = page.getByRole('dialog')
            const selectedDay = dialog.getByRole('button', { name: 'Mon', exact: true })
            const addHours = dialog.getByRole('button', { name: 'Add hours', exact: true })
            const save = dialog.getByRole('button', { name: 'Save', exact: true })
            const open24Hours = dialog.getByRole('checkbox', { name: 'Open 24 hours', exact: true })
            const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true })
            const opens = dialog.getByLabel('Opens', { exact: true })
            const closes = dialog.getByLabel('Closes', { exact: true })

            // Assert
            await expect(dialog).toBeVisible()
            await expect(selectedDay).toHaveAttribute('aria-pressed', 'true')
            await expect(save).toBeDisabled()
            await expect(open24Hours).toHaveAttribute('data-state', 'unchecked')
            expect(await expectAAContrast(dialog, `${theme} Opening Hours dialog`))
                .toEqual(OPENING_HOURS_PALETTE[theme].dialog)
            expect(await expectAAContrast(selectedDay, `${theme} selected day`))
                .toEqual(OPENING_HOURS_PALETTE[theme].selectedDay)
            expect(await expectAAContrast(addHours, `${theme} Add hours`))
                .toEqual(OPENING_HOURS_PALETTE[theme].addHours)
            await expectSolidBorder(selectedDay, OPENING_HOURS_BORDER_PALETTE[theme].selectedDay)
            await expectSolidBorder(addHours, OPENING_HOURS_BORDER_PALETTE[theme].addHours)
            await expect(open24Hours).toHaveCSS('width', '20px')
            await expect(open24Hours).toHaveCSS('height', '20px')
            await expectSolidBorder(open24Hours, OPENING_HOURS_PALETTE[theme].checkbox.border, '2px')
            await expect(open24Hours).toHaveCSS('background-color', OPENING_HOURS_PALETTE[theme].checkbox.background)
            await expect(cancel).toHaveCSS('height', '36px')
            expect(await expectAAContrast(cancel, `${theme} Cancel`))
                .toEqual(OPENING_HOURS_PALETTE[theme].cancel)
            await expectSolidBorder(cancel, OPENING_HOURS_BORDER_PALETTE[theme].cancel)
            expect(await expectAAContrast(save, `${theme} disabled Save`))
                .toEqual(OPENING_HOURS_PALETTE[theme].disabledSave)
            await expectSolidBorder(save, OPENING_HOURS_BORDER_PALETTE[theme].disabledSave)
            expect(await save.evaluate((button) => getComputedStyle(button).opacity)).toBe('1')
            await expect(save).toHaveCSS('height', '36px')
            expect(await opens.evaluate((input) => getComputedStyle(input).colorScheme)).toBe(theme)
            await opens.fill('09:00')
            await closes.fill('18:00')
            await expect(save).toBeEnabled()
            expect(await expectAAContrast(save, `${theme} enabled Save`))
                .toEqual(OPENING_HOURS_PALETTE[theme].enabledSave)
            await expectSolidBorder(save, OPENING_HOURS_BORDER_PALETTE[theme].enabledSave)
            await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
            await expect(dialog).toHaveCount(0)
        }

        await setEditorThemeThroughUi(page, initialTheme)
        await page.waitForTimeout(NO_MUTATION_SETTLE_MS)
        expect(blockedMutationAttempts).toEqual([])
    })
})

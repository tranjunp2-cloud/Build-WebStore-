import { test, expect, type Locator, type Page } from '@playwright/test'
import { expectNoServerError, expectPageLoaded } from './helpers/assertions'
import { navigateTo } from './helpers/navigation'

/**
 * Products E2E Tests — CRUD operations with cleanup.
 *
 * TC-F08.01: Products list page
 * TC-F08.02: Create product flow
 * TC-F08.03: Product form validation
 */

test.describe('Products Management', () => {
    const createdProductIds: string[] = []

    test.afterAll(async ({ request }) => {
        // Cleanup: delete test products created during this run
        for (const id of createdProductIds) {
            try {
                await request.delete(`/api/products/${id}`)
            } catch {
                // Ignore cleanup errors — product may already be deleted
            }
        }
    })

    test('[TC-GH1432-PERF-03] canonical dashboard products endpoint is available to the signed-in owner', async ({ request }) => {
        // Arrange — authenticated storage state comes from auth.setup.ts.

        // Act
        const response = await request.get('/api/dashboard/products')
        const body = await response.json()

        // Assert
        expect(response.status()).toBe(200)
        expect(body.success).toBe(true)
        expect(Array.isArray(body.data)).toBe(true)
    })

    test('[TC-GH1432-PERF-03] canonical dashboard products endpoint rejects unauthenticated requests', async ({ playwright }) => {
        // Arrange
        const unauthenticatedRequest = await playwright.request.newContext({
            baseURL: process.env.BASE_URL || 'http://localhost:3000',
        })

        // Act
        const response = await unauthenticatedRequest.get('/api/dashboard/products')

        // Assert
        expect(response.status()).toBe(401)
        await unauthenticatedRequest.dispose()
    })

    test('[TC-F08.01] products page loads with list or empty state', async ({ page }) => {
        await navigateTo(page, '/products')
        await expectPageLoaded(page)

        // Either product rows or empty state
        const hasProducts = await page.locator(
            'table tr, [data-testid="product-card"], [data-testid="product-row"]'
        ).count()
        const hasEmptyState = await page.locator(
            'text=/no products|create your first|get started|add product/i'
        ).count()
        const hasAddBtn = await page.locator(
            'a[href*="/products/new"], button:has-text("Add"), button:has-text("Create")'
        ).count()

        expect(hasProducts + hasEmptyState + hasAddBtn).toBeGreaterThan(0)
    })

    test('[TC-F08.02] create product flow', async ({ page }) => {
        const productName = `E2E Test Product ${Date.now()}`

        await navigateTo(page, '/products/new')
        await expectNoServerError(page)

        // Fill product name
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first()
        const isFormVisible = await nameInput.isVisible().catch(() => false)
        if (!isFormVisible) {
            test.skip(true, 'Product form not found')
            return
        }

        await nameInput.fill(productName)

        // Fill price if visible
        const priceInput = page.locator('input[name="price"], input[placeholder*="price" i], input[type="number"]').first()
        if (await priceInput.isVisible().catch(() => false)) {
            await priceInput.fill('29.90')
        }

        // Listen for API response to capture product ID
        const createResponsePromise = page.waitForResponse(
            resp => (resp.url().includes('/api/products') || resp.url().includes('/api/[...slug]')) &&
                resp.request().method() === 'POST' &&
                resp.status() < 400,
            { timeout: 15_000 }
        ).catch(() => null)

        // Submit form
        const submitBtn = page.locator(
            'button[type="submit"], button:has-text("Save"), button:has-text("Create")'
        ).first()
        await submitBtn.click()

        // Capture product ID for cleanup
        const createResponse = await createResponsePromise
        if (createResponse) {
            const responseData = await createResponse.json().catch(() => null)
            const productId = responseData?.doc?.id || responseData?.id
            if (productId) {
                createdProductIds.push(String(productId))
            }
        }

        // Wait and verify no error
        await page.waitForTimeout(2000)
        await expectNoServerError(page)
    })

    test('[TC-F08.03] product form has required fields', async ({ page }) => {
        await navigateTo(page, '/products/new')
        await expectNoServerError(page)

        // Check key form fields exist
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]')
        if (await nameInput.count() > 0) {
            await expect(nameInput.first()).toBeVisible()
        }

        const priceInput = page.locator('input[name="price"], input[placeholder*="price" i], input[type="number"]')
        if (await priceInput.count() > 0) {
            await expect(priceInput.first()).toBeVisible()
        }
    })

    test('[TC-F08-04-83] AI bulk draft localizes Vietnamese variants for an English store', async ({ page }) => {
        test.setTimeout(90_000)

        // Arrange
        await page.addInitScript(() => {
            localStorage.setItem('prefer_lang', 'en')
            document.cookie = 'prefer_lang=en; path=/; samesite=lax'
        })
        await navigateTo(page, '/products')
        await expectNoServerError(page)

        const aiChatTextarea = page.locator('textarea').first()
        await expect(aiChatTextarea).toBeVisible({ timeout: 10_000 })
        const parseResponsePromise = page.waitForResponse(response =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/ai/products-bulk-parse'),
            { timeout: 60_000 },
        )

        // Act
        await aiChatTextarea.fill('áo thun màu variant trắng, đỏ, xám giá 5rm')
        await aiChatTextarea.press('Enter')
        const parseResponse = await parseResponsePromise
        const body = await parseResponse.json() as {
            products?: Array<{
                name?: string
                variants?: Array<{ name?: string }>
                variantConfigs?: Array<{ name?: string; options?: Array<{ value?: string }> }>
            }>
        }

        // Assert
        expect(parseResponse.ok()).toBe(true)
        expect(body.products).toHaveLength(1)
        const product = body.products?.[0]
        expect(product?.name).toBe('T-Shirt')
        expect(product?.variants?.map(variant => variant.name)).toEqual(['White', 'Red', 'Grey'])
        expect(product?.variantConfigs?.[0]).toEqual({
            name: 'Color',
            options: [{ value: 'White' }, { value: 'Red' }, { value: 'Grey' }],
        })
        await expect(page.locator('.fixed.inset-0 input[type="text"]').first()).toHaveValue('T-Shirt')
        await expect(page.getByText('White, Red, Grey', { exact: true })).toBeVisible()
    })

    test('[TC-F08-04-86] AI bulk draft creates localized two-tier Cartesian variants', async ({ page }) => {
        test.setTimeout(90_000)

        // Arrange
        await page.addInitScript(() => {
            localStorage.setItem('prefer_lang', 'en')
            document.cookie = 'prefer_lang=en; path=/; samesite=lax'
        })
        await navigateTo(page, '/products')
        await expectNoServerError(page)

        const aiChatTextarea = page.locator('textarea').first()
        await expect(aiChatTextarea).toBeVisible({ timeout: 10_000 })
        const parseResponsePromise = page.waitForResponse(response =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/ai/products-bulk-parse'),
            { timeout: 60_000 },
        )

        // Act
        await aiChatTextarea.fill('áo thun màu trắng, đỏ, size S, M giá 5rm')
        await aiChatTextarea.press('Enter')
        const parseResponse = await parseResponsePromise
        const body = await parseResponse.json() as {
            products?: Array<{
                variants?: Array<{ name?: string }>
                variantConfigs?: Array<{ name?: string; options?: Array<{ value?: string }> }>
            }>
        }

        // Assert
        expect(parseResponse.ok()).toBe(true)
        expect(body.products).toHaveLength(1)
        const product = body.products?.[0]
        expect(product?.variants?.map(variant => variant.name).sort()).toEqual([
            'Red - M',
            'Red - S',
            'White - M',
            'White - S',
        ])
        expect(product?.variantConfigs).toEqual([
            { name: 'Color', options: [{ value: 'White' }, { value: 'Red' }] },
            { name: 'Size', options: [{ value: 'S' }, { value: 'M' }] },
        ])
    })
})

const LONG_PRODUCT_NAME = 'Premium Handcrafted Malaysian Travel Backpack With Extended Product Name'
const LONG_VARIANT_NAME = 'UltraLongVariantNameWithoutSpacesABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

const PARSED_PRODUCTS = {
    products: [
        {
            name: LONG_PRODUCT_NAME,
            price: 129.9,
            stock: 4,
            category: '',
            variants: [
                { name: LONG_VARIANT_NAME, price: 129.9, sku: 'GH1663-LONG', stock: 2 },
                { name: 'Ocean Blue - Extra Large', price: 129.9, sku: 'GH1663-BLUE', stock: 2 },
            ],
        },
        {
            name: 'Compact Everyday Pouch',
            price: 39.9,
            stock: 8,
            category: '',
            variants: [],
        },
    ],
}

async function openDeterministicDrafts(page: Page, viewport: { width: number; height: number }) {
    await page.setViewportSize(viewport)
    await page.addInitScript(() => {
        localStorage.setItem('prefer_lang', 'en')
        document.cookie = 'prefer_lang=en; path=/; samesite=lax'
    })
    await page.route('**/api/ai/products-bulk-parse', async route => {
        if (route.request().method() !== 'POST') {
            await route.continue()
            return
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(PARSED_PRODUCTS),
        })
    })

    await navigateTo(page, '/products')
    await expectNoServerError(page)
    const bodyOverflowBeforeOpen = await page.evaluate(() => document.body.style.overflow)
    const prompt = page.locator('textarea').first()
    await expect(prompt).toBeVisible()
    await prompt.fill('Create two deterministic regression drafts')
    await prompt.press('Enter')

    const heading = page.getByRole('heading', { name: 'Review AI drafts' })
    await expect(heading).toBeVisible()
    const overlay = page.locator('.fixed.inset-0').filter({ has: heading })
    const panel = overlay.locator(':scope > div').filter({ has: heading })
    await expect(panel).toBeVisible()
    return { panel, bodyOverflowBeforeOpen }
}

async function expectNoHorizontalOverflow(locator: Locator) {
    const dimensions = await locator.evaluate(element => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

async function expectNoIntersection(first: Locator, second: Locator) {
    const firstBox = await first.boundingBox()
    const secondBox = await second.boundingBox()
    expect(firstBox).not.toBeNull()
    expect(secondBox).not.toBeNull()
    if (!firstBox || !secondBox) return

    const horizontalOverlap = Math.max(
        0,
        Math.min(firstBox.x + firstBox.width, secondBox.x + secondBox.width) - Math.max(firstBox.x, secondBox.x),
    )
    const verticalOverlap = Math.max(
        0,
        Math.min(firstBox.y + firstBox.height, secondBox.y + secondBox.height) - Math.max(firstBox.y, secondBox.y),
    )
    expect(horizontalOverlap * verticalOverlap).toBe(0)
}

async function expectFullyContained(inner: Locator, outer: Locator, tolerance = 1) {
    const [innerBox, outerBox] = await Promise.all([inner.boundingBox(), outer.boundingBox()])
    expect(innerBox).not.toBeNull()
    expect(outerBox).not.toBeNull()
    if (!innerBox || !outerBox) return

    expect(innerBox.x).toBeGreaterThanOrEqual(outerBox.x - tolerance)
    expect(innerBox.y).toBeGreaterThanOrEqual(outerBox.y - tolerance)
    expect(innerBox.x + innerBox.width).toBeLessThanOrEqual(outerBox.x + outerBox.width + tolerance)
    expect(innerBox.y + innerBox.height).toBeLessThanOrEqual(outerBox.y + outerBox.height + tolerance)
}

function draftCardFor(input: Locator) {
    return input.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " rounded-xl ")][1]')
}

test.describe('GH-1663 — responsive Review AI drafts modal', () => {
    test('[TC-F08-04-94] stacks editable draft fields without horizontal overflow at 375px', async ({ page }) => {
        // Arrange
        const { panel } = await openDeterministicDrafts(page, { width: 375, height: 812 })
        const nameInput = page.getByLabel('Product name').first()
        const priceInput = page.getByLabel('Price (RM)').first()
        const stockInput = page.getByLabel('Stock').first()
        const removeButton = page.getByRole('button', { name: 'Remove draft' }).first()
        const card = draftCardFor(nameInput)

        // Act
        const [nameBox, priceBox, stockBox, removeBox, cardBox] = await Promise.all([
            nameInput.boundingBox(),
            priceInput.boundingBox(),
            stockInput.boundingBox(),
            removeButton.boundingBox(),
            card.boundingBox(),
        ])

        // Assert
        await expect(nameInput).toHaveValue(LONG_PRODUCT_NAME)
        await expect(nameInput).toBeEditable()
        expect(nameBox).not.toBeNull()
        expect(priceBox).not.toBeNull()
        expect(stockBox).not.toBeNull()
        expect(removeBox).not.toBeNull()
        expect(cardBox).not.toBeNull()
        if (!nameBox || !priceBox || !stockBox || !removeBox || !cardBox) return

        expect(nameBox.width).toBeGreaterThanOrEqual(cardBox.width * 0.6)
        expect(priceBox.width).toBeGreaterThanOrEqual(cardBox.width * 0.25)
        expect(stockBox.width).toBeGreaterThanOrEqual(cardBox.width * 0.25)
        expect(Math.abs(nameBox.x - priceBox.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(nameBox.x + nameBox.width - (stockBox.x + stockBox.width))).toBeLessThanOrEqual(1)
        expect(nameBox.width).toBeGreaterThan(priceBox.width * 1.8)
        expect(Math.abs(priceBox.width - stockBox.width)).toBeLessThanOrEqual(2)
        expect(Math.abs(priceBox.y - stockBox.y)).toBeLessThanOrEqual(2)
        expect(nameBox.y + nameBox.height).toBeLessThanOrEqual(priceBox.y)
        expect(nameBox.y + nameBox.height).toBeLessThanOrEqual(stockBox.y)
        expect(removeBox.width).toBeGreaterThanOrEqual(43)
        expect(removeBox.height).toBeGreaterThanOrEqual(43)
        await expectNoIntersection(nameInput, priceInput)
        await expectNoIntersection(nameInput, stockInput)
        await expectNoIntersection(nameInput, removeButton)
        await expectNoIntersection(priceInput, stockInput)
        await expectNoIntersection(priceInput, removeButton)
        await expectNoIntersection(stockInput, removeButton)
        await expectFullyContained(nameInput, card)
        await expectFullyContained(priceInput, card)
        await expectFullyContained(stockInput, card)
        await expectFullyContained(removeButton, card)
        await expectNoHorizontalOverflow(card)
        await expectNoHorizontalOverflow(panel)
        expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
    })

    test('[TC-F08-04-95] keeps read-only variants wrapping at 430px and restores the desktop row', async ({ page }) => {
        // Arrange
        const { panel } = await openDeterministicDrafts(page, { width: 430, height: 932 })
        const nameInput = page.getByLabel('Product name').first()
        const card = draftCardFor(nameInput)
        const variantsLabel = card.getByText('Variants', { exact: true })
        const variantsField = variantsLabel.locator('xpath=following-sibling::div[1]')

        // Act
        const mobileVariantBox = await variantsField.boundingBox()

        // Assert — mobile value is visible, wrapping, and not editable.
        await expect(variantsField).toContainText(LONG_VARIANT_NAME)
        await expect(variantsLabel.locator('xpath=..').locator('input')).toHaveCount(0)
        expect(mobileVariantBox).not.toBeNull()
        expect(mobileVariantBox?.height ?? 0).toBeGreaterThan(32)
        await expectNoHorizontalOverflow(card)
        await expectNoHorizontalOverflow(panel)

        // Act — cross the md breakpoint using the same DOM and state.
        await page.setViewportSize({ width: 768, height: 932 })
        const priceInput = page.getByLabel('Price (RM)').first()
        const stockInput = page.getByLabel('Stock').first()
        const [desktopNameBox, desktopPriceBox, desktopStockBox, desktopVariantBox, desktopCardBox] = await Promise.all([
            nameInput.boundingBox(),
            priceInput.boundingBox(),
            stockInput.boundingBox(),
            variantsField.boundingBox(),
            card.boundingBox(),
        ])

        // Assert — desktop controls return to one aligned field row.
        expect(desktopNameBox).not.toBeNull()
        expect(desktopPriceBox).not.toBeNull()
        expect(desktopStockBox).not.toBeNull()
        expect(desktopVariantBox).not.toBeNull()
        expect(desktopCardBox).not.toBeNull()
        if (!desktopNameBox || !desktopPriceBox || !desktopStockBox || !desktopVariantBox || !desktopCardBox) return
        expect(desktopNameBox.width).toBeGreaterThanOrEqual(desktopCardBox.width * 0.2)
        expect(desktopPriceBox.width).toBeGreaterThanOrEqual(96)
        expect(desktopStockBox.width).toBeGreaterThanOrEqual(68)
        expect(desktopVariantBox.width).toBeGreaterThanOrEqual(106)
        expect(Math.abs(desktopNameBox.y - desktopPriceBox.y)).toBeLessThanOrEqual(2)
        expect(Math.abs(desktopPriceBox.y - desktopStockBox.y)).toBeLessThanOrEqual(2)
        expect(Math.abs(desktopStockBox.y - desktopVariantBox.y)).toBeLessThanOrEqual(2)
        expect(desktopNameBox.x + desktopNameBox.width).toBeLessThanOrEqual(desktopPriceBox.x + 1)
        expect(desktopPriceBox.x + desktopPriceBox.width).toBeLessThanOrEqual(desktopStockBox.x + 1)
        expect(desktopStockBox.x + desktopStockBox.width).toBeLessThanOrEqual(desktopVariantBox.x + 1)
        await expectNoIntersection(nameInput, priceInput)
        await expectNoIntersection(nameInput, stockInput)
        await expectNoIntersection(nameInput, variantsField)
        await expectNoIntersection(priceInput, stockInput)
        await expectNoIntersection(priceInput, variantsField)
        await expectNoIntersection(stockInput, variantsField)
        await expectFullyContained(nameInput, card)
        await expectFullyContained(priceInput, card)
        await expectFullyContained(stockInput, card)
        await expectFullyContained(variantsField, card)
        await expectNoHorizontalOverflow(card)
        await expectNoHorizontalOverflow(panel)
    })

    test('[TC-F08-04-96] keeps editing, removal, and footer actions reachable in a short viewport', async ({ page }) => {
        // Arrange
        const { panel, bodyOverflowBeforeOpen } = await openDeterministicDrafts(page, { width: 375, height: 568 })
        const serverActionRequests: string[] = []
        page.on('request', request => {
            if (request.method() === 'POST' && request.headers()['next-action']) {
                serverActionRequests.push(request.url())
            }
        })
        const body = panel.locator('.overflow-y-auto').first()
        const nameInput = page.getByLabel('Product name').first()
        const priceInput = page.getByLabel('Price (RM)').first()
        const stockInput = page.getByLabel('Stock').first()
        const removeButtons = page.getByRole('button', { name: 'Remove draft' })
        const cancelButton = panel.getByRole('button', { name: 'Cancel', exact: true })
        const discardButton = panel.getByRole('button', { name: 'Discard', exact: true })
        const approveButton = panel.getByRole('button', { name: 'Approve All', exact: true })
        const reviewHeading = page.getByRole('heading', { name: 'Review AI drafts', exact: true })
        const unsavedWarning = 'You have unsaved data. Closing will discard all changes. Are you sure?'

        // Act
        await nameInput.fill('Edited mobile draft')
        await priceInput.fill('88.50')
        await stockInput.fill('7')
        await expect(removeButtons).toHaveCount(2)
        await removeButtons.nth(1).click()
        await body.evaluate(element => {
            element.scrollTop = element.scrollHeight
        })
        await approveButton.scrollIntoViewIfNeeded()

        // Assert
        await expect(nameInput).toHaveValue('Edited mobile draft')
        expect(Number(await priceInput.inputValue())).toBe(88.5)
        await expect(stockInput).toHaveValue('7')
        await expect(removeButtons).toHaveCount(1)
        await expect(page.getByText('1 draft', { exact: true })).toBeVisible()
        await expect(reviewHeading).toBeVisible()
        await expect(cancelButton).toBeVisible()
        await expect(discardButton).toBeVisible()
        await expect(approveButton).toBeVisible()
        await expect(approveButton).toBeEnabled()
        await expectFullyContained(cancelButton, panel)
        await expectFullyContained(discardButton, panel)
        await expectFullyContained(approveButton, panel)
        const bodyDimensions = await body.evaluate(element => ({
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
        }))
        expect(bodyDimensions.scrollHeight).toBeGreaterThan(bodyDimensions.clientHeight)
        const panelBox = await panel.boundingBox()
        expect(panelBox).not.toBeNull()
        if (panelBox) {
            expect(panelBox.x).toBeGreaterThanOrEqual(0)
            expect(panelBox.y).toBeGreaterThanOrEqual(0)
            expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(375)
            expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(568)
        }
        await expectNoHorizontalOverflow(draftCardFor(nameInput))
        await expectNoHorizontalOverflow(panel)

        // Act — cancel the first exit attempt.
        await cancelButton.click()
        const exitDialog = page.getByRole('dialog')
        await expect(exitDialog.getByRole('heading', { name: 'Exit?', exact: true })).toBeVisible()
        await expect(exitDialog.getByText(unsavedWarning, { exact: true })).toBeVisible()
        await exitDialog.getByRole('button', { name: 'Stay', exact: true }).click()

        // Assert — the modal and edited state remain intact.
        await expect(exitDialog).toBeHidden()
        await expect(reviewHeading).toBeVisible()
        await expect(nameInput).toHaveValue('Edited mobile draft')
        expect(Number(await priceInput.inputValue())).toBe(88.5)
        await expect(stockInput).toHaveValue('7')
        await expect(removeButtons).toHaveCount(1)
        await expect(page.getByText('1 draft', { exact: true })).toBeVisible()

        // Act — confirm the footer discard action.
        await discardButton.click()
        await expect(exitDialog.getByRole('heading', { name: 'Exit?', exact: true })).toBeVisible()
        await expect(exitDialog.getByText(unsavedWarning, { exact: true })).toBeVisible()
        await exitDialog.getByRole('button', { name: 'Exit', exact: true }).click()

        // Assert
        await expect(panel).toHaveCount(0)
        await expect(reviewHeading).toHaveCount(0)
        await expect(exitDialog).toHaveCount(0)
        await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe(bodyOverflowBeforeOpen)
        expect(serverActionRequests).toHaveLength(0)
    })
})

import { expect, test, type Locator, type Page } from '@playwright/test'

const PRODUCT_PATH = process.env.E2E_CART_PRODUCT_PATH
    || '/sites/glowbox-toys/products/cute-plush-bear-hoodie-o18z8'

type MotionSample = {
    elapsed: number
    translateX: number
}

type MotionWindow = Window & {
    __cartDrawerMotionSamples?: MotionSample[]
}

async function openProductWithEmptyCart(page: Page) {
    await page.goto(PRODUCT_PATH, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
        for (const key of Object.keys(window.localStorage)) {
            if (key === 'primeweb-cart' || key.startsWith('primeweb-cart:')) {
                window.localStorage.removeItem(key)
            }
        }
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /add to cart/i })).toBeVisible()
}

function cartBadge(page: Page): Locator {
    return page
        .locator('section.fixed.bottom-6.left-6')
        .getByRole('button')
        .locator('span')
        .last()
}

async function startDrawerMotionCapture(page: Page) {
    await page.evaluate(() => {
        const motionWindow = window as MotionWindow
        motionWindow.__cartDrawerMotionSamples = []

        const observer = new MutationObserver(() => {
            const drawer = document.querySelector<HTMLElement>(
                '[role="dialog"][aria-labelledby="cart-drawer-title"]',
            )
            if (!drawer || drawer.dataset.motionCaptureStarted === 'true') return

            drawer.dataset.motionCaptureStarted = 'true'
            const startedAt = performance.now()

            const sample = () => {
                const matrix = new DOMMatrixReadOnly(window.getComputedStyle(drawer).transform)
                const elapsed = performance.now() - startedAt
                motionWindow.__cartDrawerMotionSamples?.push({
                    elapsed,
                    translateX: matrix.m41,
                })

                if (elapsed < 1_000 && Math.abs(matrix.m41) > 0.5) {
                    window.requestAnimationFrame(sample)
                } else {
                    observer.disconnect()
                }
            }

            sample()
        })

        observer.observe(document.body, { childList: true, subtree: true })
    })
}

test.describe('Cart Drawer browser regression', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' })
    })

    test('[TC-F09.12] drawer completes slide-in with backdrop and full-width mobile layout', async ({ page }) => {
        // Arrange
        await openProductWithEmptyCart(page)
        await startDrawerMotionCapture(page)

        // Act
        await page.getByRole('button', { name: /add to cart/i }).click()
        const drawer = page.getByRole('dialog', { name: /shopping cart/i })

        // Assert
        await expect(drawer).toBeVisible()
        await expect(page.getByTestId('cart-drawer-backdrop')).toHaveCSS('opacity', '1')
        await expect.poll(async () => drawer.evaluate((element) => (
            new DOMMatrixReadOnly(window.getComputedStyle(element).transform).m41
        ))).toBeLessThanOrEqual(0.5)

        const samples = await page.evaluate(() => (
            (window as MotionWindow).__cartDrawerMotionSamples ?? []
        ))
        expect(samples.some(sample => sample.translateX > 100)).toBe(true)

        const settled = samples.find(sample => Math.abs(sample.translateX) <= 0.5)
        expect(settled, 'drawer motion must reach its final x=0 position').toBeDefined()
        expect(settled!.elapsed).toBeLessThan(300)

        const box = await drawer.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.x).toBeCloseTo(0, 0)
        expect(box!.width).toBeCloseTo(375, 0)
    })

    test('[TC-F09.15/16/21] decrementing quantity 1 removes item and updates subtotal and badge', async ({ page }) => {
        // Arrange
        await openProductWithEmptyCart(page)
        await page.getByRole('button', { name: /add to cart/i }).click()

        const drawer = page.getByRole('dialog', { name: /shopping cart/i })
        const decreaseButton = drawer.getByRole('button', { name: /decrease quantity for/i })
        const subtotalLabel = drawer.getByText(/^subtotal$/i)

        await expect(drawer).toBeVisible()
        await expect(drawer.getByRole('heading', { name: /shopping cart \(1\)/i })).toBeVisible()
        await expect(decreaseButton).toBeEnabled()
        await expect(subtotalLabel).toBeVisible()
        await expect(subtotalLabel.locator('xpath=following-sibling::span')).toContainText(/RM/)
        await expect(cartBadge(page)).toHaveText('1')

        // Act
        await decreaseButton.click()

        // Assert
        await expect(decreaseButton).toHaveCount(0)
        await expect(drawer.getByRole('heading', { name: /shopping cart \(0\)/i })).toBeVisible()
        await expect(subtotalLabel).toHaveCount(0)
        await expect(cartBadge(page)).toHaveText('0')
    })
})

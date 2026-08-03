import { expect, test, type Frame, type Page } from '@playwright/test'

type ProductDoc = ReturnType<typeof createProductDoc>

type ProductPayload = {
    docs: ProductDoc[]
    page: number
    totalPages: number
    totalDocs: number
}

type CategoryDoc = {
    id: string
    name: string
    slug: string
    parent: string | null
    breadcrumbs?: string
}

type ApiFixtureOptions = {
    categories?: CategoryDoc[]
    resolveProducts: (url: URL) => ProductPayload | Promise<ProductPayload>
}

function createProductDoc(id: number, name: string) {
    return {
        id,
        slug: `product-${id}`,
        name,
        price: 49.9,
        currency: 'MYR',
        inventory: 10,
        images: [],
        category: { id: 'root-a', name: 'Category A', slug: 'category-a' },
        shortDescription: `${name} description`,
    }
}

function createProductPayload(docs: ProductDoc[], page = 1, totalPages = 1, totalDocs = docs.length): ProductPayload {
    return { docs, page, totalPages, totalDocs }
}

function createRequestGate() {
    let markRequested!: () => void
    let release!: () => void
    const requested = new Promise<void>((resolve) => {
        markRequested = resolve
    })
    const released = new Promise<void>((resolve) => {
        release = resolve
    })

    return { markRequested, release, released, requested }
}

async function installProductGridApi(page: Page, options: ApiFixtureOptions) {
    await page.route('**/api/storefront/**', async (route) => {
        const url = new URL(route.request().url())

        if (url.pathname === '/api/storefront/categories') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ docs: options.categories ?? [] }),
            })
            return
        }

        if (url.pathname === '/api/storefront/products/bounds') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ minPrice: 10, maxPrice: 120, attributes: [] }),
            })
            return
        }

        if (url.pathname === '/api/storefront/products') {
            const payload = await options.resolveProducts(url)
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(payload),
            })
            return
        }

        await route.fallback()
    })
}

async function openHarness(page: Page) {
    await page.goto('/test-blocks', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Products Grid Filters Harness' })).toBeVisible()
    await expect(page.locator('[data-grid-seed]')).toBeVisible()
    await expect.poll(() => page.locator('[data-grid-seed]').evaluate((element) => (
        getComputedStyle(element).display
    ))).toBe('grid')
}

async function mountEditorPreviewFrame(page: Page): Promise<Frame> {
    await page.evaluate(() => {
        const iframe = document.createElement('iframe')
        iframe.title = 'Product Grid editor preview'
        iframe.src = '/test-blocks?editor=1&pageId=page-7&site=1'
        iframe.style.width = '1200px'
        iframe.style.height = '900px'
        iframe.style.border = '0'
        document.body.replaceChildren(iframe)
    })

    await expect(page.locator('iframe[title="Product Grid editor preview"]')).toBeVisible()
    await expect.poll(() => page.frames().some((frame) => (
        frame !== page.mainFrame() && frame.url().includes('/test-blocks?editor=1')
    ))).toBe(true)

    return page.frames().find((frame) => (
        frame !== page.mainFrame() && frame.url().includes('/test-blocks?editor=1')
    ))!
}

async function expectResultsAnchorInViewport(page: Page) {
    const viewport = page.viewportSize()

    expect(viewport).not.toBeNull()
    await expect.poll(async () => {
        const anchorBox = await page.getByTestId('products-grid-results-top').boundingBox()
        return anchorBox?.y ?? Number.POSITIVE_INFINITY
    }).toBeGreaterThanOrEqual(0)
    await expect.poll(async () => {
        const anchorBox = await page.getByTestId('products-grid-results-top').boundingBox()
        return anchorBox?.y ?? Number.POSITIVE_INFINITY
    }).toBeLessThan(viewport!.height)
}

async function expectResultsAnchorAboveViewport(page: Page) {
    await expect.poll(async () => {
        const anchorBox = await page.getByTestId('products-grid-results-top').boundingBox()
        return anchorBox?.y ?? 0
    }).toBeLessThan(0)
}

const ROOT_CATEGORIES: CategoryDoc[] = [
    { id: 'root-a', name: 'Category A', slug: 'category-a', parent: null },
    { id: 'child-a', name: 'A Child', slug: 'a-child', parent: 'root-a' },
    { id: 'root-b', name: 'Category B', slug: 'category-b', parent: null },
    { id: 'child-b', name: 'B Child', slug: 'b-child', parent: 'root-b' },
]

test.describe('Product Grid QA rework browser regressions', () => {
    test('[TC-F09.253] editor checkbox row resolves semantic light and dark computed styles', async ({ page }) => {
        // Arrange
        // Keep the app document/head so this exercises the CSS emitted by the
        // running Next.js build instead of restating the semantic declarations.
        await page.goto('/login')
        await page.evaluate(() => {
            const shell = document.createElement('div')
            shell.className = 'editor-shell'

            const currentRow = document.createElement('label')
            currentRow.id = 'gh-1665-current-row'
            currentRow.className = 'group flex cursor-pointer items-center gap-3 rounded-xl border border-solid border-[var(--editor-border)] bg-[var(--editor-surface-elevated)] px-3 py-2 text-sm text-[var(--editor-text)] transition-colors hover:border-[hsl(var(--primary)/0.45)] focus-within:border-[hsl(var(--ring)/0.65)]'
            const checkbox = document.createElement('button')
            checkbox.id = 'gh-1665-current-checkbox'
            checkbox.dataset.state = 'checked'
            checkbox.className = 'h-5 w-5 rounded-md border-solid border-[hsl(var(--input-border))] bg-[var(--editor-surface-deep)] text-[hsl(var(--primary-foreground))] transition-colors focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--editor-surface-elevated)] data-[state=checked]:border-[hsl(var(--primary))] data-[state=checked]:bg-[hsl(var(--primary))] data-[state=checked]:text-[hsl(var(--primary-foreground))]'
            currentRow.append(checkbox)

            shell.append(currentRow)
            document.body.append(shell)
        })

        const readThemeStyles = () => page.evaluate(() => {
            const snapshot = (element: Element) => {
                const style = getComputedStyle(element)
                return {
                    backgroundColor: style.backgroundColor,
                    borderColor: style.borderColor,
                    borderStyle: style.borderStyle,
                    color: style.color,
                }
            }

            const row = document.querySelector('#gh-1665-current-row')
            const checkbox = document.querySelector('#gh-1665-current-checkbox')
            if (!row || !checkbox) throw new Error('GH-1665 theme fixture is missing')

            return {
                row: snapshot(row),
                checkbox: snapshot(checkbox),
                rootClassName: document.documentElement.className,
                rootSurfaceToken: getComputedStyle(document.documentElement).getPropertyValue('--editor-surface-elevated').trim(),
            }
        })

        // Act
        await page.evaluate(() => {
            localStorage.setItem('theme', 'light')
            document.documentElement.classList.remove('dark')
        })

        // Assert
        await expect.poll(readThemeStyles).toMatchObject({
            row: {
                backgroundColor: 'rgb(255, 255, 255)',
                borderColor: 'rgba(0, 0, 0, 0.08)',
                borderStyle: 'solid',
                color: 'rgb(34, 49, 63)',
            },
            checkbox: { backgroundColor: 'rgb(0, 211, 212)' },
            rootSurfaceToken: '#fff',
        })

        // Act
        await page.evaluate(() => {
            localStorage.setItem('theme', 'dark')
            document.documentElement.classList.add('dark')
        })

        // Assert
        await expect.poll(readThemeStyles).toMatchObject({
            row: {
                backgroundColor: 'rgb(30, 41, 59)',
                borderColor: 'rgba(255, 255, 255, 0.06)',
                borderStyle: 'solid',
                color: 'rgb(248, 250, 252)',
            },
            checkbox: { backgroundColor: 'rgb(45, 212, 191)' },
            rootClassName: expect.stringContaining('dark'),
            rootSurfaceToken: '#1e293b',
        })
    })

    test('[TC-F09.254] editor iframe allows grid/list layout changes and preserves preview params', async ({ page }) => {
        // Arrange
        const products = Array.from({ length: 3 }, (_, index) => createProductDoc(index + 1, `Preview Product ${index + 1}`))
        await installProductGridApi(page, {
            categories: ROOT_CATEGORIES,
            resolveProducts: () => createProductPayload(products),
        })
        await openHarness(page)
        const previewFrame = await mountEditorPreviewFrame(page)
        await expect(previewFrame.getByRole('button', { name: 'List view' })).toBeVisible()
        const grid = previewFrame.locator('[data-grid-seed]')

        // Act
        await previewFrame.getByRole('button', { name: 'List view' }).click()

        // Assert
        await expect.poll(() => new URL(previewFrame.url()).searchParams.get('view')).toBe('list')
        expect(new URL(previewFrame.url()).searchParams.get('editor')).toBe('1')
        expect(new URL(previewFrame.url()).searchParams.get('pageId')).toBe('page-7')
        expect(new URL(previewFrame.url()).searchParams.get('site')).toBe('1')
        await expect(grid).toHaveClass(/grid-cols-1/)

        const firstProductLink = grid.getByRole('link', { name: /Preview Product 1/ })
        await expect(firstProductLink).toHaveClass(/flex h-\[126px\]/)
        await expect(firstProductLink).not.toHaveClass(/flex-col/)

        // Act — switch back to grid.
        await previewFrame.getByRole('button', { name: 'Grid view' }).click()

        // Assert
        await expect.poll(() => new URL(previewFrame.url()).searchParams.get('view')).toBe('grid-3')
        await expect(grid).toHaveClass(/lg:grid-cols-3/)
        await expect(firstProductLink).toHaveClass(/flex h-full flex-col/)
    })

    test('[TC-F09.256] filter changes keep the results anchor visible before and after delayed results settle', async ({ page }) => {
        // Arrange
        const filteredGate = createRequestGate()
        const initialProducts = Array.from({ length: 9 }, (_, index) => createProductDoc(index + 1, `Initial Product ${index + 1}`))
        await installProductGridApi(page, {
            categories: ROOT_CATEGORIES,
            resolveProducts: async (url) => {
                if (url.searchParams.has('categoryId')) {
                    filteredGate.markRequested()
                    await filteredGate.released
                    return createProductPayload([createProductDoc(101, 'Filtered Product')])
                }
                return createProductPayload(initialProducts, 1, 3, 27)
            },
        })
        await openHarness(page)
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await expectResultsAnchorAboveViewport(page)

        // Act
        await page.getByRole('button', { name: 'Category A', exact: true }).evaluate((element) => (
            (element as HTMLButtonElement).click()
        ))
        await filteredGate.requested

        // Assert
        await expect(page).toHaveURL(/categoryId=root-a/)
        await expect(page.getByRole('heading', { name: 'Initial Product 1', exact: true })).toBeVisible()
        await expectResultsAnchorInViewport(page)

        // Act — settle the replacement response.
        filteredGate.release()

        // Assert
        await expect(page.getByRole('heading', { name: 'Filtered Product', exact: true })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Initial Product 1', exact: true })).toHaveCount(0)
        await expectResultsAnchorInViewport(page)
    })

    test('[TC-F09.257] pagination keeps the results anchor visible while a shorter page settles', async ({ page }) => {
        // Arrange
        const pageTwoGate = createRequestGate()
        const initialProducts = Array.from({ length: 9 }, (_, index) => createProductDoc(index + 1, `Page One Product ${index + 1}`))
        await installProductGridApi(page, {
            resolveProducts: async (url) => {
                if (url.searchParams.get('page') === '2') {
                    pageTwoGate.markRequested()
                    await pageTwoGate.released
                    return createProductPayload([createProductDoc(201, 'Page Two Product')], 2, 3, 27)
                }
                return createProductPayload(initialProducts, 1, 3, 27)
            },
        })
        await openHarness(page)
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await expectResultsAnchorAboveViewport(page)

        // Act
        await page.getByRole('button', { name: 'Page 2' }).evaluate((element) => (
            (element as HTMLButtonElement).click()
        ))
        await pageTwoGate.requested

        // Assert
        await expect(page).toHaveURL(/page=2/)
        await expect(page.getByRole('heading', { name: 'Page One Product 1', exact: true })).toBeVisible()
        await expectResultsAnchorInViewport(page)

        // Act — settle the shorter page.
        pageTwoGate.release()

        // Assert
        await expect(page.getByRole('heading', { name: 'Page Two Product', exact: true })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Page One Product 1', exact: true })).toHaveCount(0)
        await expectResultsAnchorInViewport(page)
    })

    test('[TC-F09.258] initial loading renders six card-shaped placeholders without collapsing results geometry', async ({ page }) => {
        // Arrange
        const initialGate = createRequestGate()
        const loadedProducts = Array.from({ length: 6 }, (_, index) => createProductDoc(index + 1, `Loaded Product ${index + 1}`))
        await installProductGridApi(page, {
            resolveProducts: async () => {
                initialGate.markRequested()
                await initialGate.released
                return createProductPayload(loadedProducts)
            },
        })

        // Act
        await page.goto('/test-blocks', { waitUntil: 'domcontentloaded' })
        await initialGate.requested

        // Assert
        const skeleton = page.getByTestId('products-grid-skeleton')
        await expect(skeleton).toBeVisible()
        await expect(page.getByTestId('product-card-skeleton')).toHaveCount(6)
        await expect(skeleton).toHaveClass(/grid-cols-2/)
        await expect(skeleton).toHaveClass(/lg:grid-cols-3/)
        expect(await skeleton.evaluate((element) => (
            getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
        ))).toBe(3)
        const skeletonBox = await skeleton.boundingBox()
        expect(skeletonBox).not.toBeNull()
        expect(skeletonBox!.height).toBeGreaterThan(250)

        // Act — settle initial loading.
        initialGate.release()

        // Assert
        const productGrid = page.locator('[data-grid-seed]')
        await expect(productGrid).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Loaded Product 1', exact: true })).toBeVisible()
        const productGridBox = await productGrid.boundingBox()
        expect(productGridBox).not.toBeNull()
        expect(productGridBox!.height).toBeGreaterThan(250)
    })

    test('[TC-F09.259/260] 375px drawer closes sibling branches and creates no horizontal overflow', async ({ page }) => {
        // Arrange
        await page.setViewportSize({ width: 375, height: 812 })
        await installProductGridApi(page, {
            categories: ROOT_CATEGORIES,
            resolveProducts: () => createProductPayload([
                createProductDoc(1, 'Mobile Product 1'),
                createProductDoc(2, 'Mobile Product 2'),
            ]),
        })
        await openHarness(page)
        await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible()

        // Act
        await page.getByRole('button', { name: 'Filters' }).click()
        const dialog = page.getByRole('dialog', { name: 'Filters' })
        await expect(dialog).toBeVisible()
        await dialog.getByRole('button', { name: 'Expand Category A' }).click()
        await expect(dialog.getByText('A Child', { exact: true })).toBeVisible()
        await dialog.getByRole('button', { name: 'Expand Category B' }).click()

        // Assert
        await expect(dialog.getByText('A Child', { exact: true })).toHaveCount(0)
        await expect(dialog.getByText('B Child', { exact: true })).toBeVisible()
        expect(await page.locator('[data-grid-seed]').evaluate((element) => (
            getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
        ))).toBe(2)
        const documentOverflow = await page.evaluate(() => (
            document.documentElement.scrollWidth - document.documentElement.clientWidth
        ))
        const drawerOverflow = await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)
        expect(documentOverflow).toBeLessThanOrEqual(0)
        expect(drawerOverflow).toBeLessThanOrEqual(0)
    })
})

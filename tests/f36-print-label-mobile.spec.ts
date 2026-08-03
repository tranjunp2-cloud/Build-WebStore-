import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const ORDER_ID = 'gh-1684-shipping-label'
const ORDER_PATH = `/orders/${ORDER_ID}`

const NATIVE_VIEWER_PROJECTS = new Set([
  'shipping-label-regression',
  'shipping-label-narrow-desktop',
])
const WEBKIT_PROJECTS = new Set([
  'shipping-label-mobile-safari',
  'shipping-label-edge-ios',
  'shipping-label-ipad-webkit',
  'shipping-label-ipad-landscape',
])
const LABEL_PDF = readFileSync('tests/fixtures/shipping-label-soft-mask.pdf')
const DEVICE_RGB_LABEL_PDF = readFileSync('tests/fixtures/shipping-label-device-rgb.pdf')
const IPAD_DESKTOP_PROJECT = 'shipping-label-ipad-landscape'

const orderFixture = {
  id: ORDER_ID,
  orderNumber: 'ORDER-GH-1684',
  status: 'ready_to_ship',
  paymentStatus: 'paid',
  paymentMethod: 'stripe',
  subtotal: 12000,
  shippingFee: 800,
  tax: 0,
  total: 12800,
  currency: 'MYR',
  customerName: 'Mobile Preview Tester',
  customerEmail: 'preview@example.test',
  customerPhone: '+60 12-345 6789',
  shippingAddress: {
    line1: '1684 Canvas Street',
    city: 'Shah Alam',
    state: 'Selangor',
    postcode: '40000',
    country: 'Malaysia',
  },
  items: [{
    productName: 'Shipping label regression item',
    variant: 'Standard',
    quantity: 1,
    unitPrice: 12000,
  }],
  awbNo: 'TEST-AWB-1684',
  easyParcelOrderNo: 'LOCAL-GH1684',
  labelUrl: `/api/orders/${ORDER_ID}/label?format=A6`,
  labelUrls: {
    A6: `/api/orders/${ORDER_ID}/label?format=A6`,
    A4: `/api/orders/${ORDER_ID}/label?format=A4`,
  },
  shippingCourier: 'jnt',
  shippingCourierName: 'J&T Express',
  shippingServiceId: 'fixture-service',
  parcelWeight: 1000,
  shippingTrackingStatus: 'pending_pickup',
  trackingNumber: 'TEST-AWB-1684',
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
  tenant: {
    id: 'fixture-tenant',
    easyParcelIntegration: {
      enabled: true,
      selectedCouriers: ['jnt'],
    },
  },
}

async function installFixtures(page: Page, labelPdf = LABEL_PDF) {
  await page.route((url) => (
    url.pathname === `/api/orders/${ORDER_ID}` &&
    url.searchParams.get('depth') === '2'
  ), async (route) => {
    await route.fulfill({ status: 200, json: { data: orderFixture } })
  })

  await page.route(`**/api/orders/${ORDER_ID}/poll`, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        data: {
          status: orderFixture.status,
          shippingTrackingStatus: orderFixture.shippingTrackingStatus,
          updatedAt: orderFixture.updatedAt,
        },
      },
    })
  })

  await page.route(`**/api/orders/${ORDER_ID}/label?format=*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      headers: { 'cache-control': 'no-store' },
      body: labelPdf,
    })
  })

  await page.route('**/api/tenant/fixture-tenant/easyparcel-couriers', async (route) => {
    await route.fulfill({
      status: 200,
      json: { data: { couriers: [], wallet: null } },
    })
  })
}

interface NormalizedRegion {
  x1: number
  y1: number
  x2: number
  y2: number
}

async function canvasRegionMetrics(page: Page, region: NormalizedRegion) {
  return page.locator('.plabel-pdf-document canvas').evaluate(
    (canvas: HTMLCanvasElement, normalizedRegion) => {
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        return { darkRatio: 0, horizontalTransitions: 0, verticalTransitions: 0 }
      }

      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      const left = Math.floor(canvas.width * normalizedRegion.x1)
      const right = Math.ceil(canvas.width * normalizedRegion.x2)
      const top = Math.floor(canvas.height * normalizedRegion.y1)
      const bottom = Math.ceil(canvas.height * normalizedRegion.y2)
      const isDark = (x: number, y: number) => {
        const pixel = (y * canvas.width + x) * 4
        return (
          pixels[pixel + 3] > 200 &&
          pixels[pixel] < 160 &&
          pixels[pixel + 1] < 160 &&
          pixels[pixel + 2] < 160
        )
      }
      const median = (values: number[]) => (
        [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0
      )

      let darkPixels = 0
      let totalPixels = 0
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          darkPixels += Number(isDark(x, y))
          totalPixels += 1
        }
      }

      const horizontal: number[] = []
      const vertical: number[] = []
      for (let sample = 1; sample <= 5; sample += 1) {
        const y = Math.min(bottom - 1, Math.floor(top + ((bottom - top) * sample) / 6))
        const x = Math.min(right - 1, Math.floor(left + ((right - left) * sample) / 6))
        let horizontalCount = 0
        let verticalCount = 0
        for (let scanX = left + 1; scanX < right; scanX += 1) {
          horizontalCount += Number(isDark(scanX, y) !== isDark(scanX - 1, y))
        }
        for (let scanY = top + 1; scanY < bottom; scanY += 1) {
          verticalCount += Number(isDark(x, scanY) !== isDark(x, scanY - 1))
        }
        horizontal.push(horizontalCount)
        vertical.push(verticalCount)
      }

      return {
        darkRatio: totalPixels > 0 ? darkPixels / totalPixels : 0,
        horizontalTransitions: median(horizontal),
        verticalTransitions: median(vertical),
      }
    },
    region,
  )
}

test.describe('GH-1684 shipping label preview regression', () => {
  test('[GH-1652] order progress and fulfillment remain contained at QA viewports', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'shipping-label-regression',
      'One deterministic Chromium run covers the responsive order-detail geometry.',
    )
    await installFixtures(page)

    await page.goto(ORDER_PATH, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(orderFixture.orderNumber, { exact: true })).toBeVisible()

    const progressCard = page.locator('.od-progress')
    const progressViewport = progressCard.locator(
      '[data-order-progress-mode="embedded"] > div',
    )
    const fulfillment = page.locator('.od-fulfil')
    const trackRow = fulfillment.locator('.st-row').first()

    await expect(progressCard).toBeVisible()
    await expect(progressCard.locator('[data-order-progress-mode="embedded"]')).toBeVisible()
    await expect(progressCard.locator(':scope > .od-cap')).toHaveCount(1)
    await expect(fulfillment).toBeVisible()
    await expect(trackRow).toBeVisible()
    expect(await trackRow.locator('.st-field').count()).toBeGreaterThan(0)

    for (const width of [374, 390, 481]) {
      await page.setViewportSize({ width, height: 900 })

      const geometry = await progressViewport.evaluate((viewport) => ({
        clientWidth: viewport.clientWidth,
        scrollWidth: viewport.scrollWidth,
        documentOverflow:
          document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }))
      expect(geometry.scrollWidth).toBeGreaterThanOrEqual(geometry.clientWidth)
      expect(geometry.documentOverflow).toBe(false)
    }

    for (const width of [1167, 1200, 1270]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(trackRow).toBeVisible()

      const geometry = await fulfillment.evaluate((container) => {
        const containerBox = container.getBoundingClientRect()
        const elements = Array.from(
          container.querySelectorAll('.st-row, .st-field, .st-actions, .copyfield'),
        )
        const overflow = elements
          .map((element) => {
            const box = element.getBoundingClientRect()
            return {
              className: element.className,
              left: box.left,
              right: box.right,
            }
          })
          .filter(({ left, right }) => (
            left < containerBox.left - 1 || right > containerBox.right + 1
          ))

        return {
          checkedElements: elements.length,
          documentOverflow:
            document.documentElement.scrollWidth > document.documentElement.clientWidth,
          overflow,
        }
      })

      expect(geometry.checkedElements).toBeGreaterThan(0)
      expect(geometry.documentOverflow).toBe(false)
      expect(geometry.overflow).toEqual([])
    }
  })

  test('[TC-F36.OD.051/052] readable PDF and non-overlapping modal', async ({
    page,
  }, testInfo) => {
    // Arrange
    const usesNativeViewer = NATIVE_VIEWER_PROJECTS.has(testInfo.project.name)
    const isWebKit = WEBKIT_PROJECTS.has(testInfo.project.name)
    const emulatesIpadDesktopSite = testInfo.project.name === IPAD_DESKTOP_PROJECT
    if (emulatesIpadDesktopSite) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'maxTouchPoints', {
          configurable: true,
          value: 5,
        })
      })
    }
    await installFixtures(page)

    // Act
    await page.goto(ORDER_PATH, { waitUntil: 'domcontentloaded' })
    if (emulatesIpadDesktopSite) {
      const capabilities = await page.evaluate(() => ({
        hasMacintoshUserAgent: /Macintosh/i.test(navigator.userAgent),
        maxTouchPoints: navigator.maxTouchPoints,
      }))
      expect(capabilities).toEqual({
        hasMacintoshUserAgent: true,
        maxTouchPoints: 5,
      })
    }
    await expect(page.getByText(orderFixture.orderNumber, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /print label|cetak label/i }).click()

    const dialog = page.getByRole('dialog', {
      name: /print shipping label|cetak label penghantaran/i,
    })
    const canvas = dialog.locator('.plabel-pdf-document canvas')
    await expect(dialog).toBeVisible()

    // Assert — desktop keeps the deployed native viewer; only mobile/tablet use canvas.
    if (usesNativeViewer) {
      const nativeViewer = dialog.locator('.plabel-pdf-frame')
      await expect(nativeViewer).toBeVisible()
      await expect(nativeViewer).toHaveAttribute(
        'src',
        /^blob:.*#toolbar=0&navpanes=0&scrollbar=0$/,
      )
      await expect(canvas).toHaveCount(0)
    } else {
      await expect(canvas).toBeVisible()
      await expect(dialog.locator('iframe, object, embed')).toHaveCount(0)

      const topBarcode = { x1: 0.23, y1: 0.06, x2: 0.95, y2: 0.16 }
      const bottomBarcode = { x1: 0.23, y1: 0.87, x2: 0.95, y2: 0.95 }
      const qr = { x1: 0.76, y1: 0.44, x2: 0.92, y2: 0.56 }
      const senderText = { x1: 0.08, y1: 0.25, x2: 0.72, y2: 0.39 }
      const recipientText = { x1: 0.08, y1: 0.41, x2: 0.72, y2: 0.56 }

      if (isWebKit) {
        await expect(canvas).toHaveAttribute('data-repaired-pdf-images', '3')
      }
      await expect.poll(
        async () => (await canvasRegionMetrics(page, topBarcode)).horizontalTransitions,
        { message: 'A6 top barcode renders' },
      ).toBeGreaterThanOrEqual(25)
      await expect.poll(
        async () => (await canvasRegionMetrics(page, bottomBarcode)).horizontalTransitions,
        { message: 'A6 bottom barcode renders' },
      ).toBeGreaterThanOrEqual(25)
      await expect.poll(
        async () => {
          const metrics = await canvasRegionMetrics(page, qr)
          return Math.min(metrics.horizontalTransitions, metrics.verticalTransitions)
        },
        { message: 'A6 QR code renders' },
      ).toBeGreaterThanOrEqual(4)
      await expect.poll(
        async () => (await canvasRegionMetrics(page, senderText)).darkRatio,
        { message: 'A6 sender text renders' },
      ).toBeGreaterThan(0.02)
      await expect.poll(
        async () => (await canvasRegionMetrics(page, recipientText)).darkRatio,
        { message: 'A6 recipient text renders' },
      ).toBeGreaterThan(0.02)

    }

    // Assert — responsive geometry and reachable controls.
    const geometry = await dialog.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const grid = element.querySelector('.plabel-grid')?.getBoundingClientRect()
      const side = element.querySelector('.plabel-side')?.getBoundingClientRect()
      const footer = element.querySelector('.plabel-foot')?.getBoundingClientRect()
      const visibleSideBottom = side && grid ? Math.min(side.bottom, grid.bottom) : null
      return {
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        left: box.left,
        footerOverlapsVisibleSide: Boolean(
          footer && visibleSideBottom !== null && footer.top < visibleSideBottom - 1,
        ),
        footerOverlapsGrid: Boolean(grid && footer && footer.top < grid.bottom - 1),
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }
    })

    expect(geometry.top).toBeGreaterThanOrEqual(0)
    expect(geometry.left).toBeGreaterThanOrEqual(0)
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth)
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight)
    expect(geometry.footerOverlapsVisibleSide).toBe(false)
    expect(geometry.footerOverlapsGrid).toBe(false)
    expect(geometry.horizontalOverflow).toBe(false)

    const grid = dialog.locator('.plabel-grid')
    const gridOverflow = await grid.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }))
    expect(gridOverflow.scrollWidth).toBeLessThanOrEqual(gridOverflow.clientWidth)

    for (const control of [
      dialog.getByRole('radiogroup'),
      dialog.getByRole('checkbox'),
      dialog.locator('.plabel-hint'),
    ]) {
      await control.scrollIntoViewIfNeeded()
      await expect(control).toBeInViewport()
      const placement = await control.evaluate((element) => {
        const controlBox = element.getBoundingClientRect()
        const gridBox = element.closest('.plabel-grid')?.getBoundingClientRect()
        const footerBox = element
          .closest('.plabel-dialog')
          ?.querySelector('.plabel-foot')
          ?.getBoundingClientRect()
        return {
          insideGridTop: Boolean(gridBox && controlBox.top >= gridBox.top - 1),
          insideGridBottom: Boolean(gridBox && controlBox.bottom <= gridBox.bottom + 1),
          aboveFooter: Boolean(!footerBox || controlBox.bottom <= footerBox.top + 1),
        }
      })
      expect(placement).toEqual({
        insideGridTop: true,
        insideGridBottom: true,
        aboveFooter: true,
      })
    }

    const actions = dialog.locator('.plabel-foot > button')
    await expect(actions).toHaveCount(3)
    for (let index = 0; index < 3; index += 1) {
      await expect(actions.nth(index)).toBeVisible()
    }
    await expect(actions.nth(1)).toBeEnabled()
    await expect(actions.nth(2)).toBeEnabled()
  })

  test('[TC-F36.OD.051] DeviceRGB image remains on the WebKit canvas', async ({
    page,
  }, testInfo) => {
    // Arrange
    test.skip(
      testInfo.project.name !== 'shipping-label-mobile-safari',
      'One WebKit browser is sufficient for the DeviceRGB conversion regression.',
    )
    await installFixtures(page, DEVICE_RGB_LABEL_PDF)

    // Act
    await page.goto(ORDER_PATH, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(orderFixture.orderNumber, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /print label|cetak label/i }).click()

    // Assert
    const dialog = page.getByRole('dialog', {
      name: /print shipping label|cetak label penghantaran/i,
    })
    const canvas = dialog.locator('.plabel-pdf-document canvas')
    await expect(canvas).toBeVisible()
    await expect(canvas).toHaveAttribute('data-repaired-pdf-images', '1')
    const renderedColors = await canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext('2d', { willReadFrequently: true })
      if (!context) return { red: false, green: false, blue: false }

      const pixels = context.getImageData(0, 0, element.width, element.height).data
      const colors = { red: false, green: false, blue: false }
      for (let index = 0; index < pixels.length; index += 4) {
        const [red, green, blue, alpha] = pixels.subarray(index, index + 4)
        if (alpha < 200) continue
        colors.red ||= red > 180 && green < 100 && blue < 100
        colors.green ||= green > 180 && red < 100 && blue < 100
        colors.blue ||= blue > 180 && red < 100 && green < 100
        if (colors.red && colors.green && colors.blue) break
      }
      return colors
    })
    expect(renderedColors).toEqual({ red: true, green: true, blue: true })
    await expect(dialog.locator('.plabel-render-error')).toHaveCount(0)
    await expect(dialog.locator('iframe, object, embed')).toHaveCount(0)
  })
})

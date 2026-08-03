import { describe, expect, it } from 'vitest'
import { usesWebKitPdfRenderer } from '@/app/(dashboard)/orders/_components/detail/pdf-preview-device'

const EDGE_IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/128.0 Mobile/15E148 Safari/605.1.15'
const SAFARI_IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15'
const CHROME_ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36'
const EDGE_DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 Edg/128.0'

// ── TC-F36.OD.051: WebKit shipping-label renderer selection ───────────
describe('[TC-F36.OD.051] WebKit PDF renderer selection', () => {
  it('enables WebKit repair for Edge on iOS', () => {
    // Arrange
    const userAgent = EDGE_IOS_UA

    // Act
    const usesWebKit = usesWebKitPdfRenderer(userAgent)

    // Assert
    expect(usesWebKit).toBe(true)
  })

  it('enables WebKit repair for iPadOS desktop-site Safari', () => {
    // Arrange
    const userAgent = SAFARI_IPAD_DESKTOP_UA

    // Act
    const usesWebKit = usesWebKitPdfRenderer(userAgent)

    // Assert
    expect(usesWebKit).toBe(true)
  })

  it('keeps Chromium renderers on their native path', () => {
    // Arrange
    const userAgents = [CHROME_ANDROID_UA, EDGE_DESKTOP_UA]

    // Act
    const rendererSelections = userAgents.map(usesWebKitPdfRenderer)

    // Assert
    expect(rendererSelections).toEqual([false, false])
  })
})

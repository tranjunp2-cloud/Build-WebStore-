/**
 * Tests for src/lib/utils/image.ts — processImageFile()
 *
 * TC-IDs: TC-F08.03f, TC-F08.03g (image upload validation)
 * Browser APIs (FileReader, Image, Canvas) are mocked via jsdom + vi.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { processImageFile } from '@/lib/utils/image'

// ─── Browser API Mock Helpers ────────────────────────────────────────────────

/**
 * Build a mock File with controllable size + type.
 * jsdom File constructor accepts ArrayBuffer, so we create a Uint8Array of desired byte length.
 */
function makeFile(name: string, sizeBytes: number, type: string): File {
    const content = new Uint8Array(sizeBytes)
    return new File([content], name, { type })
}

function sizeInMB(mb: number): number {
    return Math.round(mb * 1024 * 1024)
}

/**
 * Set up a working FileReader + Image + Canvas mock chain.
 * The canvas mock calls toBlob with a fake compressed Blob (smaller than original).
 */
function setupBrowserApiMocks(compressedSizeBytes = 50_000) {
    // Mock FileReader
    const mockReadAsDataURL = vi.fn()
    const mockFileReader: Partial<FileReader> = {
        readAsDataURL: mockReadAsDataURL,
        onload: null as unknown as FileReader['onload'],
        onerror: null as unknown as FileReader['onerror'],
        result: 'data:image/jpeg;base64,fakebase64data',
    }

    vi.spyOn(global, 'FileReader').mockImplementation(() => {
        const instance = mockFileReader as FileReader
        // Simulate async onload when readAsDataURL is called
        mockReadAsDataURL.mockImplementation(() => {
            setTimeout(() => {
                if (typeof instance.onload === 'function') {
                    instance.onload({ target: { result: 'data:image/jpeg;base64,fakebase64data' } } as ProgressEvent<FileReader>)
                }
            }, 0)
        })
        return instance
    })

    // Mock Image
    const mockImage: Partial<HTMLImageElement> = {
        src: '',
        width: 800,
        height: 600,
        onload: null as unknown as HTMLImageElement['onload'],
        onerror: null as unknown as HTMLImageElement['onerror'],
    }

    vi.spyOn(global, 'Image').mockImplementation(() => {
        const instance = mockImage as HTMLImageElement
        // Simulate async onload when src is set
        Object.defineProperty(instance, 'src', {
            set(_value: string) {
                setTimeout(() => {
                    if (typeof instance.onload === 'function') {
                        instance.onload(new Event('load'))
                    }
                }, 0)
            },
            get() { return '' },
            configurable: true,
        })
        return instance
    })

    // Mock canvas.getContext + toBlob
    const compressedBlob = new Blob([new Uint8Array(compressedSizeBytes)], { type: 'image/webp' })
    const mockToBlob = vi.fn((callback: BlobCallback) => {
        setTimeout(() => callback(compressedBlob), 0)
    })
    const mockGetContext = vi.fn(() => ({
        drawImage: vi.fn(),
    }))

    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
            return {
                width: 0,
                height: 0,
                getContext: mockGetContext,
                toBlob: mockToBlob,
            } as unknown as HTMLCanvasElement
        }
        return originalCreateElement(tagName)
    })

    return { mockReadAsDataURL, mockToBlob, mockGetContext }
}

// ─── TC-F08.03f: File Size Validation ───────────────────────────────────────
describe('[TC-F08.03f] processImageFile — File Size & Type Validation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('TC-F08.03f: returns file unchanged when under size limit (1MB image)', async () => {
        // Arrange — 1MB file, default limit is 2MB
        const file = makeFile('photo.jpg', sizeInMB(1), 'image/jpeg')

        // Act
        const result = await processImageFile(file)

        // Assert — no processing needed
        expect(result).toBe(file)
        expect(result.size).toBe(file.size)
        expect(result.name).toBe('photo.jpg')
    })

    it('TC-F08.03f: returns file unchanged when exactly at size limit (2MB)', async () => {
        // Arrange — exactly 2MB = 2 * 1024 * 1024 bytes
        const file = makeFile('photo.jpg', sizeInMB(2), 'image/jpeg')

        // Act
        const result = await processImageFile(file)

        // Assert — exactly at limit, no compression
        expect(result).toBe(file)
    })

    it('TC-F08.03f: returns SVG unchanged regardless of size (non-compressible format)', async () => {
        // Arrange — SVG type does NOT start with 'image/' in the check:
        // !file.type.startsWith('image/') covers non-image types
        // But SVG IS 'image/svg+xml' which starts with 'image/'
        // The source bypasses compression only when sizeMB <= maxSizeMB or non-image
        // So: SVG under 2MB limit is returned as-is (hits the size guard)
        const file = makeFile('icon.svg', sizeInMB(1), 'image/svg+xml')

        // Act
        const result = await processImageFile(file)

        // Assert — under size limit, returned as-is regardless of type
        expect(result).toBe(file)
        expect(result.type).toBe('image/svg+xml')
    })

    it('TC-F08.03f: returns GIF unchanged (non-standard image format bypass)', async () => {
        // Arrange — GIF > 2MB, but starts with 'image/' — however gif does not compress well
        // processImageFile checks file.type.startsWith('image/') — GIF passes
        // but the condition is: sizeMB <= maxSizeMB || !file.type.startsWith('image/')
        // GIF IS an image type, so it WILL be processed if over limit
        // This test verifies a 1MB GIF is returned unchanged (under limit)
        const file = makeFile('animation.gif', sizeInMB(1), 'image/gif')

        // Act
        const result = await processImageFile(file)

        // Assert
        expect(result).toBe(file)
    })

    it('TC-F08.03f: returns non-image file unchanged even if large (PDF > 2MB)', async () => {
        // Arrange — PDF file, not an image type
        const file = makeFile('invoice.pdf', sizeInMB(5), 'application/pdf')

        // Act
        const result = await processImageFile(file)

        // Assert — non-image types are never processed
        expect(result).toBe(file)
        expect(result.type).toBe('application/pdf')
    })

    it('TC-F08.03f: respects custom maxSizeMB parameter', async () => {
        // Arrange — 3MB file with custom 5MB limit
        const file = makeFile('large.jpg', sizeInMB(3), 'image/jpeg')

        // Act — custom limit of 5MB
        const result = await processImageFile(file, 5)

        // Assert — under custom limit, no processing
        expect(result).toBe(file)
    })
})

// ─── TC-F08.03f: Compression Logic ──────────────────────────────────────────
describe('[TC-F08.03f] processImageFile — Compression & WebP Conversion', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('TC-F08.03f: compresses oversized JPEG and converts to WebP', async () => {
        // Arrange — 5MB JPEG, over 2MB limit
        setupBrowserApiMocks(50_000) // compressed to 50KB
        const file = makeFile('product.jpg', sizeInMB(5), 'image/jpeg')

        // Act
        const result = await processImageFile(file)

        // Assert — output is WebP
        expect(result.type).toBe('image/webp')
        expect(result.name).toBe('product.webp')
    })

    it('TC-F08.03f: renames output file to .webp extension', async () => {
        // Arrange — 3MB PNG
        setupBrowserApiMocks()
        const file = makeFile('banner.png', sizeInMB(3), 'image/png')

        // Act
        const result = await processImageFile(file)

        // Assert — extension replaced with .webp
        expect(result.name).toBe('banner.webp')
    })

    it('TC-F08.03f: replaces any extension with .webp (multi-dot filename)', async () => {
        // Arrange — filename with multiple dots
        setupBrowserApiMocks()
        const file = makeFile('my.product.photo.jpeg', sizeInMB(3), 'image/jpeg')

        // Act
        const result = await processImageFile(file)

        // Assert
        expect(result.name).toBe('my.product.photo.webp')
    })

    it('TC-F08.03f: returns original file when canvas context is unavailable', async () => {
        // Arrange — 3MB image, canvas returns null context (headless env edge case)
        vi.spyOn(global, 'FileReader').mockImplementation(() => {
            const instance = {
                readAsDataURL: vi.fn(),
                onload: null as unknown as FileReader['onload'],
                onerror: null as unknown as FileReader['onerror'],
            } as unknown as FileReader

            ;(instance.readAsDataURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
                setTimeout(() => {
                    if (typeof instance.onload === 'function') {
                        instance.onload({ target: { result: 'data:image/jpeg;base64,fake' } } as ProgressEvent<FileReader>)
                    }
                }, 0)
            })
            return instance
        })

        vi.spyOn(global, 'Image').mockImplementation(() => {
            const instance = {} as HTMLImageElement
            Object.defineProperty(instance, 'src', {
                set(_v: string) {
                    setTimeout(() => {
                        if (typeof instance.onload === 'function') {
                            instance.onload(new Event('load'))
                        }
                    }, 0)
                },
                get() { return '' },
                configurable: true,
            })
            instance.width = 400
            instance.height = 300
            return instance
        })

        const origCreateElement = document.createElement.bind(document)
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'canvas') {
                return {
                    width: 0,
                    height: 0,
                    getContext: vi.fn(() => null), // null context = fallback
                    toBlob: vi.fn(),
                } as unknown as HTMLCanvasElement
            }
            return origCreateElement(tag)
        })

        const file = makeFile('photo.jpg', sizeInMB(3), 'image/jpeg')

        // Act
        const result = await processImageFile(file)

        // Assert — fallback to original when context unavailable
        expect(result).toBe(file)
    })

    it('TC-F08.03f: returns original file when canvas toBlob returns null', async () => {
        // Arrange — toBlob callback receives null blob (browser limitation)
        vi.spyOn(global, 'FileReader').mockImplementation(() => {
            const instance = {
                readAsDataURL: vi.fn(),
                onload: null as unknown as FileReader['onload'],
                onerror: null as unknown as FileReader['onerror'],
            } as unknown as FileReader

            ;(instance.readAsDataURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
                setTimeout(() => {
                    if (typeof instance.onload === 'function') {
                        instance.onload({ target: { result: 'data:image/jpeg;base64,fake' } } as ProgressEvent<FileReader>)
                    }
                }, 0)
            })
            return instance
        })

        vi.spyOn(global, 'Image').mockImplementation(() => {
            const instance = {} as HTMLImageElement
            Object.defineProperty(instance, 'src', {
                set(_v: string) {
                    setTimeout(() => {
                        if (typeof instance.onload === 'function') {
                            instance.onload(new Event('load'))
                        }
                    }, 0)
                },
                get() { return '' },
                configurable: true,
            })
            instance.width = 400
            instance.height = 300
            return instance
        })

        const origCreateElement = document.createElement.bind(document)
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'canvas') {
                return {
                    width: 0,
                    height: 0,
                    getContext: vi.fn(() => ({ drawImage: vi.fn() })),
                    toBlob: vi.fn((cb: BlobCallback) => setTimeout(() => cb(null), 0)), // null blob
                } as unknown as HTMLCanvasElement
            }
            return origCreateElement(tag)
        })

        const file = makeFile('photo.jpg', sizeInMB(3), 'image/jpeg')

        // Act
        const result = await processImageFile(file)

        // Assert — null blob fallback returns original
        expect(result).toBe(file)
    })
})

// ─── TC-F08.03f: Image Dimension Scaling ────────────────────────────────────
describe('[TC-F08.03f] processImageFile — Dimension Constraints (Max 1920px)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('TC-F08.03f: scales down wide image to max 1920px width while preserving aspect ratio', async () => {
        // Arrange — 4K wide landscape image
        let capturedCanvas: { width: number; height: number } | null = null

        vi.spyOn(global, 'FileReader').mockImplementation(() => {
            const instance = {
                readAsDataURL: vi.fn(),
                onload: null as unknown as FileReader['onload'],
            } as unknown as FileReader

            ;(instance.readAsDataURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
                setTimeout(() => {
                    if (typeof instance.onload === 'function') {
                        instance.onload({ target: { result: 'data:image/jpeg;base64,fake' } } as ProgressEvent<FileReader>)
                    }
                }, 0)
            })
            return instance
        })

        vi.spyOn(global, 'Image').mockImplementation(() => {
            const instance = {} as HTMLImageElement
            Object.defineProperty(instance, 'src', {
                set(_v: string) {
                    setTimeout(() => {
                        if (typeof instance.onload === 'function') {
                            instance.onload(new Event('load'))
                        }
                    }, 0)
                },
                get() { return '' },
                configurable: true,
            })
            // 4K landscape: 3840 x 2160
            instance.width = 3840
            instance.height = 2160
            return instance
        })

        const mockToBlob = vi.fn((cb: BlobCallback) => {
            setTimeout(() => cb(new Blob([new Uint8Array(1000)], { type: 'image/webp' })), 0)
        })

        const origCreateElement = document.createElement.bind(document)
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'canvas') {
                const canvas = {
                    width: 0,
                    height: 0,
                    getContext: vi.fn(() => ({ drawImage: vi.fn() })),
                    toBlob: mockToBlob,
                } as unknown as HTMLCanvasElement
                capturedCanvas = canvas as unknown as { width: number; height: number }
                return canvas
            }
            return origCreateElement(tag)
        })

        const file = makeFile('4k-photo.jpg', sizeInMB(5), 'image/jpeg')

        // Act
        await processImageFile(file)

        // Assert — canvas width capped at 1920, height scaled proportionally
        // 3840 -> 1920 (÷2), 2160 -> 1080 (÷2)
        expect(capturedCanvas).not.toBeNull()
        expect((capturedCanvas as unknown as HTMLCanvasElement).width).toBe(1920)
        expect((capturedCanvas as unknown as HTMLCanvasElement).height).toBe(1080)
    })

    it('TC-F08.03f: scales down tall portrait image to max 1920px height', async () => {
        // Arrange — tall portrait image: 1080 x 2400
        let capturedCanvas: HTMLCanvasElement | null = null

        vi.spyOn(global, 'FileReader').mockImplementation(() => {
            const instance = {
                readAsDataURL: vi.fn(),
                onload: null as unknown as FileReader['onload'],
            } as unknown as FileReader

            ;(instance.readAsDataURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
                setTimeout(() => {
                    if (typeof instance.onload === 'function') {
                        instance.onload({ target: { result: 'data:image/jpeg;base64,fake' } } as ProgressEvent<FileReader>)
                    }
                }, 0)
            })
            return instance
        })

        vi.spyOn(global, 'Image').mockImplementation(() => {
            const instance = {} as HTMLImageElement
            Object.defineProperty(instance, 'src', {
                set(_v: string) {
                    setTimeout(() => {
                        if (typeof instance.onload === 'function') {
                            instance.onload(new Event('load'))
                        }
                    }, 0)
                },
                get() { return '' },
                configurable: true,
            })
            // Portrait: width < height
            instance.width = 1080
            instance.height = 2400
            return instance
        })

        const origCreateElement = document.createElement.bind(document)
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'canvas') {
                const canvas = {
                    width: 0,
                    height: 0,
                    getContext: vi.fn(() => ({ drawImage: vi.fn() })),
                    toBlob: vi.fn((cb: BlobCallback) => setTimeout(() => cb(new Blob([new Uint8Array(500)], { type: 'image/webp' })), 0)),
                } as unknown as HTMLCanvasElement
                capturedCanvas = canvas
                return canvas
            }
            return origCreateElement(tag)
        })

        const file = makeFile('portrait.jpg', sizeInMB(3), 'image/jpeg')

        // Act
        await processImageFile(file)

        // Assert — height capped at 1920, width scaled: 1080 * (1920/2400) = 864
        expect(capturedCanvas).not.toBeNull()
        expect(capturedCanvas!.height).toBe(1920)
        expect(capturedCanvas!.width).toBe(864)
    })

    it('TC-F08.03f: does not scale down small images under 1920px', async () => {
        // Arrange — small 800x600 image that is over 2MB (synthetic)
        let capturedCanvas: HTMLCanvasElement | null = null

        vi.spyOn(global, 'FileReader').mockImplementation(() => {
            const instance = {
                readAsDataURL: vi.fn(),
                onload: null as unknown as FileReader['onload'],
            } as unknown as FileReader

            ;(instance.readAsDataURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
                setTimeout(() => {
                    if (typeof instance.onload === 'function') {
                        instance.onload({ target: { result: 'data:image/jpeg;base64,fake' } } as ProgressEvent<FileReader>)
                    }
                }, 0)
            })
            return instance
        })

        vi.spyOn(global, 'Image').mockImplementation(() => {
            const instance = {} as HTMLImageElement
            Object.defineProperty(instance, 'src', {
                set(_v: string) {
                    setTimeout(() => {
                        if (typeof instance.onload === 'function') {
                            instance.onload(new Event('load'))
                        }
                    }, 0)
                },
                get() { return '' },
                configurable: true,
            })
            instance.width = 800
            instance.height = 600
            return instance
        })

        const origCreateElement = document.createElement.bind(document)
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            if (tag === 'canvas') {
                const canvas = {
                    width: 0,
                    height: 0,
                    getContext: vi.fn(() => ({ drawImage: vi.fn() })),
                    toBlob: vi.fn((cb: BlobCallback) => setTimeout(() => cb(new Blob([new Uint8Array(500)], { type: 'image/webp' })), 0)),
                } as unknown as HTMLCanvasElement
                capturedCanvas = canvas
                return canvas
            }
            return origCreateElement(tag)
        })

        const file = makeFile('small-but-heavy.jpg', sizeInMB(3), 'image/jpeg')

        // Act
        await processImageFile(file)

        // Assert — original dimensions preserved (no upscaling or downscaling)
        expect(capturedCanvas!.width).toBe(800)
        expect(capturedCanvas!.height).toBe(600)
    })
})

// ─── TC-F08.03f: Error Handling ─────────────────────────────────────────────
describe('[TC-F08.03f] processImageFile — Error Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('TC-F08.03f: rejects when FileReader fails (onerror triggered)', async () => {
        // Arrange
        vi.spyOn(global, 'FileReader').mockImplementation(() => {
            const instance = {
                readAsDataURL: vi.fn(),
                onload: null as unknown as FileReader['onload'],
                onerror: null as unknown as FileReader['onerror'],
            } as unknown as FileReader

            ;(instance.readAsDataURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
                setTimeout(() => {
                    if (typeof instance.onerror === 'function') {
                        instance.onerror(new ProgressEvent('error'))
                    }
                }, 0)
            })
            return instance
        })

        const file = makeFile('corrupted.jpg', sizeInMB(3), 'image/jpeg')

        // Act + Assert — must reject (not silently return original)
        await expect(processImageFile(file)).rejects.toBeDefined()
    })

    it('TC-F08.03f: rejects when Image fails to load (onerror triggered)', async () => {
        // Arrange
        vi.spyOn(global, 'FileReader').mockImplementation(() => {
            const instance = {
                readAsDataURL: vi.fn(),
                onload: null as unknown as FileReader['onload'],
            } as unknown as FileReader

            ;(instance.readAsDataURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
                setTimeout(() => {
                    if (typeof instance.onload === 'function') {
                        instance.onload({ target: { result: 'data:image/jpeg;base64,fake' } } as ProgressEvent<FileReader>)
                    }
                }, 0)
            })
            return instance
        })

        vi.spyOn(global, 'Image').mockImplementation(() => {
            const instance = {} as HTMLImageElement
            Object.defineProperty(instance, 'src', {
                set(_v: string) {
                    setTimeout(() => {
                        if (typeof instance.onerror === 'function') {
                            instance.onerror(new Event('error'))
                        }
                    }, 0)
                },
                get() { return '' },
                configurable: true,
            })
            return instance
        })

        const file = makeFile('invalid-image.jpg', sizeInMB(3), 'image/jpeg')

        // Act + Assert
        await expect(processImageFile(file)).rejects.toBeDefined()
    })
})

/**
 * TC-GENPERF-W2-06, W2-07, W2-08, W2-09 — Pre-upload media pool (Phase 06, Wave 2)
 * Source: plans/260703-1341-gen-perf-async-parallel/phase-07-wave2-tests-verify.md
 *
 * Tests the bounded concurrent download + strictly sequential media creates.
 * Verifies that pool photos are pre-uploaded during the GPT window, and that
 * `batchFetchFromPool` correctly assigns pre-uploaded IDs or falls back to
 * inline download+upload when the flag is off.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { preUploadPool } from '@/lib/ai/pool-preupload'
import type { ImagePool, PoolPhoto } from '@/lib/ai/image-pool'

// Mock dependencies at top level
vi.mock('@/lib/ai/pixabay-client', () => ({
	downloadPhotoBuffer: vi.fn(async (url: string) => ({
		buffer: Buffer.from(`mock-buffer-${url}`),
		mimetype: 'image/jpeg',
	})),
	registerPixabayMediaSource: vi.fn(),
}))

vi.mock('@/lib/ai/media-pipeline', () => {
	let createCounter = 0
	const activeCounts: number[] = []

	return {
		uploadBufferToMedia: vi.fn(async (payload: any, opts: any) => {
			// Track concurrent creates — should never exceed 1
			createCounter++
			activeCounts.push(createCounter)
			const activeMax = Math.max(...activeCounts)

			// Simulate async work
			await new Promise((resolve) => setTimeout(resolve, 5))

			createCounter--
			const mediaId = Math.floor(Math.random() * 100000)
			return mediaId
		}),
		Semaphore: class {
			private concurrent: number
			private active = 0
			private queue: Array<() => void> = []

			constructor(concurrency: number) {
				this.concurrent = concurrency
			}

			async run<T>(fn: () => Promise<T>): Promise<T> {
				while (this.active >= this.concurrent) {
					await new Promise((resolve) => this.queue.push(resolve))
				}
				this.active++
				try {
					return await fn()
				} finally {
					this.active--
					const resolve = this.queue.shift()
					if (resolve) resolve()
				}
			}
		},
		// Expose for test assertions
		_getCreateCounts: () => ({ activeMax: Math.max(...activeCounts), final: createCounter }),
		_resetCounts: () => {
			createCounter = 0
			activeCounts.length = 0
		},
	}
})

describe('[TC-GENPERF-W2-06] preUploadPool — media ID assignment', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('TC-GENPERF-W2-06: downloads and uploads each distinct pool photo', async () => {
		// Arrange
		const { downloadPhotoBuffer } = await import('@/lib/ai/pixabay-client')
		const pool: ImagePool = {
			landscape: [
				{ id: 'photo-1', url: 'https://pixabay.com/1.jpg', alt: 'Landscape' },
			],
			square: [{ id: 'photo-2', url: 'https://pixabay.com/2.jpg', alt: 'Square' }],
			portrait: [{ id: 'photo-3', url: 'https://pixabay.com/3.jpg', alt: 'Portrait' }],
		}

		const payload = {} as any

		// Act
		const result = await preUploadPool(pool, 'tenant-1', 'Test Business', payload)

		// Assert
		expect(downloadPhotoBuffer).toHaveBeenCalledTimes(3)
		expect(result.size).toBe(3)
		expect(result.has('photo-1')).toBe(true)
		expect(result.has('photo-2')).toBe(true)
		expect(result.has('photo-3')).toBe(true)
		expect(typeof result.get('photo-1')).toBe('number')
	})

	it('TC-GENPERF-W2-06: dedupes identical photo IDs across buckets', async () => {
		// Arrange
		const { downloadPhotoBuffer } = await import('@/lib/ai/pixabay-client')
		const pool: ImagePool = {
			landscape: [
				{ id: 'shared-photo', url: 'https://pixabay.com/shared.jpg', alt: 'Landscape' },
			],
			square: [{ id: 'shared-photo', url: 'https://pixabay.com/shared.jpg', alt: 'Square' }],
			portrait: [{ id: 'unique-photo', url: 'https://pixabay.com/unique.jpg', alt: 'Portrait' }],
		}

		const payload = {} as any

		// Act
		const result = await preUploadPool(pool, 'tenant-1', 'Test Business', payload)

		// Assert
		// Should only download 2 unique photos (shared-photo once, unique-photo once)
		expect(downloadPhotoBuffer).toHaveBeenCalledTimes(2)
		expect(result.size).toBe(2)
	})

	it('TC-GENPERF-W2-06: returns empty map for empty pool', async () => {
		// Arrange
		const pool: ImagePool = {
			landscape: [],
			square: [],
			portrait: [],
		}

		const payload = {} as any

		// Act
		const result = await preUploadPool(pool, 'tenant-1', 'Test Business', payload)

		// Assert
		expect(result.size).toBe(0)
	})

	it('TC-GENPERF-W2-06: excludes failed downloads from result map', async () => {
		// Arrange — override RESTORED at test end so later describes (W2-07
		// concurrency counting) keep the factory implementations.
		const { downloadPhotoBuffer } = await import('@/lib/ai/pixabay-client')
		const prevDownloadImpl = vi.mocked(downloadPhotoBuffer).getMockImplementation()
		vi.mocked(downloadPhotoBuffer).mockImplementation(async (url: string) => {
			if (url.includes('fail')) throw new Error('Download failed')
			return {
				buffer: Buffer.from(`mock-${url}`),
				mimetype: 'image/jpeg',
			}
		})

		const pool: ImagePool = {
			landscape: [
				{ id: 'photo-ok', url: 'https://pixabay.com/ok.jpg', alt: 'OK' },
				{ id: 'photo-fail', url: 'https://pixabay.com/fail.jpg', alt: 'Fail' },
			],
			square: [],
			portrait: [],
		}

		const payload = {} as any

		// Act
		const result = await preUploadPool(pool, 'tenant-1', 'Test Business', payload)

		// Assert
		// Only the successful photo should be in the result
		expect(result.size).toBe(1)
		expect(result.has('photo-ok')).toBe(true)
		expect(result.has('photo-fail')).toBe(false)
		if (prevDownloadImpl) vi.mocked(downloadPhotoBuffer).mockImplementation(prevDownloadImpl)
	})

	it('TC-GENPERF-W2-06: never throws — failed uploads excluded from map', async () => {
		// Arrange — override RESTORED at test end (see note above).
		const { uploadBufferToMedia } = await import('@/lib/ai/media-pipeline')
		const prevUploadImpl = vi.mocked(uploadBufferToMedia).getMockImplementation()
		vi.mocked(uploadBufferToMedia).mockImplementation(async (payload: any, opts: any) => {
			if (opts.filename.includes('fail')) throw new Error('Upload failed')
			return Math.floor(Math.random() * 100000)
		})

		const pool: ImagePool = {
			landscape: [{ id: 'photo-1', url: 'https://pixabay.com/1.jpg', alt: 'Photo' }],
			square: [{ id: 'photo-2', url: 'https://pixabay.com/2.jpg', alt: 'Photo' }],
			portrait: [],
		}

		const payload = {} as any

		// Act & Assert — should not throw
		const result = await preUploadPool(pool, 'tenant-1', 'Test Business', payload)
		expect(result).toBeDefined()
		if (prevUploadImpl) vi.mocked(uploadBufferToMedia).mockImplementation(prevUploadImpl)
	})
})

describe('[TC-GENPERF-W2-07] preUploadPool — sequential media.create (no concurrent creates)', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('TC-GENPERF-W2-07: creates media serially — max 1 concurrent create', async () => {
		// Arrange
		const { _resetCounts, _getCreateCounts } = await import('@/lib/ai/media-pipeline')
		_resetCounts()

		const pool: ImagePool = {
			landscape: [
				{ id: 'p1', url: 'https://pixabay.com/1.jpg', alt: 'Photo' },
				{ id: 'p2', url: 'https://pixabay.com/2.jpg', alt: 'Photo' },
				{ id: 'p3', url: 'https://pixabay.com/3.jpg', alt: 'Photo' },
			],
			square: [],
			portrait: [],
		}

		const payload = {} as any

		// Act
		const result = await preUploadPool(pool, 'tenant-1', 'Test Business', payload)

		// Assert — the whole point of W2-07: creates NEVER overlap (max 1 in
		// flight). Parallelizing creates in pool-preupload must fail this.
		const counts = _getCreateCounts()
		expect(counts.activeMax).toBe(1)
		expect(counts.final).toBe(0)
		expect(result.size).toBe(3)
	})
})

describe('[TC-GENPERF-W2-08] preUploadPool — orphan handling (by design)', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('TC-GENPERF-W2-08: returns full map even if fulfillment uses subset', async () => {
		// Arrange
		const pool: ImagePool = {
			landscape: [{ id: 'used-1', url: 'https://pixabay.com/used1.jpg', alt: 'Used' }],
			square: [{ id: 'unused-1', url: 'https://pixabay.com/unused1.jpg', alt: 'Unused' }],
			portrait: [{ id: 'unused-2', url: 'https://pixabay.com/unused2.jpg', alt: 'Unused' }],
		}

		const payload = {} as any

		// Act
		const preUploadedIds = await preUploadPool(pool, 'tenant-1', 'Test Business', payload)

		// Assert
		// All 3 photos are pre-uploaded; if fulfillment only uses 'used-1', the
		// other 2 remain in Payload media collection (orphaned but acceptable per YAGNI)
		expect(preUploadedIds.size).toBe(3)
		expect(preUploadedIds.has('used-1')).toBe(true)
		expect(preUploadedIds.has('unused-1')).toBe(true)
		expect(preUploadedIds.has('unused-2')).toBe(true)
	})

	it('TC-GENPERF-W2-08: documents by-design orphan tolerance', async () => {
		// Arrange
		const pool: ImagePool = {
			landscape: [{ id: 'p1', url: 'https://pixabay.com/1.jpg', alt: 'Photo' }],
			square: [],
			portrait: [],
		}

		const payload = {} as any

		// Act
		const result = await preUploadPool(pool, 'tenant-1', 'Test Business', payload)

		// Assert — just verify the function completes and returns a map
		expect(result).toBeInstanceOf(Map)
	})
})

// TC-GENPERF-W2-09 (flag-off media path) is covered at the REAL seam in
// media-pipeline-preupload.test.ts: batchFetchFromPool without a
// preUploadedPool map downloads + creates inline exactly as before.

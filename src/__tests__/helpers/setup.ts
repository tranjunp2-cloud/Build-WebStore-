import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.mock('@payload-config', () => ({ default: {} }))

// ResizeObserver is not implemented in jsdom — provide a no-op stub
if (typeof global.ResizeObserver === 'undefined') {
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
    }))
}

// IntersectionObserver is not implemented in jsdom — provide a no-op stub for framer-motion and the mascot.
// A plain class, not vi.fn(): a test's vi.restoreAllMocks() would wipe a mock implementation and leave
// `new IntersectionObserver()` without observe().
if (typeof global.IntersectionObserver === 'undefined') {
    global.IntersectionObserver = class {
        observe() {}
        disconnect() {}
        unobserve() {}
        takeRecords() { return [] }
    } as unknown as typeof IntersectionObserver
}

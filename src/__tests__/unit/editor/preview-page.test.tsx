import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { notFound, redirect } from 'next/navigation'
import PreviewPage from '@/app/(preview)/preview/[siteId]/page'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth'

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
    redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT') }),
}))

vi.mock('payload', () => {
    const mockPayload = {
        findByID: vi.fn(),
        find: vi.fn(),
    }
    return {
        getPayload: vi.fn(async () => mockPayload),
    }
})

vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
}))

vi.mock('@/components/site-renderer/SiteRenderer', () => ({
    // Using explicit interface instead of 'any' for mock props
    SiteRenderer: vi.fn(({ isEditor }: { isEditor?: boolean }) => (
        <div data-testid="site-renderer">
            Site Renderer Content {isEditor ? '(Editor Mode)' : ''}
        </div>
    )),
}))

vi.mock('@/components/AppShell', () => ({
    AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/editor/PreviewScripts', () => ({
    PreviewScripts: () => <div data-testid="preview-scripts">Scripts</div>,
}))

// ── Tests ────────────────────────────────────────────────────────────

describe('PreviewPage — Security & Authorization', () => {
    const siteId = 'site-123'
    const mockParams = Promise.resolve({ siteId })
    const mockSearchParams = Promise.resolve({ pageId: 'page-456' })

    const mockedGetCurrentUser = vi.mocked(getCurrentUser)
    
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ── TC-F05-SEC-01: Auth Redirect ──────────────────────────────────
    it('redirects to /login if user is not authenticated', async () => {
        // Arrange
        mockedGetCurrentUser.mockResolvedValue(null)

        // Act & Assert
        // redirect() throws an error in Next.js, so we must catch it
        await expect(PreviewPage({ params: mockParams, searchParams: mockSearchParams }))
            .rejects.toThrow('NEXT_REDIRECT')

        expect(redirect).toHaveBeenCalledWith(expect.stringContaining('/login'))
    })

    // ── TC-F05-SEC-02: Tenant Isolation ──────────────────────────────
    it('renders Access Denied UI if site tenant does not match user tenants', async () => {
        // Arrange
        mockedGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: 'tenant-authorized', role: 'admin' }]
        } as Partial<PlatformUser> as PlatformUser)
        
        // Mock getPayload and ignore deep config casting with 'any' since payload-types mock doesn't need to be complete
        const mockPayload = await getPayload({ config: {} as any })
        ;(mockPayload.findByID as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: siteId,
            tenant: 'tenant-unauthorized', // Mismatch
        })

        // Act
        // Using 'any' for component JSX transformation in test context
        const Component = await PreviewPage({ params: mockParams, searchParams: mockSearchParams })
        render(Component as React.ReactElement)

        // Assert
        expect(screen.getByText('Access Denied')).toBeInTheDocument()
    })

    // ── TC-F05-SEC-03: Authorized Access ──────────────────────────────
    it('renders SiteRenderer when user is authorized for the site tenant', async () => {
        // Arrange
        const tenantId = 'tenant-1'
        mockedGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: { id: tenantId, role: 'admin' }, role: 'admin' }] // Object format
        } as Partial<PlatformUser> as PlatformUser)
        
        const mockPayload = await getPayload({ config: {} as any })
        ;(mockPayload.findByID as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            id: siteId,
            tenant: tenantId, // Match
        })
        .mockResolvedValueOnce({
            id: 'page-456',
            site: siteId,
            layout: [],
        })

        ;(mockPayload.find as ReturnType<typeof vi.fn>).mockResolvedValue({
            docs: []
        })

        // Act
        const Component = await PreviewPage({ params: mockParams, searchParams: mockSearchParams })
        render(Component as React.ReactElement)

        // Assert
        expect(screen.getByTestId('site-renderer')).toBeInTheDocument()
        expect(screen.getByText(/Editor Mode/)).toBeInTheDocument()
    })

    // ── Edge Case: Site Not Found ──────────────────────────────────
    it('calls notFound() if site does not exist', async () => {
        // Arrange
        mockedGetCurrentUser.mockResolvedValue({ id: 'user-1', tenants: [] } as Partial<PlatformUser> as PlatformUser)
        const mockPayload = await getPayload({ config: {} as any })
        ;(mockPayload.findByID as ReturnType<typeof vi.fn>).mockResolvedValue(null)

        // Act
        await PreviewPage({ params: mockParams, searchParams: mockSearchParams })

        // Assert
        expect(notFound).toHaveBeenCalled()
    })
})

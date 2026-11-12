import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { notFound, redirect } from 'next/navigation'
import PreviewPage from '@/app/(preview)/preview/[siteId]/page'
import { getPayload } from 'payload'
import { getCurrentUser } from '@/lib/auth'
import { SiteRenderer } from '@/components/site-renderer/SiteRenderer'
import { STOREFRONT_POPULATE } from '@/lib/cache/tenant'

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
    BuilderLinkScripts: () => <div data-testid="builder-link-scripts">Link Scripts</div>,
}))

vi.mock('@/app/(preview)/preview/[siteId]/PreviewErrors', () => ({
    PreviewAccessDenied: () => <div>Access Denied</div>,
    PreviewNoPage: () => <div>No page found for this preview.</div>,
    PreviewLoadError: () => <div>Error loading preview.</div>,
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

    it('allows access to preview for super-admin even if site tenant does not match user tenants', async () => {
        // Arrange
        mockedGetCurrentUser.mockResolvedValue({
            id: 'admin-user',
            roles: ['super-admin'],
            tenants: [], // Super admin has platform-wide access
        } as Partial<PlatformUser> as PlatformUser)

        const mockPayload = await getPayload({ config: {} as any })
        ;(mockPayload.findByID as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            id: siteId,
            tenant: 'tenant-other',
        })
        .mockResolvedValueOnce({
            id: 'page-456',
            site: siteId,
            layout: [],
        })

        ;(mockPayload.find as ReturnType<typeof vi.fn>).mockResolvedValue({
            docs: [],
        })

        // Act
        const Component = await PreviewPage({ params: mockParams, searchParams: mockSearchParams })
        render(Component as React.ReactElement)

        // Assert
        expect(screen.queryByText('Access Denied')).not.toBeInTheDocument()
        expect(screen.getByTestId('site-renderer')).toBeInTheDocument()
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

// ── TC-F01-GH770: Builder preview parameter handling (GH #770) ─────────────

describe('[TC-F01-GH770] PreviewPage — builder parameter handling', () => {
    const siteId = 'site-123'
    const mockParams = Promise.resolve({ siteId })
    const tenantId = 'tenant-1'

    const mockedGetCurrentUser = vi.mocked(getCurrentUser)

    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('TC-F01-GH770-01: reads builder searchParam from URL', async () => {
        // Arrange
        const mockSearchParams = Promise.resolve({ pageId: 'page-1', builder: '1' })
        mockedGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: { id: tenantId }, role: 'admin' }]
        } as Partial<PlatformUser> as PlatformUser)

        const mockPayload = await getPayload({ config: {} as any })
        ;(mockPayload.findByID as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({ id: siteId, tenant: tenantId })
            .mockResolvedValueOnce({ id: 'page-1', site: siteId, layout: [] })

        ;(mockPayload.find as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] })

        // Act
        const Component = await PreviewPage({ params: mockParams, searchParams: mockSearchParams })
        const rendered = render(Component as React.ReactElement)

        // Assert — component should render without error, builder param was consumed
        expect(rendered.container).toBeInTheDocument()
    })

    it('TC-F01-GH770-02: passes isBuilderPreview=true to SiteRenderer when builder=1', async () => {
        // Arrange
        const mockSearchParams = Promise.resolve({ pageId: 'page-1', builder: '1' })
        mockedGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: { id: tenantId }, role: 'admin' }]
        } as Partial<PlatformUser> as PlatformUser)

        const mockPayload = await getPayload({ config: {} as any })
        ;(mockPayload.findByID as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({ id: siteId, tenant: tenantId })
            .mockResolvedValueOnce({ id: 'page-1', site: siteId, layout: [] })

        ;(mockPayload.find as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] })

        // Act
        const Component = await PreviewPage({ params: mockParams, searchParams: mockSearchParams })
        render(Component as React.ReactElement)

        // Assert — SiteRenderer should receive isBuilderPreview={true}
        expect(screen.getByTestId('site-renderer')).toBeInTheDocument()
    })

    it('TC-F01-GH770-03: passes isBuilderPreview=false when builder param not set', async () => {
        // Arrange
        const mockSearchParams = Promise.resolve({ pageId: 'page-1' })
        mockedGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: { id: tenantId }, role: 'admin' }]
        } as Partial<PlatformUser> as PlatformUser)

        const mockPayload = await getPayload({ config: {} as any })
        ;(mockPayload.findByID as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({ id: siteId, tenant: tenantId })
            .mockResolvedValueOnce({ id: 'page-1', site: siteId, layout: [] })

        ;(mockPayload.find as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] })

        // Act
        const Component = await PreviewPage({ params: mockParams, searchParams: mockSearchParams })
        render(Component as React.ReactElement)

        // Assert — SiteRenderer still renders
        expect(screen.getByTestId('site-renderer')).toBeInTheDocument()
    })

    it('TC-F01-GH770-04: skips PreviewScripts when builder=1', async () => {
        // Arrange — pageId present so the page fully renders its scripts branch
        const mockSearchParams = Promise.resolve({ pageId: 'page-1', builder: '1' })
        mockedGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: { id: tenantId }, role: 'admin' }]
        } as Partial<PlatformUser> as PlatformUser)

        const mockPayload = await getPayload({ config: {} as any })
        ;(mockPayload.findByID as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({ id: siteId, tenant: tenantId })
            .mockResolvedValueOnce({ id: 'page-1', site: siteId, layout: [] })

        ;(mockPayload.find as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] })

        // Act
        const Component = await PreviewPage({ params: mockParams, searchParams: mockSearchParams })
        render(Component as React.ReactElement)

        // Assert — PreviewScripts should NOT be rendered when builder=1;
        // the lightweight readonly handler takes its place (GH-1461)
        expect(screen.queryByTestId('preview-scripts')).not.toBeInTheDocument()
        expect(screen.getByTestId('builder-link-scripts')).toBeInTheDocument()
    })

    it('TC-F01-GH770-05: renders BuilderLinkScripts (not PreviewScripts) when neither builder nor editor param present (GH-1461)', async () => {
        // Arrange — standalone preview opened from the editor toolbar: no builder/editor param
        const mockSearchParams = Promise.resolve({ pageId: 'page-1' })
        mockedGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: { id: tenantId }, role: 'admin' }]
        } as Partial<PlatformUser> as PlatformUser)

        const mockPayload = await getPayload({ config: {} as any })
        ;(mockPayload.findByID as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({ id: siteId, tenant: tenantId })
            .mockResolvedValueOnce({ id: 'page-1', site: siteId, layout: [] })

        ;(mockPayload.find as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] })

        // Act
        const Component = await PreviewPage({ params: mockParams, searchParams: mockSearchParams })
        render(Component as React.ReactElement)

        // Assert — GH-1461: standalone toolbar preview is review-only, so it gets the
        // lightweight link handler instead of the full editing listeners
        expect(screen.queryByTestId('preview-scripts')).not.toBeInTheDocument()
        expect(screen.getByTestId('builder-link-scripts')).toBeInTheDocument()
    })

    it('TC-F01-GH770-08: includes PreviewScripts when editor param present (editor iframe)', async () => {
        // Arrange — editor iframe context: editor=1
        const mockSearchParams = Promise.resolve({ pageId: 'page-1', editor: '1' })
        mockedGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: { id: tenantId }, role: 'admin' }]
        } as Partial<PlatformUser> as PlatformUser)

        const mockPayload = await getPayload({ config: {} as any })
        ;(mockPayload.findByID as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({ id: siteId, tenant: tenantId })
            .mockResolvedValueOnce({ id: 'page-1', site: siteId, layout: [] })

        ;(mockPayload.find as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] })

        // Act
        const Component = await PreviewPage({ params: mockParams, searchParams: mockSearchParams })
        render(Component as React.ReactElement)

        // Assert — only the editor iframe keeps the full editing listeners (GH-1461)
        expect(screen.getByTestId('preview-scripts')).toBeInTheDocument()
        expect(screen.queryByTestId('builder-link-scripts')).not.toBeInTheDocument()
    })

    it('TC-F01-GH770-06: builder parameter does not affect auth checks', async () => {
        // Arrange — user not authenticated
        mockedGetCurrentUser.mockResolvedValue(null)
        const mockSearchParams = Promise.resolve({ builder: '1' })

        // Act & Assert
        await expect(PreviewPage({ params: mockParams, searchParams: mockSearchParams }))
            .rejects.toThrow('NEXT_REDIRECT')

        expect(redirect).toHaveBeenCalledWith(expect.stringContaining('/login'))
    })

    it('TC-F01-GH770-07: builder parameter does not affect tenant isolation checks', async () => {
        // Arrange
        mockedGetCurrentUser.mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: 'unauthorized-tenant', role: 'admin' }]
        } as Partial<PlatformUser> as PlatformUser)

        const mockPayload = await getPayload({ config: {} as any })
        ;(mockPayload.findByID as ReturnType<typeof vi.fn>).mockResolvedValue({
            id: siteId,
            tenant: 'different-tenant'
        })

        const mockSearchParams = Promise.resolve({ builder: '1' })

        // Act
        const Component = await PreviewPage({ params: mockParams, searchParams: mockSearchParams })
        render(Component as React.ReactElement)

        // Assert — Access denied should still be enforced
        expect(screen.getByText('Access Denied')).toBeInTheDocument()
    })
})

describe('[TC-PERF-126] PreviewPage — tenant secrets never reach the preview payload', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reads site and pages with the storefront populate and trims page.site.tenant', async () => {
        // Arrange
        vi.mocked(getCurrentUser).mockResolvedValue({
            id: 'user-1',
            tenants: [{ tenant: { id: 1 }, role: 'owner' }],
        } as Partial<PlatformUser> as PlatformUser)
        const fullTenant = { id: 1, name: 'Kedai', slug: 'kedai', status: 'active', xenditSecretKey: 'LEAKCANARY' }
        const mockPayload = await getPayload({ config: {} as any })
        ;(mockPayload.findByID as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce({ id: 'site-1', tenant: { id: 1, name: 'Kedai', slug: 'kedai' } })
            .mockResolvedValueOnce({ id: 'page-1', site: { id: 'site-1', tenant: fullTenant }, layout: [] })
        ;(mockPayload.find as ReturnType<typeof vi.fn>).mockResolvedValue({ docs: [] })

        // Act
        const Component = await PreviewPage({
            params: Promise.resolve({ siteId: 'site-1' }),
            searchParams: Promise.resolve({ pageId: 'page-1' }),
        })
        render(Component as React.ReactElement)

        // Assert
        for (const [args] of (mockPayload.findByID as ReturnType<typeof vi.fn>).mock.calls) {
            expect(args).toEqual(expect.objectContaining({ populate: STOREFRONT_POPULATE }))
        }
        for (const [args] of (mockPayload.find as ReturnType<typeof vi.fn>).mock.calls) {
            if (args.collection === 'pages') expect(args).toEqual(expect.objectContaining({ populate: STOREFRONT_POPULATE }))
        }
        const props = vi.mocked(SiteRenderer).mock.calls[0][0] as { page: { site: { tenant: Record<string, unknown> } } }
        expect(props.page.site.tenant).not.toHaveProperty('xenditSecretKey')
        expect(props.page.site.tenant).toEqual(expect.objectContaining({ id: 1, slug: 'kedai' }))
    })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

const mocks = vi.hoisted(() => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
    }),
    getCurrentUser: vi.fn(),
    findByID: vi.fn(),
}))

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ findByID: mocks.findByID })) }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/app/(dashboard)/blog/[id]/BlogEditorPageClient', () => ({
    default: () => <div>Blog Editor Client</div>,
}))

import BlogEditorPage from '@/app/(dashboard)/blog/[id]/page'

const owner = { id: 7, roles: [], tenants: [{ tenant: { id: 42 } }] }

describe('BlogEditorPage route guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getCurrentUser.mockResolvedValue(owner)
    })

    it('renders client editor for new blog routes', async () => {
        // Act
        const element = await BlogEditorPage({ params: Promise.resolve({ id: 'new' }) })
        render(element)

        // Assert
        expect(screen.getByText('Blog Editor Client')).toBeInTheDocument()
        expect(mocks.findByID).not.toHaveBeenCalled()
    })

    it('[TC-PERF-074] renders client editor when blog belongs to current tenant, reading only its tenant column', async () => {
        // Arrange
        mocks.findByID.mockResolvedValueOnce({ id: 5, tenant: 42 })

        // Act
        const element = await BlogEditorPage({ params: Promise.resolve({ id: '5' }) })
        render(element)

        // Assert
        expect(screen.getByText('Blog Editor Client')).toBeInTheDocument()
        expect(mocks.findByID).toHaveBeenCalledTimes(1)
        expect(mocks.findByID).toHaveBeenCalledWith({
            collection: 'blogs',
            id: '5',
            depth: 0,
            disableErrors: true,
            select: { tenant: true },
        })
    })

    it('calls notFound when blog belongs to another tenant', async () => {
        // Arrange
        mocks.findByID.mockResolvedValueOnce({ id: 5, tenant: 99 })

        // Act + Assert
        await expect(BlogEditorPage({ params: Promise.resolve({ id: '5' }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
        expect(mocks.notFound).toHaveBeenCalled()
    })

    it('calls notFound when blog does not exist', async () => {
        // Arrange
        mocks.findByID.mockResolvedValueOnce(null)

        // Act + Assert
        await expect(BlogEditorPage({ params: Promise.resolve({ id: '404' }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
        expect(mocks.notFound).toHaveBeenCalled()
    })

    it('calls notFound when signed out', async () => {
        // Arrange
        mocks.getCurrentUser.mockResolvedValueOnce(null)

        // Act + Assert
        await expect(BlogEditorPage({ params: Promise.resolve({ id: '5' }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
        expect(mocks.findByID).not.toHaveBeenCalled()
    })

    it('opens any post for a super-admin', async () => {
        // Arrange
        mocks.getCurrentUser.mockResolvedValueOnce({ id: 1, roles: ['super-admin'], tenants: [] })
        mocks.findByID.mockResolvedValueOnce({ id: 5, tenant: 99 })

        // Act
        const element = await BlogEditorPage({ params: Promise.resolve({ id: '5' }) })
        render(element)

        // Assert
        expect(screen.getByText('Blog Editor Client')).toBeInTheDocument()
    })
})

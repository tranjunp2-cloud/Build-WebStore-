import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

const { mockNotFound } = vi.hoisted(() => ({
    mockNotFound: vi.fn(() => {
        throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
    }),
}))

vi.mock('next/navigation', () => ({
    notFound: mockNotFound,
}))

vi.mock('@/app/(dashboard)/blog/actions', () => ({
    getBlogByIdAction: vi.fn(),
}))

vi.mock('@/app/(dashboard)/blog/[id]/BlogEditorPageClient', () => ({
    default: () => <div>Blog Editor Client</div>,
}))

import BlogEditorPage from '@/app/(dashboard)/blog/[id]/page'
import * as actions from '@/app/(dashboard)/blog/actions'

describe('BlogEditorPage route guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders client editor for new blog routes', async () => {
        const element = await BlogEditorPage({ params: Promise.resolve({ id: 'new' }) })
        render(element)

        expect(screen.getByText('Blog Editor Client')).toBeInTheDocument()
        expect(actions.getBlogByIdAction).not.toHaveBeenCalled()
    })

    it('renders client editor when blog belongs to current tenant', async () => {
        vi.mocked(actions.getBlogByIdAction).mockResolvedValueOnce({ id: 'blog-1' } as any)

        const element = await BlogEditorPage({ params: Promise.resolve({ id: 'blog-1' }) })
        render(element)

        expect(screen.getByText('Blog Editor Client')).toBeInTheDocument()
        expect(actions.getBlogByIdAction).toHaveBeenCalledWith('blog-1')
    })

    it('calls notFound when blog belongs to another tenant', async () => {
        vi.mocked(actions.getBlogByIdAction).mockRejectedValueOnce(new Error('Unauthorized access'))

        await expect(BlogEditorPage({ params: Promise.resolve({ id: 'blog-1' }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
        expect(mockNotFound).toHaveBeenCalled()
    })

    it('calls notFound when blog does not exist', async () => {
        vi.mocked(actions.getBlogByIdAction).mockRejectedValueOnce(new Error('Blog not found'))

        await expect(BlogEditorPage({ params: Promise.resolve({ id: 'missing-blog' }) })).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
        expect(mockNotFound).toHaveBeenCalled()
    })
})

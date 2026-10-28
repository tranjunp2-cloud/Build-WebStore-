/**
 * TC-F17-AI-02 — which AI change takes over the blog editor, and what it shows there.
 */
import { describe, expect, it } from 'vitest'
import type { AgentChatTurn, ChangeSet } from '@ech/agent-core'
import { blogAiPreview, createdPostId, isForEditor, isStaleChange, promptFor, waitingDraft } from '@/app/(dashboard)/blog/_components/ai/blog-ai-draft'

const cs = (id: string, kind: string, payload: unknown, status: ChangeSet['status'] = 'pending', extra: Partial<ChangeSet> = {}) =>
    ({ id, status, action: { kind, payload }, ...extra }) as unknown as ChangeSet
const turns = (...sets: ChangeSet[]): AgentChatTurn[] => [
    { id: 'u1', role: 'user', text: 'Tạo 1 bài blog về ngành thực phẩm' },
    { id: 'r1', role: 'assistant', run: undefined, changeSets: sets },
]

const draft = cs('cs_new', 'blog.create_draft', {
    title: 'Ngành thực phẩm 2026',
    slug: 'nganh-thuc-pham-2026',
    contentHtml: '<h2>1. Nhãn</h2><p>…</p>',
    seoTitle: '5 xu hướng thực phẩm',
    seoDescription: 'Người mua đọc nhãn kỹ hơn.',
    cover: { url: 'https://images.example.com/market.jpg' },
})
const edit = cs('cs_edit', 'blog.update', { id: '42', base: 3, changes: { contentHtml: '<p>Mới</p>', seoTitle: 'Batik' } })

describe('blog editor AI draft [TC-F17-AI-02]', () => {
    it('a new post takes new drafts; a saved post only its own edits', () => {
        expect(isForEditor(draft, 'new')).toBe(true)
        expect(isForEditor(edit, 'new')).toBe(false)
        expect(isForEditor(edit, '42')).toBe(true)
        expect(isForEditor(edit, '7')).toBe(false)
        expect(isForEditor(draft, '42')).toBe(false)
    })

    it('takes only the newest change for this post; a newer decided one supersedes older pending ones', () => {
        const older = cs('cs_old', 'blog.update', { id: '9', changes: { contentHtml: '<p>intro</p>' } })
        const newer = cs('cs_new2', 'blog.update', { id: '9', changes: { title: 'T' } })
        expect(waitingDraft(turns(older, newer), '9')?.id).toBe('cs_new2')
        // the newer edit was applied (auto-approve): the older one was drafted from a version that no longer exists
        const applied = cs('cs_new2', 'blog.update', { id: '9', changes: { title: 'T' } }, 'applied')
        expect(waitingDraft(turns(older, applied), '9')).toBeUndefined()
        // another post's change does not hide this post's draft
        expect(waitingDraft(turns(older, cs('cs_other', 'blog.update', { id: '7', changes: {} }, 'applied')), '9')?.id).toBe('cs_old')
    })

    it('knows a stale change (409) and the message it answered', () => {
        expect(isStaleChange(Object.assign(new Error('This changed after the assistant drafted the edit.'), { status: 409 }))).toBe(true)
        expect(isStaleChange(Object.assign(new Error('boom'), { status: 500 }))).toBe(false)
        expect(isStaleChange(null)).toBe(false)
        expect(promptFor(turns(draft), 'cs_new')).toBe('Tạo 1 bài blog về ngành thực phẩm')
        expect(promptFor(turns(draft), 'missing')).toBeUndefined()
    })

    it('shows a new draft field by field, cover included', () => {
        expect(blogAiPreview(draft)).toEqual({
            changeSetId: 'cs_new',
            kind: 'create',
            title: 'Ngành thực phẩm 2026',
            slug: 'nganh-thuc-pham-2026',
            contentHtml: '<h2>1. Nhãn</h2><p>…</p>',
            seoTitle: '5 xu hướng thực phẩm',
            seoDescription: 'Người mua đọc nhãn kỹ hơn.',
            coverUrl: 'https://images.example.com/market.jpg',
            fields: ['title', 'content', 'cover', 'seo'],
        })
    })

    it('shows only what an edit changes', () => {
        expect(blogAiPreview(edit)).toEqual({ changeSetId: 'cs_edit', kind: 'update', contentHtml: '<p>Mới</p>', seoTitle: 'Batik', fields: ['content', 'seo'] })
        expect(blogAiPreview(cs('cs_p', 'product.update', {}))).toBeNull()
    })

    it('finds the post an approved draft became', () => {
        const applied = cs('cs_new', 'blog.create_draft', {}, 'applied', { result: { entities: [{ kind: 'blog_post', id: 77, label: 'x' }], links: [] } } as Partial<ChangeSet>)
        expect(createdPostId(applied)).toBe('77')
        expect(createdPostId(draft)).toBeNull()
    })
})

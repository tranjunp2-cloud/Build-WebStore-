import type { AgentChatTurn, ChangeSet } from '@ech/agent-core'

/** Parts of the post an AI change can fill — each is marked on its own in the editor. */
export type BlogAiField = 'title' | 'content' | 'cover' | 'seo'

/** What the editor shows while an AI change waits: the new values, field by field. */
export interface BlogAiPreview {
    changeSetId: string
    kind: 'create' | 'update'
    title?: string
    /** the server's slug for a new draft (keeps Vietnamese/Malay words readable) */
    slug?: string
    contentHtml?: string
    seoTitle?: string
    seoDescription?: string
    coverUrl?: string
    fields: BlogAiField[]
}

type CreatePayload = { title?: string; slug?: string; contentHtml?: string; seoTitle?: string; seoDescription?: string; cover?: { url?: string } }
type UpdatePayload = { id?: string | number; changes?: { title?: string; contentHtml?: string; seoTitle?: string; seoDescription?: string; cover?: { url?: string } } }

/** Is this change for the post open in the editor? A new (unsaved) post takes new drafts; a saved one its own edits. */
export function isForEditor(changeSet: ChangeSet, blogId: string): boolean {
    const kind = changeSet.action?.kind
    if (blogId === 'new') return kind === 'blog.create_draft'
    return kind === 'blog.update' && String((changeSet.action?.payload as UpdatePayload | undefined)?.id ?? '') === blogId
}

/**
 * The AI change of *this* chat waiting for the post in the editor: only the
 * newest change for this post counts. Once it is decided (applied, rejected)
 * any older one still "pending" was drafted from an earlier version — it is
 * superseded and never comes back into the form (keeping it would fail with
 * "changed after the assistant drafted the edit"). A draft from another chat
 * or for another post never takes over the form.
 */
export function waitingDraft(turns: readonly AgentChatTurn[], blogId: string): ChangeSet | undefined {
    for (let i = turns.length - 1; i >= 0; i -= 1) {
        const turn = turns[i]
        if (turn?.role !== 'assistant') continue
        for (let j = turn.changeSets.length - 1; j >= 0; j -= 1) {
            const changeSet = turn.changeSets[j]
            if (changeSet && isForEditor(changeSet, blogId)) return changeSet.status === 'pending' ? changeSet : undefined
        }
    }
    return undefined
}

/** The merchant's message a change answered — sent again when the change went stale. */
export function promptFor(turns: readonly AgentChatTurn[], changeSetId: string): string | undefined {
    const at = turns.findIndex((turn) => turn.role === 'assistant' && turn.changeSets.some((c) => c.id === changeSetId))
    for (let i = at - 1; i >= 0; i -= 1) {
        const turn = turns[i]
        if (turn?.role === 'user') return turn.text
    }
    return undefined
}

/** The server refused a change because the post moved on since it was drafted (version guard, 409). */
export function isStaleChange(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 409
}

/** The values an AI change would put in the editor, or null when it is not a blog change. */
export function blogAiPreview(changeSet: ChangeSet): BlogAiPreview | null {
    const kind = changeSet.action?.kind
    if (kind === 'blog.create_draft') {
        const p = (changeSet.action?.payload ?? {}) as CreatePayload
        const fields: BlogAiField[] = []
        if (p.title) fields.push('title')
        if (p.contentHtml) fields.push('content')
        if (p.cover?.url) fields.push('cover')
        if (p.seoTitle || p.seoDescription) fields.push('seo')
        return {
            changeSetId: changeSet.id,
            kind: 'create',
            ...(p.title ? { title: p.title } : {}),
            ...(p.slug ? { slug: p.slug } : {}),
            ...(p.contentHtml ? { contentHtml: p.contentHtml } : {}),
            ...(p.seoTitle ? { seoTitle: p.seoTitle } : {}),
            ...(p.seoDescription ? { seoDescription: p.seoDescription } : {}),
            ...(p.cover?.url ? { coverUrl: p.cover.url } : {}),
            fields,
        }
    }
    if (kind === 'blog.update') {
        const c = ((changeSet.action?.payload ?? {}) as UpdatePayload).changes ?? {}
        const fields: BlogAiField[] = []
        if (c.title !== undefined) fields.push('title')
        if (c.contentHtml !== undefined) fields.push('content')
        if (c.cover?.url) fields.push('cover')
        if (c.seoTitle !== undefined || c.seoDescription !== undefined) fields.push('seo')
        return {
            changeSetId: changeSet.id,
            kind: 'update',
            ...(c.title !== undefined ? { title: c.title } : {}),
            ...(c.contentHtml !== undefined ? { contentHtml: c.contentHtml } : {}),
            ...(c.seoTitle !== undefined ? { seoTitle: c.seoTitle } : {}),
            ...(c.seoDescription !== undefined ? { seoDescription: c.seoDescription } : {}),
            ...(c.cover?.url ? { coverUrl: c.cover.url } : {}),
            fields,
        }
    }
    return null
}

/** The post a new draft became once approved (its id from the applied result). */
export function createdPostId(changeSet: ChangeSet): string | null {
    const entity = changeSet.result?.entities?.find((e) => e.kind === 'blog_post')
    return entity ? String(entity.id) : null
}

/** sessionStorage handoff: the new post's editor marks what AI wrote after the redirect. */
export const appliedKey = (postId: string) => `blog-ai-applied:${postId}`

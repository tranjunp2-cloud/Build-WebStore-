'use client'

/**
 * IssueCommentThread — append-only comment list + input form.
 * Optimistic UI: new comment shown immediately, reverted on error.
 */
import { useState } from 'react'
import type { IssueComment } from './issue-types'
import { IssueMarkdown } from './issue-markdown'

function authorLabel(authorId: IssueComment['authorId']): string {
    if (!authorId) return 'Unknown'
    if (typeof authorId === 'number') return `User #${authorId}`
    return authorId.email ?? `User #${authorId.id}`
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

type Props = {
    issueId: number
    comments: IssueComment[]
    onCommentAdded?: (updated: IssueComment[]) => void
}

export function IssueCommentThread({ issueId, comments, onCommentAdded }: Props) {
    const [list, setList] = useState<IssueComment[]>(comments)
    const [body, setBody] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!body.trim()) return

        // Optimistic insert
        const optimistic: IssueComment = {
            id: `opt-${Date.now()}`,
            authorId: null,
            body: body.trim(),
            createdAt: new Date().toISOString(),
        }
        setList((prev) => [...prev, optimistic])
        setBody('')
        setSubmitting(true)
        setError(null)

        try {
            const res = await fetch(`/api/admin/issues/${issueId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: optimistic.body }),
            })
            if (!res.ok) {
                const json = await res.json().catch(() => ({})) as { error?: string }
                throw new Error(json.error ?? 'Comment failed')
            }
            const json = await res.json() as { data?: { comments?: IssueComment[] } }
            const updated = json.data?.comments ?? list
            setList(updated)
            onCommentAdded?.(updated)
        } catch (err) {
            // Revert optimistic insert
            setList((prev) => prev.filter((c) => c.id !== optimistic.id))
            setBody(optimistic.body)
            setError(err instanceof Error ? err.message : 'Submit failed')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '16px 0' }}>
                    No comments yet.
                </p>
            )}

            {list.map((c) => (
                <div
                    key={c.id}
                    style={{
                        background: 'var(--bg-sunk)',
                        borderRadius: 6,
                        padding: '10px 12px',
                        fontSize: 13,
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 12 }}>
                            {authorLabel(c.authorId)}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            {relativeTime(c.createdAt)}
                        </span>
                    </div>
                    <IssueMarkdown content={c.body} />
                </div>
            ))}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Add a comment… (markdown supported)"
                    rows={3}
                    style={{
                        width: '100%',
                        resize: 'vertical',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        padding: '8px 10px',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box',
                    }}
                />
                {error && <p style={{ fontSize: 12, color: 'var(--danger, #ef4444)' }}>{error}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="submit"
                        disabled={submitting || !body.trim()}
                        style={{
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-sm, 4px)',
                            background: 'var(--accent)',
                            color: '#fff',
                            fontSize: 13,
                            border: 'none',
                            cursor: submitting || !body.trim() ? 'not-allowed' : 'pointer',
                            opacity: submitting || !body.trim() ? 0.6 : 1,
                        }}
                    >
                        {submitting ? 'Posting…' : 'Post comment'}
                    </button>
                </div>
            </form>
        </div>
    )
}

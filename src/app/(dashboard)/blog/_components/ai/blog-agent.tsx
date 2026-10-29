'use client'

import '@ech/agent-ui/styles.css'
import type { AgentThread, ChangeSet } from '@ech/agent-core'
import { AgentProvider, useChangeSets, useDecideChangeSet, useUndoChangeSet } from '@ech/agent-react'
import { sessionThreadHint, useAgentChatRuntime } from '@ech/agent-react/chat'
import { AgentAssistantPanel } from '@ech/agent-ui'
import { useRouter } from 'next/navigation'
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { agentPanelLabels } from '@/components/agent/agent-panel-labels'
import { agentStarters } from '@/components/agent/agent-starters'
import { createAgentGateway } from '@/lib/agent-changes/agent-gateway'
import { useI18n } from '@/i18n'
import { isForEditor, promptFor, waitingDraft } from './blog-ai-draft'

/** What the editor does when an AI change for this post is approved (registered by the editor). */
export interface BlogAgentHandlers {
    /** a new draft was approved and saved as a post */
    onCreated?: (changeSet: ChangeSet) => void
    /** an edit of this post was approved and written */
    onUpdated?: (changeSet: ChangeSet) => void
    /** an applied edit of this post was undone */
    onReverted?: (changeSet: ChangeSet) => void
}

interface BlogAgentValue {
    enabled: boolean
    /** the newest AI change of this chat waiting for the post in the editor */
    draft: ChangeSet | undefined
    /** the chat is working (writing, searching photos) */
    busy: boolean
    decide: (changeSet: ChangeSet, decision: 'approve' | 'reject') => Promise<ChangeSet>
    undo: ((changeSet: ChangeSet) => Promise<ChangeSet>) | undefined
    /** a change went stale (the post moved on): ask for it again on the latest version */
    askAgainFor: (changeSetId: string) => void
    /** the open chat (carried over to the new post's editor after a draft is saved) */
    threadId: string | undefined
    setHandlers: (handlers: BlogAgentHandlers) => void
    panel: ReactNode
}

const BlogAgentContext = createContext<BlogAgentValue | null>(null)

/** Blog chats only: what the panel lists and reopens (never the dashboard's latest product chat). */
const blogChats = (thread: AgentThread) => thread.domain === 'cms' || thread.module === 'blog'

/** The chat a post's editor keeps per tab: reload reopens it, a new draft's post continues it. */
export const blogThreadKey = (blogId: string) => `ech-agent:thread:blog:${blogId}`

function BlogAgentState({ blogId, children }: { blogId: string; children: ReactNode }) {
    const router = useRouter()
    const { locale } = useI18n()
    const isNew = blogId === 'new'
    // the post always rides along unseen (no chip to remove)
    const pin = useMemo(() => ({ module: 'blog', ...(isNew ? {} : { entity: { kind: 'blog_post' as const, id: blogId } }) }), [blogId, isNew])
    const hint = useMemo(() => sessionThreadHint(blogThreadKey(blogId)), [blogId])
    const chat = useAgentChatRuntime({ context: pin, hint, restoreLatest: false, scope: blogChats })
    const allPending = useChangeSets({ status: 'pending' })
    const decideChangeSet = useDecideChangeSet()
    const undoChangeSet = useUndoChangeSet()
    const handlers = useRef<BlogAgentHandlers>({})
    const setHandlers = useCallback((next: BlogAgentHandlers) => {
        handlers.current = next
    }, [])

    // Approving from the chat card, the review sheet or the editor's bar all land here (the bar is a hand click;
    // the panel says itself whether Auto-approve or the merchant decided).
    const decide = useCallback(
        async (changeSet: ChangeSet, decision: 'approve' | 'reject', options: { confirm?: string; manual?: boolean } = { manual: true }) => {
            const decided = await decideChangeSet(changeSet.id, decision, 'self', undefined, { confirm: options.confirm, manual: options.manual })
            allPending.refresh()
            if (decided.status === 'applied') {
                if (decided.action?.kind === 'blog.create_draft') handlers.current.onCreated?.(decided)
                else if (decided.action?.kind === 'blog.update') handlers.current.onUpdated?.(decided)
            }
            return decided
        },
        [decideChangeSet, allPending],
    )
    const undo = useMemo(
        () =>
            undoChangeSet
                ? async (changeSet: ChangeSet) => {
                      const reverted = await undoChangeSet(changeSet.id)
                      if (changeSet.action?.kind === 'blog.update') handlers.current.onReverted?.(changeSet)
                      return reverted
                  }
                : undefined,
        [undoChangeSet],
    )

    const draft = useMemo(() => waitingDraft(chat.turns, blogId), [chat.turns, blogId])
    // drafts to review here: this post's edits; for a new post only this chat's drafts (not every old one)
    const pending = useMemo(() => {
        const inChat = new Set(chat.turns.flatMap((turn) => (turn.role === 'assistant' ? turn.changeSets.map((c) => c.id) : [])))
        return (allPending.data ?? []).filter((c) => isForEditor(c, blogId) && (!isNew || inChat.has(c.id)))
    }, [allPending.data, blogId, isNew, chat.turns])
    const labels = agentPanelLabels(locale)
    const panel = (
        <AgentAssistantPanel
            placement="inline"
            chat={chat}
            pageLabel={(isNew ? THIS_NEW_POST : THIS_POST)[locale.slice(0, 2)] ?? (isNew ? THIS_NEW_POST.en : THIS_POST.en)}
            pending={pending}
            onDecide={(changeSet, decision, options) => decide(changeSet, decision, options ?? {})}
            onUndo={undo}
            onNavigate={(href) => router.push(href)}
            suggestions={agentStarters('blog', locale)}
            labels={labels}
            locale={locale}
        />
    )
    const value: BlogAgentValue = {
        enabled: true,
        draft,
        busy: chat.busy,
        decide,
        undo,
        askAgainFor: (changeSetId) => {
            const prompt = promptFor(chat.turns, changeSetId)
            if (prompt) void chat.send(prompt)
        },
        threadId: chat.history?.threadId,
        setHandlers,
        panel,
    }
    return <BlogAgentContext.Provider value={value}>{children}</BlogAgentContext.Provider>
}

const THIS_POST: Record<string, string> = { en: 'This post', ms: 'Catatan ini', vi: 'Bài này' }
const THIS_NEW_POST: Record<string, string> = { en: 'This new post', ms: 'Catatan baharu ini', vi: 'Bài mới này' }

const OFF: BlogAgentValue = {
    enabled: false,
    draft: undefined,
    busy: false,
    decide: async (changeSet) => changeSet,
    undo: undefined,
    askAgainFor: () => undefined,
    threadId: undefined,
    setHandlers: () => undefined,
    panel: null,
}

/**
 * The blog editor's copilot: one chat per post (kept per tab), the post pinned
 * as its context, and every approval routed back to the editor so the form
 * shows what the server wrote. With the agent off the editor works without it.
 */
export function BlogAgentProvider({ blogId, enabled, children }: { blogId: string; enabled: boolean; children: ReactNode }) {
    const [gateway] = useState(createAgentGateway)
    if (!enabled) return <BlogAgentContext.Provider value={OFF}>{children}</BlogAgentContext.Provider>
    return (
        <AgentProvider gateway={gateway}>
            <BlogAgentState blogId={blogId}>{children}</BlogAgentState>
        </AgentProvider>
    )
}

export function useBlogAgent(): BlogAgentValue {
    return useContext(BlogAgentContext) ?? OFF
}

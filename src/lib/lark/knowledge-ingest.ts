/**
 * Lark Bot — Knowledge Ingestion Pipeline
 *
 * Auto-populates BotKnowledge collection from:
 * 1. GitHub commits (code changes — who, what, when)
 * 2. GitHub PRs (feature decisions — why, context, discussion)
 * 3. Conversation insights (key learnings from team Q&A)
 * 4. Manual entries (team notes via Lark command)
 *
 * Uses Payload Local API (no HTTP overhead, runs in same process)
 */
import { getPayload } from 'payload'
import config from '@payload-config'

// ─── Types ───────────────────────────────────────────────────────────────

interface KnowledgeEntry {
    title: string
    content: string
    category: string
    source: string
    sourceUrl?: string
    sourceId?: string
    author?: string
    relatedFiles?: Array<{ path: string }>
    tags?: Array<{ tag: string }>
    branch?: string
    importance?: string
}

// ─── Core Ingestion ──────────────────────────────────────────────────────

/**
 * Store a knowledge entry in Payload CMS
 * Deduplicates by sourceId to prevent duplicates from retried webhooks
 */
export async function ingestKnowledge(entry: KnowledgeEntry): Promise<void> {
    try {
        const payload = await getPayload({ config })

        // Deduplicate: check if entry with same sourceId already exists
        if (entry.sourceId) {
            const existing = await payload.find({
                collection: 'bot-knowledge',
                where: { sourceId: { equals: entry.sourceId } },
                limit: 1,
            })

            if (existing.docs.length > 0) {
                console.log(`[Knowledge] Skip duplicate: ${entry.sourceId}`)
                return
            }
        }

        await payload.create({
            collection: 'bot-knowledge',
            data: entry,
        })

        console.log(`[Knowledge] Ingested: ${entry.title}`)
    } catch (error) {
        console.error('[Knowledge] Ingest error:', error)
    }
}

// ─── GitHub Commit Ingestion ─────────────────────────────────────────────

interface GitHubCommitPayload {
    sha: string
    message: string
    author: string
    branch: string
    url: string
    files?: string[]
    additions?: number
    deletions?: number
}

/**
 * Ingest a GitHub commit as knowledge
 * Called from GitHub webhook handler
 */
export async function ingestCommit(commit: GitHubCommitPayload): Promise<void> {
    const firstLine = commit.message.split('\n')[0]
    const body = commit.message.split('\n').slice(1).join('\n').trim()

    // Determine category from conventional commit type
    let category = 'code_change'
    let importance = 'normal'

    if (firstLine.startsWith('feat')) {
        category = 'feature'
        importance = 'important'
    } else if (firstLine.startsWith('fix')) {
        category = 'bug_fix'
    } else if (firstLine.startsWith('refactor') || firstLine.startsWith('perf')) {
        category = 'architecture'
    } else if (firstLine.startsWith('ci') || firstLine.startsWith('chore')) {
        category = 'deployment'
        importance = 'low'
    }

    // Extract tags from file paths
    const tags = extractTagsFromFiles(commit.files || [])

    const content = [
        `Commit: ${firstLine}`,
        body ? `\nDetail: ${body}` : '',
        `\nBranch: ${commit.branch}`,
        `Author: ${commit.author}`,
        commit.additions !== undefined ? `Changes: +${commit.additions} / -${commit.deletions}` : '',
        commit.files?.length ? `\nFiles changed:\n${commit.files.map(f => `  - ${f}`).join('\n')}` : '',
    ].filter(Boolean).join('\n')

    await ingestKnowledge({
        title: firstLine,
        content,
        category,
        source: 'github_commit',
        sourceUrl: commit.url,
        sourceId: `commit:${commit.sha}`,
        author: commit.author,
        relatedFiles: commit.files?.map(path => ({ path })),
        tags,
        branch: commit.branch,
        importance,
    })
}

// ─── GitHub PR Ingestion ─────────────────────────────────────────────────

interface GitHubPRPayload {
    number: number
    title: string
    body: string | null
    author: string
    branch: string
    baseBranch: string
    url: string
    files?: string[]
    additions?: number
    deletions?: number
    merged: boolean
    mergedBy?: string
}

/**
 * Ingest a GitHub PR as knowledge
 * This captures the "WHY" — PR descriptions explain decisions and context
 */
export async function ingestPR(pr: GitHubPRPayload): Promise<void> {
    // Determine category
    let category = 'feature'
    const titleLower = pr.title.toLowerCase()

    if (titleLower.includes('fix') || titleLower.includes('bug')) {
        category = 'bug_fix'
    } else if (titleLower.includes('refactor') || titleLower.includes('architecture')) {
        category = 'architecture'
    } else if (titleLower.includes('deploy') || titleLower.includes('ci') || titleLower.includes('infra')) {
        category = 'deployment'
    }

    const tags = extractTagsFromFiles(pr.files || [])

    const content = [
        `PR #${pr.number}: ${pr.title}`,
        `\nAuthor: ${pr.author}`,
        `Branch: ${pr.branch} → ${pr.baseBranch}`,
        pr.merged ? `Merged by: ${pr.mergedBy || 'unknown'}` : 'Status: Open',
        pr.additions !== undefined ? `Changes: +${pr.additions} / -${pr.deletions}` : '',
        pr.body ? `\n--- PR Description ---\n${pr.body}` : '',
        pr.files?.length ? `\n--- Files Changed (${pr.files.length}) ---\n${pr.files.map(f => `  - ${f}`).join('\n')}` : '',
    ].filter(Boolean).join('\n')

    await ingestKnowledge({
        title: `PR #${pr.number}: ${pr.title}`,
        content,
        category,
        source: 'github_pr',
        sourceUrl: pr.url,
        sourceId: `pr:${pr.number}`,
        author: pr.author,
        relatedFiles: pr.files?.map(path => ({ path })),
        tags,
        branch: pr.branch,
        importance: 'important',
    })
}

// ─── Conversation Insight Ingestion ──────────────────────────────────────

/**
 * Save a conversation insight as long-term knowledge
 * Called after meaningful Q&A exchanges
 */
export async function ingestConversationInsight(
    question: string,
    answer: string,
    askerName?: string
): Promise<void> {
    const content = [
        `Question: ${question}`,
        `\nAnswer: ${answer}`,
        askerName ? `\nAsked by: ${askerName}` : '',
    ].filter(Boolean).join('\n')

    // Extract tags from the question + answer
    const combinedText = `${question} ${answer}`
    const tags = extractTagsFromText(combinedText)

    await ingestKnowledge({
        title: `Q&A: ${question.substring(0, 80)}${question.length > 80 ? '...' : ''}`,
        content,
        category: 'conversation_insight',
        source: 'conversation',
        sourceId: `conv:${Date.now()}`,
        author: askerName,
        tags,
        importance: 'normal',
    })
}

// ─── Manual Note Ingestion ───────────────────────────────────────────────

/**
 * Save a team note via Lark command
 * Usage: /note [tag] content
 */
export async function ingestTeamNote(
    content: string,
    author: string,
    tags?: string[]
): Promise<void> {
    await ingestKnowledge({
        title: `Note: ${content.substring(0, 80)}${content.length > 80 ? '...' : ''}`,
        content,
        category: 'team_note',
        source: 'manual',
        sourceId: `note:${Date.now()}`,
        author,
        tags: tags?.map(tag => ({ tag })),
        importance: 'normal',
    })
}

// ─── Tag Extraction Helpers ──────────────────────────────────────────────

/**
 * Extract domain tags from file paths
 */
function extractTagsFromFiles(files: string[]): Array<{ tag: string }> {
    const tagSet = new Set<string>()

    for (const file of files) {
        if (file.includes('src/components/')) tagSet.add('frontend')
        if (file.includes('src/app/(')) tagSet.add('frontend')
        if (file.includes('src/collections/')) tagSet.add('backend')
        if (file.includes('src/app/api/')) tagSet.add('api')
        if (file.includes('src/lib/ai/')) tagSet.add('AI')
        if (file.includes('src/lib/lark/')) tagSet.add('lark-bot')
        if (file.includes('src/blocks/')) tagSet.add('blocks')
        if (file.includes('src/store/')) tagSet.add('state')
        if (file.includes('src/middleware')) tagSet.add('middleware')
        if (file.includes('.github/')) tagSet.add('CI/CD')
        if (file.includes('Dockerfile') || file.includes('.do/')) tagSet.add('deploy')
        if (file.includes('src/lib/storefront')) tagSet.add('e-commerce')
        if (file.includes('__tests__')) tagSet.add('testing')
    }

    return Array.from(tagSet).map(tag => ({ tag }))
}

/**
 * Extract topic tags from text content
 */
function extractTagsFromText(text: string): Array<{ tag: string }> {
    const tagSet = new Set<string>()
    const lower = text.toLowerCase()

    const tagKeywords: Record<string, string[]> = {
        'frontend': ['component', 'ui', 'tailwind', 'react', 'page', 'layout'],
        'backend': ['api', 'collection', 'payload', 'database', 'query'],
        'AI': ['ai', 'openai', 'gpt', 'prompt', 'generate', 'model'],
        'deploy': ['deploy', 'docker', 'digitalocean', 'ci', 'staging', 'production'],
        'auth': ['auth', 'login', 'token', 'password', 'session'],
        'blocks': ['block', 'hero', 'footer', 'navigation', 'section'],
        'e-commerce': ['product', 'order', 'cart', 'checkout', 'payment', 'stripe'],
        'middleware': ['middleware', 'routing', 'tenant', 'subdomain', 'domain'],
        'SEO': ['seo', 'meta', 'keywords', 'og:', 'search engine'],
    }

    for (const [tag, keywords] of Object.entries(tagKeywords)) {
        if (keywords.some(kw => lower.includes(kw))) {
            tagSet.add(tag)
        }
    }

    return Array.from(tagSet).map(tag => ({ tag }))
}

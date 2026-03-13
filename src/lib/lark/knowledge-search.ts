/**
 * Lark Bot — Knowledge Search
 *
 * Searches the BotKnowledge collection (PostgreSQL) for relevant entries
 * to enrich AI context when answering questions.
 *
 * Search strategy:
 * 1. Keyword search across title + content + tags
 * 2. Category filtering (if question type is identifiable)
 * 3. Author filtering (if asking about specific person's work)
 * 4. Time-based sorting (recent knowledge first)
 */
import { getPayload } from 'payload'
import config from '@payload-config'

// ─── Types ───────────────────────────────────────────────────────────────

interface KnowledgeResult {
    title: string
    content: string
    category: string
    author?: string
    createdAt: string
    sourceUrl?: string
    tags?: string[]
}

// ─── Search Functions ────────────────────────────────────────────────────

/**
 * Search knowledge base for entries relevant to a user question
 * Returns top N entries sorted by relevance
 */
export async function searchKnowledge(
    query: string,
    options: {
        limit?: number
        category?: string
        author?: string
    } = {}
): Promise<KnowledgeResult[]> {
    const { limit = 8, category, author } = options

    try {
        const payload = await getPayload({ config })

        // Build search conditions
        const conditions: any[] = []

        // Keyword search across title, content, and tags
        const keywords = extractSearchKeywords(query)
        if (keywords.length > 0) {
            const keywordConditions = keywords.map((kw) => ({
                or: [
                    { title: { contains: kw } },
                    { content: { contains: kw } },
                    { 'tags.tag': { contains: kw } },
                    { author: { contains: kw } },
                    { 'relatedFiles.path': { contains: kw } },
                ],
            }))
            conditions.push(...keywordConditions)
        }

        // Category filter
        if (category) {
            conditions.push({ category: { equals: category } })
        }

        // Author filter
        if (author) {
            conditions.push({ author: { contains: author } })
        }

        const results = await payload.find({
            collection: 'bot-knowledge',
            where: conditions.length > 0 ? { and: conditions } : undefined,
            limit,
            sort: '-createdAt', // Most recent first
        })

        return results.docs.map((doc: any) => ({
            title: doc.title,
            content: doc.content,
            category: doc.category,
            author: doc.author,
            createdAt: doc.createdAt,
            sourceUrl: doc.sourceUrl,
            tags: doc.tags?.map((t: any) => t.tag),
        }))
    } catch (error) {
        console.error('[Knowledge Search] Error:', error)
        return []
    }
}

/**
 * Get recent knowledge entries (for general context)
 */
export async function getRecentKnowledge(limit: number = 10): Promise<KnowledgeResult[]> {
    try {
        const payload = await getPayload({ config })

        const results = await payload.find({
            collection: 'bot-knowledge',
            limit,
            sort: '-createdAt',
            where: {
                // Prioritize important entries
                importance: { not_equals: 'low' },
            },
        })

        return results.docs.map((doc: any) => ({
            title: doc.title,
            content: doc.content,
            category: doc.category,
            author: doc.author,
            createdAt: doc.createdAt,
            sourceUrl: doc.sourceUrl,
            tags: doc.tags?.map((t: any) => t.tag),
        }))
    } catch (error) {
        console.error('[Knowledge Search] Error getting recent:', error)
        return []
    }
}

/**
 * Search for knowledge about a specific person's work
 * Example: "ai Lee đã build gì?" → search by author
 */
export async function searchByAuthor(
    authorName: string,
    limit: number = 10
): Promise<KnowledgeResult[]> {
    return searchKnowledge(authorName, { limit, author: authorName })
}

/**
 * Get knowledge stats (for /bot stats command)
 */
export async function getKnowledgeStats(): Promise<{
    total: number
    byCategory: Record<string, number>
    bySource: Record<string, number>
    lastUpdated: string | null
}> {
    try {
        const payload = await getPayload({ config })

        const all = await payload.find({
            collection: 'bot-knowledge',
            limit: 0, // Just count
        })

        // Get category breakdown
        const categories = ['code_change', 'architecture', 'feature', 'bug_fix', 'deployment', 'conversation_insight', 'team_note', 'planning']
        const byCategory: Record<string, number> = {}
        for (const cat of categories) {
            const count = await payload.find({
                collection: 'bot-knowledge',
                where: { category: { equals: cat } },
                limit: 0,
            })
            byCategory[cat] = count.totalDocs
        }

        // Get source breakdown
        const sources = ['github_commit', 'github_pr', 'conversation', 'manual', 'ci_cd']
        const bySource: Record<string, number> = {}
        for (const src of sources) {
            const count = await payload.find({
                collection: 'bot-knowledge',
                where: { source: { equals: src } },
                limit: 0,
            })
            bySource[src] = count.totalDocs
        }

        // Get last update time
        const latest = await payload.find({
            collection: 'bot-knowledge',
            limit: 1,
            sort: '-createdAt',
        })

        return {
            total: all.totalDocs,
            byCategory,
            bySource,
            lastUpdated: latest.docs[0]?.createdAt || null,
        }
    } catch (error) {
        console.error('[Knowledge Stats] Error:', error)
        return { total: 0, byCategory: {}, bySource: {}, lastUpdated: null }
    }
}

// ─── Format for AI Context ───────────────────────────────────────────────

/**
 * Format knowledge results as AI context string
 * This gets injected into the system prompt
 */
export function formatKnowledgeForAI(results: KnowledgeResult[]): string {
    if (results.length === 0) return ''

    const formatted = results.map((r, i) => {
        const date = new Date(r.createdAt).toLocaleDateString('vi-VN')
        return [
            `### [${i + 1}] ${r.title}`,
            `📅 ${date} | 👤 ${r.author || 'unknown'} | 📂 ${r.category}`,
            r.content.substring(0, 500), // Limit to prevent token overflow
            r.sourceUrl ? `🔗 ${r.sourceUrl}` : '',
        ].filter(Boolean).join('\n')
    })

    return formatted.join('\n\n---\n\n')
}

// ─── Internal Helpers ────────────────────────────────────────────────────

/**
 * Extract meaningful search keywords from a user question
 */
function extractSearchKeywords(text: string): string[] {
    const stopWords = new Set([
        'là', 'gì', 'của', 'và', 'hoặc', 'hay', 'cho', 'với', 'trong',
        'được', 'có', 'không', 'nào', 'sao', 'khi', 'nên', 'cần',
        'phải', 'làm', 'thì', 'mà', 'ở', 'tại', 'từ', 'đến', 'bao',
        'the', 'is', 'are', 'was', 'were', 'be', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'could', 'should',
        'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'how', 'what', 'where', 'when', 'why', 'which',
        'who', 'this', 'that', 'it', 'its', 'ai', 'đã', 'đang', 'sẽ',
        'những', 'các', 'một', 'nhưng', 'vì', 'nếu', 'thế',
    ])

    return text
        .toLowerCase()
        .replace(/[^\w\sàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w))
        .slice(0, 5) // Top 5 keywords
}

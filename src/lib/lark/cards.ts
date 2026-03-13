/**
 * Lark Bot — Interactive Card Templates
 * Builds structured cards for CI, deploy, PR, help, and error messages
 */
import type {
    LarkCard,
    LarkCardHeaderColor,
    LarkCardElement,
    LarkCardButton,
} from './types'
import { BOT_COMMANDS, GITHUB_REPO } from './constants'

// ─── Card Builders ───────────────────────────────────────────────────────

/**
 * Build a standard card with header + elements
 */
function buildCard(
    title: string,
    color: LarkCardHeaderColor,
    elements: LarkCardElement[]
): LarkCard {
    return {
        header: {
            title: { tag: 'plain_text', content: title },
            template: color,
        },
        elements,
    }
}

/**
 * Build a two-column info row
 */
function twoColumns(left: string, right: string): LarkCardElement {
    return {
        tag: 'column_set',
        flex_mode: 'none',
        background_style: 'default',
        columns: [
            {
                tag: 'column',
                width: 'weighted',
                weight: 1,
                vertical_align: 'top',
                elements: [
                    { tag: 'div', text: { tag: 'lark_md', content: left } },
                ],
            },
            {
                tag: 'column',
                width: 'weighted',
                weight: 1,
                vertical_align: 'top',
                elements: [
                    { tag: 'div', text: { tag: 'lark_md', content: right } },
                ],
            },
        ],
    }
}

// ─── Help Card ───────────────────────────────────────────────────────────

export function buildHelpCard(): LarkCard {
    const commandList = BOT_COMMANDS.map(
        (cmd) => `**${cmd.command}** — ${cmd.description}\n> ${cmd.usage}\n> Ví dụ: \`${cmd.example}\``
    ).join('\n\n')

    return buildCard('🤖 PrimeBot — Help', 'blue', [
        {
            tag: 'div',
            text: {
                tag: 'lark_md',
                content: '**Xin chào! Mình là PrimeBot** — trợ lý AI của team PrimeWeb.\n\nMình có thể giúp bạn:',
            },
        },
        { tag: 'hr' },
        {
            tag: 'div',
            text: {
                tag: 'lark_md',
                content: commandList,
            },
        },
        { tag: 'hr' },
        {
            tag: 'note',
            elements: [
                {
                    tag: 'plain_text',
                    content: '💡 Trong group chat, tag @PrimeBot hoặc dùng /command. P2P chat thì nói gì mình cũng trả lời!',
                },
            ],
        },
    ])
}

// ─── CI Status Card ──────────────────────────────────────────────────────

export interface CIStatusData {
    status: 'completed' | 'in_progress' | 'queued' | 'failure' | 'success'
    conclusion?: string | null
    branch: string
    commitSha: string
    commitMessage: string
    author: string
    runId: number
    duration?: string
    steps?: { name: string; status: string }[]
}

export function buildCIStatusCard(data: CIStatusData): LarkCard {
    const isSuccess = data.conclusion === 'success'
    const isFailed = data.conclusion === 'failure'
    const isRunning = data.status === 'in_progress'

    let title: string
    let color: LarkCardHeaderColor

    if (isSuccess) {
        title = `✅ CI Passed — ${data.branch}`
        color = 'green'
    } else if (isFailed) {
        title = `❌ CI Failed — ${data.branch}`
        color = 'red'
    } else if (isRunning) {
        title = `⏳ CI Running — ${data.branch}`
        color = 'orange'
    } else {
        title = `🔄 CI ${data.status} — ${data.branch}`
        color = 'grey'
    }

    const shortSha = data.commitSha.substring(0, 7)
    const buttons: LarkCardButton[] = [
        {
            tag: 'button',
            text: { tag: 'plain_text', content: '📋 View CI Run' },
            url: `https://github.com/${GITHUB_REPO}/actions/runs/${data.runId}`,
            type: 'primary',
        },
    ]

    // Add "Show Error" button for failed runs
    if (isFailed) {
        buttons.push({
            tag: 'button',
            text: { tag: 'plain_text', content: '🔍 Show Error' },
            type: 'danger',
            value: {
                action: 'show_ci_error',
                run_id: String(data.runId),
            },
        })
    }

    const elements: LarkCardElement[] = [
        twoColumns(
            `**📦 Project**\nPrimeWeb`,
            `**🌿 Branch**\n${data.branch}`
        ),
        twoColumns(
            `**🔖 Commit**\n${shortSha}`,
            `**👤 Author**\n${data.author}`
        ),
        { tag: 'hr' },
        {
            tag: 'div',
            text: {
                tag: 'lark_md',
                content: `📝 ${data.commitMessage.substring(0, 80)}${data.duration ? `\n🕐 Duration: ${data.duration}` : ''}`,
            },
        },
    ]

    // Add step status for failed runs
    if (data.steps?.length) {
        const stepIcons = data.steps.map((s) => {
            if (s.status === 'completed') return `${s.name} ✅`
            if (s.status === 'failure') return `${s.name} ❌`
            return `${s.name} ⬜`
        })
        elements.push({
            tag: 'div',
            text: {
                tag: 'lark_md',
                content: `**Steps:** ${stepIcons.join('  ')}`,
            },
        })
    }

    elements.push({
        tag: 'action',
        actions: buttons,
    })

    return buildCard(title, color, elements)
}

// ─── Deploy Status Card ──────────────────────────────────────────────────

export interface DeployStatusData {
    environment: string
    status: string
    url?: string
    commitSha?: string
    updatedAt?: string
}

export function buildDeployStatusCard(data: DeployStatusData): LarkCard {
    const isLive = data.status === 'ACTIVE' || data.status === 'success'
    const title = isLive
        ? `🚀 Deploy Active — ${data.environment}`
        : `⚠️ Deploy ${data.status} — ${data.environment}`
    const color: LarkCardHeaderColor = isLive ? 'green' : 'orange'

    const elements: LarkCardElement[] = [
        twoColumns(
            `**🌍 Environment**\n${data.environment}`,
            `**📊 Status**\n${data.status}`
        ),
    ]

    if (data.commitSha) {
        elements.push({
            tag: 'div',
            text: {
                tag: 'lark_md',
                content: `**🔖 Commit:** ${data.commitSha.substring(0, 7)}${data.updatedAt ? `\n**🕐 Updated:** ${data.updatedAt}` : ''}`,
            },
        })
    }

    if (data.url) {
        elements.push({
            tag: 'action',
            actions: [
                {
                    tag: 'button',
                    text: { tag: 'plain_text', content: '🔗 Open Site' },
                    url: data.url,
                    type: 'primary',
                },
            ],
        })
    }

    return buildCard(title, color, elements)
}

// ─── PR Card ─────────────────────────────────────────────────────────────

export interface PRData {
    number: number
    title: string
    author: string
    state: string
    branch: string
    baseBranch: string
    additions: number
    deletions: number
    changedFiles: number
    url: string
    aiSummary?: string
}

export function buildPRCard(data: PRData): LarkCard {
    const isOpen = data.state === 'open'
    const title = `${isOpen ? '🟢' : '🟣'} PR #${data.number} — ${data.title}`
    const color: LarkCardHeaderColor = isOpen ? 'green' : 'purple'

    const elements: LarkCardElement[] = [
        twoColumns(
            `**👤 Author**\n${data.author}`,
            `**🌿 Branch**\n${data.branch} → ${data.baseBranch}`
        ),
        twoColumns(
            `**📊 Changes**\n+${data.additions} / -${data.deletions}`,
            `**📁 Files**\n${data.changedFiles} changed`
        ),
    ]

    if (data.aiSummary) {
        elements.push(
            { tag: 'hr' },
            {
                tag: 'div',
                text: {
                    tag: 'lark_md',
                    content: `**🤖 AI Summary:**\n${data.aiSummary}`,
                },
            }
        )
    }

    elements.push({
        tag: 'action',
        actions: [
            {
                tag: 'button',
                text: { tag: 'plain_text', content: '🔗 View PR' },
                url: data.url,
                type: 'primary',
            },
        ],
    })

    return buildCard(title, color, elements)
}

// ─── PR List Card ────────────────────────────────────────────────────────

export function buildPRListCard(
    prs: Array<{ number: number; title: string; author: string; branch: string; url: string }>
): LarkCard {
    if (prs.length === 0) {
        return buildCard('📋 Open PRs', 'grey', [
            {
                tag: 'div',
                text: { tag: 'lark_md', content: '✅ Không có PR nào đang open.' },
            },
        ])
    }

    const prList = prs
        .map(
            (pr) =>
                `**[#${pr.number}](${pr.url})** ${pr.title}\n> 👤 ${pr.author} · 🌿 ${pr.branch}`
        )
        .join('\n\n')

    return buildCard(`📋 Open PRs (${prs.length})`, 'blue', [
        {
            tag: 'div',
            text: { tag: 'lark_md', content: prList },
        },
        { tag: 'hr' },
        {
            tag: 'note',
            elements: [
                {
                    tag: 'plain_text',
                    content: '💡 Dùng /pr <number> để xem chi tiết hoặc /pr reviewer <number> để gợi ý reviewer.',
                },
            ],
        },
    ])
}

// ─── Reviewer Suggestion Card ────────────────────────────────────────────

export interface ReviewerSuggestion {
    name: string
    githubUsername: string
    role: string
    reason: string
}

export function buildReviewerCard(
    prNumber: number,
    prTitle: string,
    suggestions: ReviewerSuggestion[]
): LarkCard {
    if (suggestions.length === 0) {
        return buildCard(`👥 Reviewer — PR #${prNumber}`, 'grey', [
            {
                tag: 'div',
                text: {
                    tag: 'lark_md',
                    content: '🤔 Không tìm được reviewer phù hợp. Hãy assign manually.',
                },
            },
        ])
    }

    const reviewerList = suggestions
        .map(
            (s, i) =>
                `**${i + 1}. ${s.name}** (@${s.githubUsername}) — ${s.role}\n> ${s.reason}`
        )
        .join('\n\n')

    return buildCard(`👥 Reviewer Gợi Ý — PR #${prNumber}`, 'indigo', [
        {
            tag: 'div',
            text: { tag: 'lark_md', content: `**${prTitle}**` },
        },
        { tag: 'hr' },
        {
            tag: 'div',
            text: { tag: 'lark_md', content: reviewerList },
        },
        {
            tag: 'action',
            actions: [
                {
                    tag: 'button',
                    text: { tag: 'plain_text', content: '🔗 View PR' },
                    url: `https://github.com/${GITHUB_REPO}/pull/${prNumber}`,
                    type: 'primary',
                },
            ],
        },
    ])
}

// ─── Stats Card ─────────────────────────────────────────────────────

export interface KnowledgeStatsData {
    total: number
    byCategory: Record<string, number>
    bySource: Record<string, number>
    lastUpdated: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
    code_change: '🔧 Code Changes',
    architecture: '🏗️ Architecture',
    feature: '✨ Features',
    bug_fix: '🐛 Bug Fixes',
    deployment: '🚀 Deployments',
    conversation_insight: '💬 Conversations',
    team_note: '📝 Team Notes',
    planning: '📋 Planning',
}

const SOURCE_LABELS: Record<string, string> = {
    github_commit: 'GitHub Commits',
    github_pr: 'GitHub PRs',
    conversation: 'Lark Q&A',
    manual: 'Manual Notes',
    ci_cd: 'CI/CD',
}

export function buildStatsCard(stats: KnowledgeStatsData): LarkCard {
    const lastUpdate = stats.lastUpdated
        ? new Date(stats.lastUpdated).toLocaleString('vi-VN')
        : 'Chưa có dữ liệu'

    // Build category breakdown
    const categoryLines = Object.entries(stats.byCategory)
        .filter(([, count]) => count > 0)
        .map(([cat, count]) => `${CATEGORY_LABELS[cat] || cat}: **${count}**`)
        .join('\n')

    // Build source breakdown
    const sourceLines = Object.entries(stats.bySource)
        .filter(([, count]) => count > 0)
        .map(([src, count]) => `${SOURCE_LABELS[src] || src}: **${count}**`)
        .join('\n')

    return buildCard('🧠 PrimeBot — Knowledge Stats', 'purple', [
        twoColumns(
            `**📊 Tổng kiến thức**\n${stats.total} entries`,
            `**🕐 Cập nhật gần nhất**\n${lastUpdate}`
        ),
        { tag: 'hr' },
        twoColumns(
            `**📂 Theo loại**\n${categoryLines || 'Chưa có'}`,
            `**📡 Theo nguồn**\n${sourceLines || 'Chưa có'}`
        ),
        { tag: 'hr' },
        {
            tag: 'note',
            elements: [
                {
                    tag: 'plain_text',
                    content: '💡 Bot tự học từ GitHub commits, PRs, và các cuộc hội thoại. Dùng /note để thêm kiến thức thủ công.',
                },
            ],
        },
    ])
}

// ─── Note Added Card ────────────────────────────────────────────────

export function buildNoteAddedCard(content: string): LarkCard {
    return buildCard('📝 Ghi Chú Đã Lưu', 'green', [
        {
            tag: 'div',
            text: {
                tag: 'lark_md',
                content: `✅ Đã lưu vào knowledge base:\n\n> ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`,
            },
        },
        {
            tag: 'note',
            elements: [
                {
                    tag: 'plain_text',
                    content: '💡 Bot sẽ sử dụng ghi chú này khi trả lời câu hỏi liên quan.',
                },
            ],
        },
    ])
}

// ─── Error Card ──────────────────────────────────────────────────────────

export function buildErrorCard(title: string, message: string): LarkCard {
    return buildCard(`❌ ${title}`, 'red', [
        {
            tag: 'div',
            text: {
                tag: 'lark_md',
                content: `⚠️ ${message}\n\nNếu lỗi tiếp tục, liên hệ DevOps team.`,
            },
        },
    ])
}

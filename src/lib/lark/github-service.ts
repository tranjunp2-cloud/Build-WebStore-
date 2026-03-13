/**
 * Lark Bot — GitHub Service
 * CI/CD status, PR info, reviewer suggestions via GitHub API
 */
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { SYSTEM_PROMPTS, selectModel } from '@/lib/ai/config'
import { replyCard, replyText } from './client'
import {
    buildCIStatusCard,
    buildDeployStatusCard,
    buildPRCard,
    buildPRListCard,
    buildReviewerCard,
    buildErrorCard,
} from './cards'
import type { CIStatusData, DeployStatusData, PRData, ReviewerSuggestion } from './cards'
import { GITHUB_API_BASE, GITHUB_REPO, GITHUB_TOKEN, TEAM_MEMBERS, DOMAIN_PATTERNS } from './constants'

// ─── GitHub API Helpers ──────────────────────────────────────────────────

async function githubFetch<T>(path: string): Promise<T> {
    if (!GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN is not configured')
    }

    const res = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}${path}`, {
        headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'PrimeBot/1.0',
        },
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`GitHub API ${res.status}: ${text.substring(0, 200)}`)
    }

    return res.json()
}

// ─── CI Status ───────────────────────────────────────────────────────────

interface GitHubWorkflowRun {
    id: number
    name: string
    status: string
    conclusion: string | null
    head_branch: string
    head_sha: string
    actor: { login: string }
    created_at: string
    updated_at: string
    run_started_at?: string
    html_url: string
}

interface GitHubJob {
    name: string
    status: string
    conclusion: string | null
    steps?: Array<{ name: string; status: string; conclusion: string | null }>
}

export async function handleCIStatus(messageId: string, branch?: string): Promise<void> {
    try {
        const query = branch ? `&branch=${branch}` : ''
        const runs = await githubFetch<{ workflow_runs: GitHubWorkflowRun[] }>(
            `/actions/runs?per_page=1${query}`
        )

        if (!runs.workflow_runs?.length) {
            await replyText(messageId, '📋 Không tìm thấy CI run nào' + (branch ? ` trên branch ${branch}` : '') + '.')
            return
        }

        const run = runs.workflow_runs[0]

        // Get job details for step info
        let steps: { name: string; status: string }[] | undefined
        if (run.conclusion === 'failure') {
            try {
                const jobs = await githubFetch<{ jobs: GitHubJob[] }>(
                    `/actions/runs/${run.id}/jobs`
                )
                const failedJob = jobs.jobs.find((j) => j.conclusion === 'failure')
                if (failedJob?.steps) {
                    steps = failedJob.steps.map((s) => ({
                        name: s.name,
                        status: s.conclusion || s.status,
                    }))
                }
            } catch {
                // Non-critical — skip step details
            }
        }

        // Calculate duration
        let duration: string | undefined
        if (run.run_started_at && run.updated_at) {
            const start = new Date(run.run_started_at).getTime()
            const end = new Date(run.updated_at).getTime()
            const seconds = Math.round((end - start) / 1000)
            if (seconds > 60) {
                duration = `${Math.floor(seconds / 60)}m ${seconds % 60}s`
            } else {
                duration = `${seconds}s`
            }
        }

        // Get commit message
        let commitMessage = ''
        try {
            const commit = await githubFetch<{ commit: { message: string } }>(
                `/commits/${run.head_sha}`
            )
            commitMessage = commit.commit.message.split('\n')[0]
        } catch {
            commitMessage = '(unknown)'
        }

        const data: CIStatusData = {
            status: run.status as CIStatusData['status'],
            conclusion: run.conclusion,
            branch: run.head_branch,
            commitSha: run.head_sha,
            commitMessage,
            author: run.actor.login,
            runId: run.id,
            duration,
            steps,
        }

        await replyCard(messageId, buildCIStatusCard(data))
    } catch (error) {
        console.error('[Lark] CI status error:', error)
        await replyCard(messageId, buildErrorCard(
            'CI Status Error',
            error instanceof Error ? error.message : 'Failed to fetch CI status'
        ))
    }
}

// ─── Deploy Status ───────────────────────────────────────────────────────

export async function handleDeployStatus(messageId: string, env?: string): Promise<void> {
    try {
        // Get latest deployment
        const deployments = await githubFetch<Array<{
            id: number
            environment: string
            sha: string
            created_at: string
            updated_at: string
            creator: { login: string }
        }>>('/deployments?per_page=5')

        if (!deployments?.length) {
            await replyText(messageId, '📋 Không tìm thấy deployment nào.')
            return
        }

        // Filter by environment if specified
        const filtered = env
            ? deployments.filter((d) =>
                d.environment.toLowerCase().includes(env.toLowerCase())
            )
            : deployments

        const deployment = filtered[0] || deployments[0]

        // Get deployment status
        const statuses = await githubFetch<Array<{
            state: string
            environment_url?: string
            created_at: string
        }>>(`/deployments/${deployment.id}/statuses`)

        const latestStatus = statuses[0]

        const data: DeployStatusData = {
            environment: deployment.environment,
            status: latestStatus?.state || 'unknown',
            url: latestStatus?.environment_url,
            commitSha: deployment.sha,
            updatedAt: new Date(latestStatus?.created_at || deployment.updated_at).toLocaleString('vi-VN'),
        }

        await replyCard(messageId, buildDeployStatusCard(data))
    } catch (error) {
        console.error('[Lark] Deploy status error:', error)
        await replyCard(messageId, buildErrorCard(
            'Deploy Status Error',
            error instanceof Error ? error.message : 'Failed to fetch deploy status'
        ))
    }
}

// ─── PR List ─────────────────────────────────────────────────────────────

export async function handlePRList(messageId: string): Promise<void> {
    try {
        const prs = await githubFetch<Array<{
            number: number
            title: string
            user: { login: string }
            head: { ref: string }
            html_url: string
        }>>('/pulls?state=open&per_page=10')

        const prList = prs.map((pr) => ({
            number: pr.number,
            title: pr.title,
            author: pr.user.login,
            branch: pr.head.ref,
            url: pr.html_url,
        }))

        await replyCard(messageId, buildPRListCard(prList))
    } catch (error) {
        console.error('[Lark] PR list error:', error)
        await replyCard(messageId, buildErrorCard(
            'PR List Error',
            error instanceof Error ? error.message : 'Failed to fetch PRs'
        ))
    }
}

// ─── PR Summary ──────────────────────────────────────────────────────────

export async function handlePRSummary(messageId: string, prNumber: string): Promise<void> {
    try {
        const num = parseInt(prNumber, 10)
        if (isNaN(num)) {
            await replyText(messageId, '❌ PR number không hợp lệ. Dùng: /pr <number>')
            return
        }

        const pr = await githubFetch<{
            number: number
            title: string
            body: string | null
            state: string
            user: { login: string }
            head: { ref: string }
            base: { ref: string }
            additions: number
            deletions: number
            changed_files: number
            html_url: string
        }>(`/pulls/${num}`)

        // Get changed files for AI context
        let filesContext = ''
        try {
            const files = await githubFetch<Array<{
                filename: string
                status: string
                additions: number
                deletions: number
            }>>(`/pulls/${num}/files?per_page=30`)

            filesContext = files
                .map((f) => `${f.status}: ${f.filename} (+${f.additions}/-${f.deletions})`)
                .join('\n')
        } catch {
            // Non-critical
        }

        // AI summary
        let aiSummary: string | undefined
        try {
            const model = selectModel('assistant-chat')
            const { text } = await generateText({
                model: openai(model),
                system: 'You are a code review assistant. Summarize PRs concisely in Vietnamese. Focus on: what changed, potential risks, and impact.',
                messages: [
                    {
                        role: 'user',
                        content: `Summarize this PR in 3-4 bullet points (Vietnamese):\n\nTitle: ${pr.title}\nDescription: ${pr.body || 'No description'}\nBranch: ${pr.head.ref} → ${pr.base.ref}\nFiles changed:\n${filesContext}`,
                    },
                ],
                maxTokens: 500,
                temperature: 0.5,
            })
            aiSummary = text
        } catch {
            // Non-critical — show PR without summary
        }

        const data: PRData = {
            number: pr.number,
            title: pr.title,
            author: pr.user.login,
            state: pr.state,
            branch: pr.head.ref,
            baseBranch: pr.base.ref,
            additions: pr.additions,
            deletions: pr.deletions,
            changedFiles: pr.changed_files,
            url: pr.html_url,
            aiSummary,
        }

        await replyCard(messageId, buildPRCard(data))
    } catch (error) {
        console.error('[Lark] PR summary error:', error)
        await replyCard(messageId, buildErrorCard(
            'PR Summary Error',
            error instanceof Error ? error.message : 'Failed to fetch PR'
        ))
    }
}

// ─── PR Reviewer Suggestion ──────────────────────────────────────────────

export async function handlePRReviewer(messageId: string, prNumber: string): Promise<void> {
    try {
        const num = parseInt(prNumber, 10)
        if (isNaN(num)) {
            await replyText(messageId, '❌ PR number không hợp lệ. Dùng: /pr reviewer <number>')
            return
        }

        // Get PR info
        const pr = await githubFetch<{
            number: number
            title: string
            user: { login: string }
        }>(`/pulls/${num}`)

        // Get changed files
        const files = await githubFetch<Array<{
            filename: string
            status: string
            additions: number
            deletions: number
        }>>(`/pulls/${num}/files?per_page=50`)

        const filePaths = files.map((f) => f.filename)

        // Match files to domains
        const matchedDomains = new Set<string>()
        for (const filePath of filePaths) {
            for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
                if (patterns.some((p) => filePath.includes(p) || filePath.endsWith(p))) {
                    matchedDomains.add(domain)
                }
            }
        }

        // Find team members who own these domains
        const suggestions: ReviewerSuggestion[] = []
        const prAuthor = pr.user.login

        for (const member of TEAM_MEMBERS) {
            // Skip PR author
            if (member.githubUsername === prAuthor) continue

            // Check if member's domains overlap with changed files
            const memberDomains = member.domains
            const relevantFiles = filePaths.filter((fp) =>
                memberDomains.some((d) => fp.includes(d))
            )

            if (relevantFiles.length > 0) {
                const reason = `Chuyên về ${member.domains.slice(0, 3).join(', ')} — ${relevantFiles.length} files liên quan`
                suggestions.push({
                    name: member.name,
                    githubUsername: member.githubUsername,
                    role: member.role,
                    reason,
                })
            }
        }

        // Sort by relevance (more matching files = higher priority)
        suggestions.sort((a, b) => {
            const aCount = filePaths.filter((fp) =>
                TEAM_MEMBERS.find((m) => m.githubUsername === a.githubUsername)?.domains.some((d) =>
                    fp.includes(d)
                )
            ).length
            const bCount = filePaths.filter((fp) =>
                TEAM_MEMBERS.find((m) => m.githubUsername === b.githubUsername)?.domains.some((d) =>
                    fp.includes(d)
                )
            ).length
            return bCount - aCount
        })

        await replyCard(
            messageId,
            buildReviewerCard(num, pr.title, suggestions.slice(0, 3))
        )
    } catch (error) {
        console.error('[Lark] Reviewer suggestion error:', error)
        await replyCard(messageId, buildErrorCard(
            'Reviewer Error',
            error instanceof Error ? error.message : 'Failed to suggest reviewers'
        ))
    }
}

// ─── CI Error Details (for card callback) ────────────────────────────────

export async function getCIErrorDetails(runId: string): Promise<string> {
    try {
        const jobs = await githubFetch<{
            jobs: Array<{
                name: string
                conclusion: string | null
                steps?: Array<{
                    name: string
                    conclusion: string | null
                    number: number
                }>
            }>
        }>(`/actions/runs/${runId}/jobs`)

        const failedJob = jobs.jobs.find((j) => j.conclusion === 'failure')
        if (!failedJob) return 'Không tìm thấy job bị lỗi.'

        const failedStep = failedJob.steps?.find((s) => s.conclusion === 'failure')
        const failedStepName = failedStep?.name || 'Unknown'

        // Get logs
        try {
            const logsUrl = `/actions/runs/${runId}/jobs`
            const jobsData = await githubFetch<{ jobs: Array<{ id: number; name: string; conclusion: string | null }> }>(logsUrl)
            const failedJobId = jobsData.jobs.find((j) => j.conclusion === 'failure')?.id

            if (failedJobId) {
                // Note: GitHub API for job logs returns plain text, not JSON
                const res = await fetch(
                    `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/actions/jobs/${failedJobId}/logs`,
                    {
                        headers: {
                            Authorization: `Bearer ${GITHUB_TOKEN}`,
                            Accept: 'application/vnd.github.v3+json',
                            'User-Agent': 'PrimeBot/1.0',
                        },
                    }
                )

                if (res.ok) {
                    const logs = await res.text()
                    // Extract last 20 lines (most relevant)
                    const lines = logs.split('\n').slice(-20).join('\n')
                    return `**❌ Failed at: ${failedJob.name} → ${failedStepName}**\n\n\`\`\`\n${lines.substring(0, 500)}\n\`\`\``
                }
            }
        } catch {
            // Non-critical — return basic info
        }

        return `**❌ Failed at: ${failedJob.name} → ${failedStepName}**\n\nXem logs chi tiết trên GitHub.`
    } catch (error) {
        return `Error fetching CI details: ${error instanceof Error ? error.message : 'Unknown'}`
    }
}

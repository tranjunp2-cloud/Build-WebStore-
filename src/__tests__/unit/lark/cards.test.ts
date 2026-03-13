import { describe, it, expect } from 'vitest'
import {
    buildHelpCard,
    buildCIStatusCard,
    buildDeployStatusCard,
    buildPRCard,
    buildPRListCard,
    buildReviewerCard,
    buildErrorCard,
    buildStatsCard,
    buildNoteAddedCard,
} from '@/lib/lark/cards'
import type { CIStatusData, DeployStatusData, PRData, ReviewerSuggestion, KnowledgeStatsData } from '@/lib/lark/cards'

describe('Lark Cards', () => {
    describe('buildHelpCard', () => {
        it('should have blue header', () => {
            const card = buildHelpCard()
            expect(card.header?.template).toBe('blue')
        })

        it('should contain elements', () => {
            const card = buildHelpCard()
            expect(card.elements.length).toBeGreaterThan(0)
        })

        it('should include command descriptions', () => {
            const card = buildHelpCard()
            const content = JSON.stringify(card)
            expect(content).toContain('/help')
            expect(content).toContain('/ci')
            expect(content).toContain('/pr')
        })
    })

    describe('buildCIStatusCard', () => {
        const baseData: CIStatusData = {
            status: 'completed',
            conclusion: 'success',
            branch: 'main',
            commitSha: 'abc1234567890',
            commitMessage: 'feat: add new feature',
            author: 'developer',
            runId: 12345,
        }

        it('should have green header for success', () => {
            const card = buildCIStatusCard(baseData)
            expect(card.header?.template).toBe('green')
            expect(card.header?.title.content).toContain('✅')
        })

        it('should have red header for failure', () => {
            const card = buildCIStatusCard({ ...baseData, conclusion: 'failure' })
            expect(card.header?.template).toBe('red')
            expect(card.header?.title.content).toContain('❌')
        })

        it('should have orange header for in_progress', () => {
            const card = buildCIStatusCard({
                ...baseData,
                status: 'in_progress',
                conclusion: null,
            })
            expect(card.header?.template).toBe('orange')
            expect(card.header?.title.content).toContain('⏳')
        })

        it('should show duration when provided', () => {
            const card = buildCIStatusCard({ ...baseData, duration: '3m 45s' })
            const content = JSON.stringify(card)
            expect(content).toContain('3m 45s')
        })

        it('should include View CI Run button', () => {
            const card = buildCIStatusCard(baseData)
            const content = JSON.stringify(card)
            expect(content).toContain('View CI Run')
            expect(content).toContain('12345')
        })

        it('should include Show Error button for failures', () => {
            const card = buildCIStatusCard({ ...baseData, conclusion: 'failure' })
            const content = JSON.stringify(card)
            expect(content).toContain('Show Error')
        })
    })

    describe('buildDeployStatusCard', () => {
        it('should show green for active deploy', () => {
            const data: DeployStatusData = {
                environment: 'staging',
                status: 'ACTIVE',
                url: 'https://staging.primeweb.app',
            }
            const card = buildDeployStatusCard(data)
            expect(card.header?.template).toBe('green')
        })

        it('should include open site button when URL provided', () => {
            const data: DeployStatusData = {
                environment: 'production',
                status: 'success',
                url: 'https://primeweb.app',
            }
            const card = buildDeployStatusCard(data)
            const content = JSON.stringify(card)
            expect(content).toContain('Open Site')
            expect(content).toContain('https://primeweb.app')
        })
    })

    describe('buildPRCard', () => {
        const prData: PRData = {
            number: 31,
            title: 'feat: deploy pipeline fix',
            author: 'haynoikonike',
            state: 'open',
            branch: 'fix/deploy',
            baseBranch: 'main',
            additions: 150,
            deletions: 20,
            changedFiles: 5,
            url: 'https://github.com/test/repo/pull/31',
        }

        it('should show green for open PR', () => {
            const card = buildPRCard(prData)
            expect(card.header?.template).toBe('green')
        })

        it('should show purple for closed PR', () => {
            const card = buildPRCard({ ...prData, state: 'closed' })
            expect(card.header?.template).toBe('purple')
        })

        it('should include AI summary when provided', () => {
            const card = buildPRCard({ ...prData, aiSummary: 'This PR fixes deploy issues.' })
            const content = JSON.stringify(card)
            expect(content).toContain('AI Summary')
            expect(content).toContain('deploy issues')
        })
    })

    describe('buildPRListCard', () => {
        it('should handle empty PR list', () => {
            const card = buildPRListCard([])
            const content = JSON.stringify(card)
            expect(content).toContain('Không có PR nào')
        })

        it('should list PRs with numbers and titles', () => {
            const prs = [
                { number: 31, title: 'Fix deploy', author: 'dev1', branch: 'fix/deploy', url: 'https://github.com/test/pr/31' },
                { number: 32, title: 'Add feature', author: 'dev2', branch: 'feat/new', url: 'https://github.com/test/pr/32' },
            ]
            const card = buildPRListCard(prs)
            expect(card.header?.title.content).toContain('2')
            const content = JSON.stringify(card)
            expect(content).toContain('#31')
            expect(content).toContain('#32')
        })
    })

    describe('buildReviewerCard', () => {
        it('should handle no suggestions', () => {
            const card = buildReviewerCard(31, 'Test PR', [])
            const content = JSON.stringify(card)
            expect(content).toContain('Không tìm được reviewer')
        })

        it('should list suggested reviewers', () => {
            const suggestions: ReviewerSuggestion[] = [
                { name: 'Lee', githubUsername: 'Mr-LeeB', role: 'BE Lead', reason: 'API changes' },
                { name: 'Đức', githubUsername: 'levietducprime', role: 'FE Lead', reason: 'Component changes' },
            ]
            const card = buildReviewerCard(31, 'Test PR', suggestions)
            const content = JSON.stringify(card)
            expect(content).toContain('Lee')
            expect(content).toContain('Mr-LeeB')
            expect(content).toContain('Đức')
        })
    })

    describe('buildStatsCard', () => {
        const statsData: KnowledgeStatsData = {
            total: 150,
            byCategory: {
                code_change: 80,
                feature: 30,
                bug_fix: 15,
                conversation_insight: 10,
                team_note: 5,
                architecture: 5,
                deployment: 3,
                planning: 2,
            },
            bySource: {
                github_commit: 100,
                github_pr: 25,
                conversation: 10,
                manual: 10,
                ci_cd: 5,
            },
            lastUpdated: new Date().toISOString(),
        }

        it('should have purple header', () => {
            const card = buildStatsCard(statsData)
            expect(card.header?.template).toBe('purple')
        })

        it('should display total count', () => {
            const card = buildStatsCard(statsData)
            const content = JSON.stringify(card)
            expect(content).toContain('150')
        })

        it('should display category breakdown', () => {
            const card = buildStatsCard(statsData)
            const content = JSON.stringify(card)
            expect(content).toContain('Code Changes')
            expect(content).toContain('80')
        })

        it('should display source breakdown', () => {
            const card = buildStatsCard(statsData)
            const content = JSON.stringify(card)
            expect(content).toContain('GitHub Commits')
            expect(content).toContain('100')
        })

        it('should handle empty stats', () => {
            const emptyStats: KnowledgeStatsData = {
                total: 0,
                byCategory: {},
                bySource: {},
                lastUpdated: null,
            }
            const card = buildStatsCard(emptyStats)
            const content = JSON.stringify(card)
            expect(content).toContain('0 entries')
            expect(content).toContain('Chưa có dữ liệu')
        })
    })

    describe('buildNoteAddedCard', () => {
        it('should have green header', () => {
            const card = buildNoteAddedCard('auth dùng JWT + refresh token')
            expect(card.header?.template).toBe('green')
        })

        it('should display note content', () => {
            const card = buildNoteAddedCard('auth dùng JWT + refresh token')
            const content = JSON.stringify(card)
            expect(content).toContain('JWT')
            expect(content).toContain('refresh token')
        })

        it('should truncate long notes', () => {
            const longNote = 'a'.repeat(300)
            const card = buildNoteAddedCard(longNote)
            const content = JSON.stringify(card)
            expect(content).toContain('...')
        })
    })

    describe('buildErrorCard', () => {
        it('should have red header', () => {
            const card = buildErrorCard('Test Error', 'Something went wrong')
            expect(card.header?.template).toBe('red')
        })

        it('should include error message', () => {
            const card = buildErrorCard('DB Error', 'Connection timeout')
            const content = JSON.stringify(card)
            expect(content).toContain('Connection timeout')
        })
    })
})

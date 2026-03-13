import { describe, it, expect } from 'vitest'
import { extractText, classifyIntent, isBotAddressed, routeMessage } from '@/lib/lark/intent-router'

describe('Intent Router', () => {
    describe('extractText', () => {
        it('should extract text from JSON content', () => {
            const content = JSON.stringify({ text: 'Hello bot' })
            expect(extractText(content)).toBe('Hello bot')
        })

        it('should remove @mention placeholders', () => {
            const content = JSON.stringify({ text: '@_user_1 check CI please' })
            const mentions = [
                { key: '@_user_1', id: { open_id: 'ou_abc' }, name: 'PrimeBot' },
            ]
            expect(extractText(content, mentions)).toBe('check CI please')
        })

        it('should handle multiple mentions', () => {
            const content = JSON.stringify({ text: '@_user_1 @_user_2 review this' })
            const mentions = [
                { key: '@_user_1', id: { open_id: 'ou_abc' }, name: 'PrimeBot' },
                { key: '@_user_2', id: { open_id: 'ou_def' }, name: 'User2' },
            ]
            expect(extractText(content, mentions)).toBe('review this')
        })

        it('should handle plain string content', () => {
            expect(extractText('plain text message')).toBe('plain text message')
        })

        it('should trim whitespace', () => {
            const content = JSON.stringify({ text: '  hello  world  ' })
            expect(extractText(content)).toBe('hello world')
        })
    })

    describe('classifyIntent', () => {
        it('should classify /help command', () => {
            const result = classifyIntent('/help')
            expect(result.intent).toBe('help')
        })

        it('should classify /h alias', () => {
            const result = classifyIntent('/h')
            expect(result.intent).toBe('help')
        })

        it('should classify /ci command', () => {
            const result = classifyIntent('/ci')
            expect(result.intent).toBe('ci_status')
        })

        it('should classify /ci with branch argument', () => {
            const result = classifyIntent('/ci staging')
            expect(result.intent).toBe('ci_status')
            expect(result.args?.branch).toBe('staging')
        })

        it('should classify /deploy command', () => {
            const result = classifyIntent('/deploy')
            expect(result.intent).toBe('deploy_status')
        })

        it('should classify /deploy with env', () => {
            const result = classifyIntent('/deploy staging')
            expect(result.intent).toBe('deploy_status')
            expect(result.args?.env).toBe('staging')
        })

        it('should classify /pr list', () => {
            const result = classifyIntent('/pr list')
            expect(result.intent).toBe('pr_list')
        })

        it('should classify /pr <number>', () => {
            const result = classifyIntent('/pr 31')
            expect(result.intent).toBe('pr_summary')
            expect(result.args?.prNumber).toBe('31')
        })

        it('should classify /pr reviewer <number>', () => {
            const result = classifyIntent('/pr reviewer 31')
            expect(result.intent).toBe('pr_reviewer')
            expect(result.args?.prNumber).toBe('31')
        })

        it('should classify /note command with content', () => {
            const result = classifyIntent('/note auth dùng JWT + refresh token')
            expect(result.intent).toBe('add_note')
            expect(result.args?.content).toBe('auth dùng JWT + refresh token')
        })

        it('should classify /ghi alias for note', () => {
            const result = classifyIntent('/ghi deploy staging dùng DO App Platform')
            expect(result.intent).toBe('add_note')
            expect(result.args?.content).toBe('deploy staging dùng DO App Platform')
        })

        it('should classify /bot stats command', () => {
            const result = classifyIntent('/bot stats')
            expect(result.intent).toBe('bot_stats')
        })

        it('should classify /stats command', () => {
            const result = classifyIntent('/stats')
            expect(result.intent).toBe('bot_stats')
        })

        it('should fallback to project_qa for unknown text', () => {
            const result = classifyIntent('What tech stack are we using?')
            expect(result.intent).toBe('project_qa')
            expect(result.rawText).toBe('What tech stack are we using?')
        })

        it('should fallback for Vietnamese text', () => {
            const result = classifyIntent('Cách deploy lên staging thế nào?')
            expect(result.intent).toBe('project_qa')
        })
    })

    describe('isBotAddressed', () => {
        it('should always return true for P2P chat', () => {
            expect(isBotAddressed('p2p', 'hello')).toBe(true)
        })

        it('should return true for slash commands in group', () => {
            expect(isBotAddressed('group', '/help')).toBe(true)
            expect(isBotAddressed('group', '/ci staging')).toBe(true)
        })

        it('should return false for plain text in group without mention', () => {
            expect(isBotAddressed('group', 'hello')).toBe(false)
        })

        it('should return true when bot is @mentioned in group', () => {
            const mentions = [
                { key: '@_user_1', id: { open_id: 'ou_bot123' }, name: 'PrimeBot' },
            ]
            expect(isBotAddressed('group', 'hello', mentions, 'ou_bot123')).toBe(true)
        })

        it('should return false when someone else is @mentioned', () => {
            const mentions = [
                { key: '@_user_1', id: { open_id: 'ou_other' }, name: 'OtherUser' },
            ]
            expect(isBotAddressed('group', 'hello', mentions, 'ou_bot123')).toBe(false)
        })
    })

    describe('routeMessage', () => {
        it('should route P2P help command', () => {
            const content = JSON.stringify({ text: '/help' })
            const result = routeMessage(content, 'p2p')
            expect(result?.intent).toBe('help')
        })

        it('should route group @mention', () => {
            const content = JSON.stringify({ text: '@_user_1 what is our tech stack?' })
            const mentions = [
                { key: '@_user_1', id: { open_id: 'ou_bot' }, name: 'PrimeBot' },
            ]
            const result = routeMessage(content, 'group', mentions, 'ou_bot')
            expect(result?.intent).toBe('project_qa')
        })

        it('should return null for group chat without mention', () => {
            const content = JSON.stringify({ text: 'random message' })
            const result = routeMessage(content, 'group')
            expect(result).toBeNull()
        })

        it('should return null for empty text', () => {
            const content = JSON.stringify({ text: '' })
            const result = routeMessage(content, 'p2p')
            expect(result).toBeNull()
        })
    })
})

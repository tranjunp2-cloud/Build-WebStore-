/**
 * TC-AISEC-079 — AI drafts between teammates, prime-web's part (audit H-S2):
 *   - the signed context token names who asks ("Asked by …"), from first + last name or the email's local part;
 *   - Undo through the proxy is refused before anything is written when the platform says the caller may not decide;
 *     the editor's reconcile then only reports the page, it never settles the card;
 *   - the dashboard's Malay and Vietnamese labels carry the access sentences.
 * Real: lib/ai-platform/context.ts (signing), handleAgentProxy (undo / reconcile routes), agent-panel-labels, jose.
 * Faked: the session lookup, the AI platform, the appliers, next/cache.
 */
import { jwtVerify } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/ai-platform/upstream', () => ({
    AiPlatformError: class AiPlatformError extends Error {},
    callAiPlatform: vi.fn(),
    aiPlatformJson: vi.fn(),
}))
vi.mock('@/lib/ai-platform/appliers/record-edits', () => ({ applyUndo: vi.fn() }))
vi.mock('@/lib/ai-platform/appliers/site-undo-verdict', () => ({ undoVerdict: vi.fn() }))

import { getCurrentUser } from '@/lib/auth'
import { agentDisplayName, signAgentContextToken, type AgentActor } from '@/lib/ai-platform/context'
import { handleAgentProxy } from '@/lib/ai-platform/agent-proxy'
import { applyUndo } from '@/lib/ai-platform/appliers/record-edits'
import { undoVerdict } from '@/lib/ai-platform/appliers/site-undo-verdict'
import { aiPlatformJson } from '@/lib/ai-platform/upstream'
import { agentPanelLabels } from '@/components/agent/agent-panel-labels'
import type { PlatformUser } from '@/types/user'

const SECRET = 'test-context-secret-at-least-32-characters'
const user = (over: Partial<PlatformUser> = {}): PlatformUser => ({ id: '3', email: 'chong.wei@shop.my', createdAt: '', updatedAt: '', ...over })
const actor = (over: Partial<PlatformUser> = {}): AgentActor => ({ user: user(over), tenantId: '1', organizationId: 'org_1', role: 'viewer' })
const claims = async (token: string) => (await jwtVerify(token, new TextEncoder().encode(SECRET))).payload

const env = { ...process.env }
beforeEach(() => {
    process.env.AI_PLATFORM_CONTEXT_SECRET = SECRET
    process.env.AI_PLATFORM_URL = 'http://ai.test'
    vi.mocked(aiPlatformJson).mockReset()
    vi.mocked(applyUndo).mockReset()
    vi.mocked(undoVerdict).mockReset()
})
afterEach(() => {
    process.env = { ...env }
})

describe('the context token names who asks [TC-AISEC-079]', () => {
    it('TC-AISEC-079: signs first + last name with the role; the email local part when there is no name', async () => {
        // Act
        const named = await claims(await signAgentContextToken(actor({ firstName: ' Chong ', lastName: 'Wei' })))
        const unnamed = await claims(await signAgentContextToken(actor()))

        // Assert
        expect(named).toMatchObject({ name: 'Chong Wei', role: 'viewer', org: 'org_1' })
        expect(unnamed.name).toBe('chong.wei')
    })

    it('TC-AISEC-079: the display name is at most 80 characters, and absent when nothing usable is left', () => {
        expect(agentDisplayName({ firstName: 'A'.repeat(70), lastName: 'B'.repeat(30), email: 'x@y.z' })).toHaveLength(80)
        expect(agentDisplayName({ firstName: '  ', lastName: undefined, email: '' })).toBeUndefined()
        expect(agentDisplayName({ firstName: 'Siti', lastName: undefined, email: 'siti@shop.my' })).toBe('Siti')
    })
})

const card = (access?: { canDecide: boolean; reason?: string }, status = 'applied') => ({
    id: 'cs_a',
    runId: 'run_1',
    domain: 'webbuilder',
    title: 'Change cs_a',
    summary: '',
    risk: 'low',
    blastRadius: { kind: 'site_page', count: 1, label: '1 section' },
    diffs: [{ entity: { kind: 'site_page', id: '12' }, field: 'headline', before: 'a', after: 'b', provenance: 'generated' }],
    guardrails: [],
    status,
    stagedBy: 'agent',
    stagedAt: '2026-10-22T01:00:00Z',
    expiresAt: '2999-01-01T00:00:00Z',
    action: { kind: 'site.page_patch', payload: {} },
    result: { entities: [], links: [], undo: { kind: 'site.page_restore', payload: { siteId: '1', pageId: '12', restore: [] }, until: '2999-01-01T00:00:00Z' } },
    requestedBy: { id: 'usr_3', name: 'Chong Wei' },
    mine: true,
    ...(access ? { access } : {}),
})
const post = (path: string) =>
    handleAgentProxy(
        new NextRequest(`http://localhost:3000/api/agent/change-sets/cs_a/${path}`, { method: 'POST', headers: { host: 'localhost:3000', 'content-type': 'application/json', 'x-workspace-id': '1' }, body: '{}' }),
        ['change-sets', 'cs_a', path],
    )

describe('Undo and reconcile follow the platform\'s access [TC-AISEC-079]', () => {
    beforeEach(() => {
        // a viewer of workspace 1 who passed the OTP step
        vi.mocked(getCurrentUser).mockResolvedValue({
            ...user({ firstName: 'Chong', lastName: 'Wei' }),
            tenants: [{ tenant: { id: '1', metaData: { organizationId: 'org_1' } }, role: 'viewer', status: 'active' }],
        } as PlatformUser)
    })

    it('TC-AISEC-079: a viewer\'s Undo is refused with the plain sentence and nothing is written', async () => {
        // Arrange
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(card({ canDecide: false, reason: 'needs_owner_or_admin' }))

        // Act
        const response = await post('undo')

        // Assert
        expect(response.status).toBe(403)
        expect((await response.json()).detail).toBe('An owner or admin needs to undo this.')
        expect(applyUndo).not.toHaveBeenCalled()
        expect(vi.mocked(aiPlatformJson).mock.calls.map(([arg]) => arg.method)).toEqual(['GET'])
    })

    it('TC-AISEC-079: reconcile reports the page but does not settle a card the caller may not decide', async () => {
        // Arrange
        vi.mocked(aiPlatformJson).mockResolvedValueOnce(card({ canDecide: false, reason: 'needs_owner_or_admin' }))
        vi.mocked(undoVerdict).mockResolvedValue('reverted')

        // Act
        const body = await (await post('reconcile')).json()

        // Assert
        expect(body).toMatchObject({ verdict: 'reverted', changeSet: { status: 'applied', mine: true, access: { canDecide: false } } })
        expect(vi.mocked(aiPlatformJson).mock.calls.map(([arg]) => arg.method)).toEqual(['GET'])
    })
})

describe('dashboard labels [TC-AISEC-079]', () => {
    it('TC-AISEC-079: Malay and Vietnamese say who asked and why a draft waits', () => {
        expect(agentPanelLabels('ms').draft).toMatchObject({ askedBy: 'Diminta oleh {name}', needsOwnerOrAdmin: 'Pemilik atau admin perlu meluluskan ini.' })
        expect(agentPanelLabels('vi').draft).toMatchObject({ askedBy: '{name} yêu cầu', needsOwnerOrAdmin: 'Cần chủ cửa hàng hoặc quản trị viên duyệt.' })
    })
})

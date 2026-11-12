/**
 * TC-F15.46..53 — Studio team seats: each team changes only its own area, nobody approves their own
 * template or closes their own bug, and every write route has a guard.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'

const { getCurrentUser, findByID, create, update, redirect } = vi.hoisted(() => ({
    redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`) }),
    getCurrentUser: vi.fn(),
    findByID: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ getCurrentUser, authUnavailableResponse: vi.fn(), isAuthUnavailableError: () => false }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ findByID, create, update })) }))

import { withStudioPermission } from '@/lib/admin/api-utils'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import {
    canEditTemplateContent,
    canPatchTemplate,
    canSetIssueStatus,
    canSetTemplateStatus,
    listStudioPermissions,
    STUDIO_PERMISSIONS,
} from '@/lib/admin/studio-permissions'
import { canUseMerchantAccess, canViewStudio, hasStaffRole, isStudioReadOnly, isStudioTeamSeat } from '@/lib/admin/studio-roles'
import { POST as createTemplate } from '@/app/api/admin/templates/route'
import { PATCH as patchTemplate } from '@/app/api/admin/templates/[id]/route'
import { POST as bulkTemplates } from '@/app/api/admin/templates/bulk/route'
import { POST as migrationAction } from '@/app/api/qa/migration-diff/route'
import { POST as createIssue } from '@/app/api/admin/issues/route'
import { POST as rejectTemplate } from '@/app/api/admin/review/reject/route'
import { middleware } from '@/middleware'

const CONTENT = ['studio-content']
const REVIEWER = ['studio-reviewer']
const QA = ['studio-qa']
const OPS = ['studio-ops']
const SEATS = [CONTENT, REVIEWER, QA, OPS]

const signedIn = (roles: string[]) => getCurrentUser.mockResolvedValue({ id: 7, email: 'team@primecommerce.asia', roles })
const jsonRequest = (url: string, method: string, body: unknown) =>
    new NextRequest(`https://prime.test${url}`, { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
    vi.clearAllMocks()
    create.mockImplementation(async ({ data }) => ({ id: 1, ...data }))
    update.mockImplementation(async ({ data }) => ({ id: 1, ...data }))
})

describe('[TC-F15.46] team seat helpers', () => {
    it.each(SEATS)('TC-F15.46: %s opens Studio as a working seat and counts as staff', (role) => {
        expect(canViewStudio([role])).toBe(true)
        expect(isStudioTeamSeat([role])).toBe(true)
        expect(isStudioReadOnly([role])).toBe(false)
        expect(hasStaffRole([role])).toBe(true)
        expect(canUseMerchantAccess([role])).toBe(false)
    })

    it('TC-F15.46: a QA who also holds support keeps both', () => {
        expect(canViewStudio(['studio-qa', 'support'])).toBe(true)
        expect(canUseMerchantAccess(['studio-qa', 'support'])).toBe(true)
    })

    it('TC-F15.46: support alone and tenant roles do not open Studio', () => {
        expect(canViewStudio(['support'])).toBe(false)
        expect(canViewStudio(['tenant-owner'])).toBe(false)
    })
})

describe('[TC-F15.47] permission table', () => {
    it('TC-F15.47: super-admin holds every permission and a viewer none', () => {
        expect(listStudioPermissions(['super-admin'])).toEqual([...STUDIO_PERMISSIONS])
        expect(listStudioPermissions(['studio-viewer'])).toEqual([])
    })

    it.each([
        [CONTENT, ['template.edit', 'block.edit', 'pack.edit', 'category.edit', 'qa.visual'], ['template.review', 'pack.delete', 'issue.close', 'data.export']],
        [REVIEWER, ['template.review', 'pack.delete', 'issue.close', 'issue.bulk', 'data.export'], ['template.edit', 'template.create', 'qa.run']],
        [QA, ['qa.run', 'qa.triage', 'generation.verify', 'issue.close', 'migration.review'], ['template.edit', 'template.review', 'generation.retry', 'migration.ingest']],
        [OPS, ['generation.retry', 'qa.run', 'migration.ingest', 'issue.work'], ['template.edit', 'template.review', 'issue.close', 'qa.triage', 'migration.review']],
    ])('TC-F15.47: %s holds its own area only', (roles, allowed, refused) => {
        const held = listStudioPermissions(roles)
        expect(held).toEqual(expect.arrayContaining(allowed))
        for (const permission of refused) expect(held).not.toContain(permission)
    })

    it('TC-F15.47: no seat both edits and approves a template', () => {
        for (const roles of SEATS) {
            const held = listStudioPermissions(roles)
            expect(held.includes('template.edit') && held.includes('template.review')).toBe(false)
        }
    })
})

describe('[TC-F15.48] template lifecycle', () => {
    it('TC-F15.48: content edits drafts and sends them for review', () => {
        expect(canEditTemplateContent(CONTENT, 'draft')).toBe(true)
        expect(canSetTemplateStatus(CONTENT, 'draft', 'review')).toBe(true)
        expect(canSetTemplateStatus(CONTENT, 'draft', 'archived')).toBe(true)
    })

    it.each(['live', 'scheduled'])('TC-F15.48: content cannot move a template to %s', (target) => {
        expect(canSetTemplateStatus(CONTENT, 'review', target)).toBe(false)
    })

    it.each(['live', 'scheduled', 'archived'])('TC-F15.48: content cannot edit a template that is %s', (status) => {
        expect(canEditTemplateContent(CONTENT, status)).toBe(false)
        expect(canPatchTemplate(CONTENT, status, { name: 'x' })).toBe(false)
    })

    it('TC-F15.48: content cannot pull a live template back or archive it', () => {
        expect(canSetTemplateStatus(CONTENT, 'live', 'draft')).toBe(false)
        expect(canSetTemplateStatus(CONTENT, 'live', 'archived')).toBe(false)
    })

    it('TC-F15.48: reviewer publishes and pulls back, but does not edit content', () => {
        expect(canPatchTemplate(REVIEWER, 'review', { status: 'live' })).toBe(true)
        expect(canPatchTemplate(REVIEWER, 'live', { status: 'draft' })).toBe(true)
        expect(canPatchTemplate(REVIEWER, 'draft', { status: 'scheduled', scheduledFor: '2026-12-01T00:00:00.000Z' })).toBe(true)
        expect(canPatchTemplate(REVIEWER, 'draft', { name: 'x' })).toBe(false)
    })

    it('TC-F15.48: content cannot set a publish time', () => {
        expect(canPatchTemplate(CONTENT, 'draft', { scheduledFor: '2026-12-01T00:00:00.000Z' })).toBe(false)
    })

    it('TC-F15.48: a seat with no template rights cannot patch', () => {
        expect(canPatchTemplate(QA, 'draft', {})).toBe(false)
        expect(canPatchTemplate(OPS, 'draft', { status: 'review' })).toBe(false)
    })

    it('TC-F15.48: PATCH route refuses content on a live template and saves a draft', async () => {
        // Arrange
        signedIn(CONTENT)
        const ctx = { params: Promise.resolve({ id: '5' }) }
        findByID.mockResolvedValueOnce({ id: 5, status: 'live' })

        // Act
        const refused = await patchTemplate(jsonRequest('/api/admin/templates/5', 'PATCH', { name: 'x' }), ctx)

        // Assert
        expect(refused.status).toBe(403)
        expect(update).not.toHaveBeenCalled()

        // Arrange
        findByID.mockResolvedValueOnce({ id: 5, status: 'draft' })

        // Act
        const saved = await patchTemplate(jsonRequest('/api/admin/templates/5', 'PATCH', { name: 'x' }), ctx)

        // Assert
        expect(saved.status).toBe(200)
        expect(update).toHaveBeenCalledOnce()
    })
})

describe('[TC-F15.49] issue closing', () => {
    it('TC-F15.49: ops moves work forward but does not close or reopen', () => {
        expect(canSetIssueStatus(OPS, 'in_progress', 'dev_fixed')).toBe(true)
        expect(canSetIssueStatus(OPS, 'testing', 'done')).toBe(false)
        expect(canSetIssueStatus(OPS, 'done', 'reopen')).toBe(false)
        expect(canSetIssueStatus(OPS, 'done', 'in_progress')).toBe(false)
    })

    it.each([[QA], [REVIEWER]])('TC-F15.49: %s closes and reopens', (roles) => {
        expect(canSetIssueStatus(roles, 'testing', 'done')).toBe(true)
        expect(canSetIssueStatus(roles, 'done', 'reopen')).toBe(true)
    })
})

describe('[TC-F15.50] permission guard', () => {
    const request = () => new NextRequest('https://prime.test/api/admin/x', { method: 'POST' })
    const okHandler = () => vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))

    it('TC-F15.50: passes a seat holding the permission', async () => {
        signedIn(OPS)
        const handler = okHandler()
        const response = await withStudioPermission('generation.retry', handler)(request())
        expect(response.status).toBe(200)
        expect(handler).toHaveBeenCalledOnce()
    })

    it.each([[CONTENT], [REVIEWER], [QA], [['studio-viewer']], [['tenant-owner']]])('TC-F15.50: refuses %s before the handler', async (roles) => {
        signedIn(roles)
        const handler = okHandler()
        const response = await withStudioPermission('generation.retry', handler)(request())
        expect(response.status).toBe(403)
        expect(handler).not.toHaveBeenCalled()
    })

    it('TC-F15.50: answers 401 when signed out', async () => {
        getCurrentUser.mockResolvedValue(null)
        const response = await withStudioPermission('generation.retry', okHandler())(request())
        expect(response.status).toBe(401)
    })
})

describe('[TC-F15.51] routes with several actions', () => {
    const newTemplate = { name: 'New', category: ['food'], status: 'live', scheduledFor: '2026-12-01T00:00:00.000Z' }

    it('TC-F15.51: a template created by content is always a draft', async () => {
        signedIn(CONTENT)
        const response = await createTemplate(jsonRequest('/api/admin/templates', 'POST', newTemplate))
        expect(response.status).toBeLessThan(300)
        expect(create.mock.calls[0][0].data).toMatchObject({ status: 'draft', scheduledFor: undefined })
    })

    it('TC-F15.51: a reviewer may create a live template', async () => {
        signedIn(['studio-reviewer', 'studio-content'])
        await createTemplate(jsonRequest('/api/admin/templates', 'POST', newTemplate))
        expect(create.mock.calls[0][0].data.status).toBe('live')
    })

    it.each(['publish', 'schedule'])('TC-F15.51: content cannot bulk %s', async (action) => {
        signedIn(CONTENT)
        const response = await bulkTemplates(jsonRequest('/api/admin/templates/bulk', 'POST', { ids: [1], action, scheduledFor: '2026-12-01T00:00:00.000Z' }))
        expect(response.status).toBe(403)
        expect(update).not.toHaveBeenCalled()
    })

    it('TC-F15.51: bulk archive by content skips live templates and archives drafts', async () => {
        // Arrange
        signedIn(CONTENT)
        findByID.mockImplementation(async ({ id }) => ({ id, status: id === 1 ? 'live' : 'draft' }))

        // Act
        const response = await bulkTemplates(jsonRequest('/api/admin/templates/bulk', 'POST', { ids: [1, 2], action: 'archive' }))
        const { data } = await response.json()

        // Assert
        expect(data).toMatchObject({ succeeded: 1, failed: 1 })
        expect(update).toHaveBeenCalledOnce()
        expect(update.mock.calls[0][0].id).toBe(2)
    })

    it.each([
        ['approve_pass', QA, 200],
        ['approve_pass', OPS, 403],
        ['scan_batch', OPS, 200],
        ['scan_batch', CONTENT, 403],
        ['ingest_json', OPS, 200],
        ['ingest_json', QA, 403],
        ['test_db_connection', QA, 403],
        ['not_a_real_action', QA, 403],
    ])('TC-F15.51: migration action %s for %s answers %i', async (action, roles, status) => {
        signedIn(roles as string[])
        const response = await migrationAction(jsonRequest('/api/qa/migration-diff', 'POST', { action, storeId: '12', payload: [] }))
        expect(response.status).toBe(status)
    })
})

describe('[TC-F15.52] nothing left open', () => {
    const routeFiles = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return routeFiles(path)
        return name === 'route.ts' ? [path] : []
    })
    // Called by machines with a signature, or check the role in their own body.
    const OWN_AUTH = ['qa/ingest', 'qa/targeted-start', 'qa/evidence', 'broadcasts', 'harness/gen', 'seed-image-library', 'merchant-access', 'admin/me', 'ai-providers']

    it('TC-F15.52: every write route under Studio APIs has a guard', () => {
        const files = [...routeFiles('src/app/api/admin'), ...routeFiles('src/app/api/qa')]
        const unguarded = files.filter((file) => {
            if (OWN_AUTH.some((path) => file.includes(path))) return false
            const source = readFileSync(file, 'utf8')
            return /export\s+(async\s+)?(function|const)\s+(POST|PUT|PATCH|DELETE)\b/.test(source) && !/withSuperAdmin\(|withStudioPermission\(|withStudioSeat\(/.test(source)
        })
        expect(files.length).toBeGreaterThan(50)
        expect(unguarded).toEqual([])
    })

    it('TC-F15.52: AI settings writes stay on the super-admin guard', () => {
        for (const file of ['src/app/api/admin/ai-settings/route.ts', 'src/app/api/admin/ai-settings/shops/[tenantId]/route.ts']) {
            expect(readFileSync(file, 'utf8')).not.toContain('withStudioPermission(')
        }
    })

    it.each(['studio-content', 'studio-reviewer', 'studio-qa', 'studio-ops'])('TC-F15.52/44: %s cannot open Studio merchant access, even with support', async (role) => {
        for (const roles of [[role], [role, 'support']]) {
            // Arrange
            const token = await new SignJWT({ id: 9, roles })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('1h')
                .sign(new TextEncoder().encode('test-secret'))
            const req = new NextRequest('https://primeweb.app/studio/merchant-access', {
                headers: { cookie: `payload-token=${token}`, host: 'primeweb.app' },
            })
            // Act
            const response = await middleware(req)
            // Assert
            expect(new URL(response.headers.get('location')!).pathname).toBe('/studio')
        }
    })

    it('TC-F15.52: a token without the roles claim reaches the layout, which checks the real roles', async () => {
        const token = await new SignJWT({ id: 9 })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('1h')
            .sign(new TextEncoder().encode('test-secret'))
        const response = await middleware(new NextRequest('https://primeweb.app/studio/templates', { headers: { cookie: `payload-token=${token}`, host: 'primeweb.app' } }))
        expect(response.headers.get('location')).toBeNull()
    })

    it('TC-F15.52: without the roles claim Studio settings rely on the page guard, and every settings page has one', async () => {
        const token = await new SignJWT({ id: 9 })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('1h')
            .sign(new TextEncoder().encode('test-secret'))
        const response = await middleware(new NextRequest('https://primeweb.app/studio/settings/ai', { headers: { cookie: `payload-token=${token}`, host: 'primeweb.app' } }))
        expect(response.headers.get('location')).toBeNull()

        const pages = (readdirSync('src/app/studio/settings', { recursive: true }) as string[]).filter((file) => file.endsWith('page.tsx'))
        expect(pages.length).toBeGreaterThan(0)
        const unguarded = pages.filter((file) => {
            const source = readFileSync(join('src/app/studio/settings', file), 'utf8')
            return !source.includes('requireSuperAdmin()') && !/redirect\('\/studio\/settings/.test(source)
        })
        expect(unguarded).toEqual([])
    })

    it.each(SEATS)('TC-F15.52: the settings page guard sends %s back to Studio by its real roles', async (role) => {
        signedIn([role])
        await expect(requireSuperAdmin()).rejects.toThrow('REDIRECT:/studio')
    })

    it.each(SEATS)('TC-F15.52: %s is sent back from Studio settings but opens Studio', async (role) => {
        const token = await new SignJWT({ id: 9, roles: [role] })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('1h')
            .sign(new TextEncoder().encode('test-secret'))
        const at = (path: string) => new NextRequest(`https://primeweb.app${path}`, { headers: { cookie: `payload-token=${token}`, host: 'primeweb.app' } })

        const settings = await middleware(at('/studio/settings/ai'))
        const home = await middleware(at('/studio/templates'))

        expect(settings.headers.get('location')).toMatch(/\/studio$/)
        expect(home.headers.get('location')).toBeNull()
    })
})

describe('[TC-F15.53] issues and rejects', () => {
    it.each(['done', 'reopen'])('TC-F15.53: a seat without issue.close cannot file an issue as %s', async (status) => {
        signedIn(OPS)
        const response = await createIssue(jsonRequest('/api/admin/issues', 'POST', { title: 'x', status }))
        expect(response.status).toBe(403)
        expect(create).not.toHaveBeenCalled()
    })

    it('TC-F15.53: QA may file a closed issue', async () => {
        signedIn(QA)
        const response = await createIssue(jsonRequest('/api/admin/issues', 'POST', { title: 'x', status: 'done' }))
        expect(response.status).toBe(201)
    })

    it('TC-F15.53: a seat is recorded as the reporter whatever the body says', async () => {
        signedIn(OPS)
        await createIssue(jsonRequest('/api/admin/issues', 'POST', { title: 'x', reportedBy: 99 }))
        expect(create.mock.calls[0][0].data.reportedBy).toBe(7)
    })

    it('TC-F15.53: reject files a backlog issue and returns the template to draft', async () => {
        signedIn(REVIEWER)
        findByID.mockResolvedValue({ id: 5, status: 'review' })
        const response = await rejectTemplate(jsonRequest('/api/admin/review/reject', 'POST', { templateId: 5, issueTitle: 'Fix hero' }))
        expect(response.status).toBe(200)
        expect(create.mock.calls[0][0].data.status).toBe('backlog')
        expect(update.mock.calls[0][0].data.status).toBe('draft')
    })

    it('TC-F15.53: a failed issue leaves the template in review', async () => {
        signedIn(REVIEWER)
        findByID.mockResolvedValue({ id: 5, status: 'review' })
        create.mockRejectedValueOnce(new Error('invalid'))
        const response = await rejectTemplate(jsonRequest('/api/admin/review/reject', 'POST', { templateId: 5, issueTitle: 'Fix hero' }))
        expect(response.status).toBe(500)
        expect(update).not.toHaveBeenCalled()
    })
})

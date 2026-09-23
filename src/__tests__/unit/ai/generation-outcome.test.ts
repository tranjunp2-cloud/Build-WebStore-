import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { finalizeGenerationOutcome, normalizeGenerationIncident } from '@/lib/ai/generation-outcome'
import { captureRejectedWebsiteGeneration, finishWebsiteCapture } from '@/lib/ai/capture-generation'

describe('finalizeGenerationOutcome', () => {
    it('TC-F41-26: persists an allowlisted input incident without a submitted value', () => {
        // Arrange
        const submittedValue = 'private-business@example.com'

        // Act
        const incident = normalizeGenerationIncident(new Error(`validation failed: ${submittedValue}`), {
            phase: 'validate',
            locationType: 'input',
            locationKey: 'businessInfo.businessName',
            code: 'FORM_INVALID',
            category: 'input_validation',
            validationRule: 'required',
            observedState: 'missing',
            operatorMessage: 'Tên doanh nghiệp là bắt buộc.',
            sanitizedTechnicalMessage: `FORM_INVALID value=${submittedValue}`,
        })

        // Assert
        expect(incident).toMatchObject({
            phase: 'validate', locationType: 'input', locationKey: 'businessInfo.businessName',
            locationLabel: 'Tên doanh nghiệp', validationRule: 'required', observedState: 'missing',
            code: 'FORM_INVALID', category: 'input_validation',
        })
        expect(JSON.stringify(incident)).not.toContain(submittedValue)
    })

    it('TC-F41-26: marks an unsupported location as Unknown instead of persisting a raw key', () => {
        // Arrange
        const rawLocation = 'businessInfo.private note: private-business@example.com'

        // Act
        const incident = normalizeGenerationIncident(undefined, {
            phase: 'validate', locationType: 'input', locationKey: rawLocation,
            code: 'FORM_INVALID', category: 'input_validation', observedState: 'unknown',
        })

        // Assert
        expect(incident.locationKey).toBeUndefined()
        expect(incident.locationLabel).toBeUndefined()
        expect(JSON.stringify(incident)).not.toContain(rawLocation)
    })

    it('TC-F41-26: stores an authenticated rejected form as a terminal incident without its body', async () => {
        // Arrange
        const create = vi.fn().mockResolvedValue({ id: 71 })
        const privateValue = 'private-business@example.com'

        // Act
        await captureRejectedWebsiteGeneration({
            userId: 3,
            tenantId: 8,
            traceId: 'request-71',
            issues: [
                { path: ['businessInfo', 'businessName'], code: 'too_small', minimum: 1 },
                { path: ['businessInfo', 'products'], code: 'too_small', minimum: 1 },
            ],
            payload: { create } as never,
        })

        // Assert
        const data = create.mock.calls[0]?.[0].data
        expect(data).toMatchObject({
            user: 3, tenant: 8, lifecycle: 'terminal', outcome: 'failed', recoveryStatus: 'none',
            generationErrors: [expect.objectContaining({
                phase: 'validate', locationType: 'input', locationKey: 'businessInfo.businessName',
                locationLabel: 'Tên doanh nghiệp', validationRule: 'required', observedState: 'missing',
            }), expect.objectContaining({ locationKey: 'businessInfo.products' })],
        })
        expect(data).not.toHaveProperty('inputSnapshot')
        expect(JSON.stringify(data)).not.toContain(privateValue)
    })

    it('TC-F41-02: does not report success when site persistence fails after composition', () => {
        // Arrange
        const input = {
            expectedPages: 5,
            persistedPages: [],
            failedPages: [],
            terminalError: new Error('insert into pages failed at /vercel/path0/route.ts'),
            terminalErrorPhase: 'site_persist' as const,
        }

        // Act
        const result = finalizeGenerationOutcome(input)

        // Assert
        expect(result.outcome).toBe('failed')
        expect(result.errors[0]).toMatchObject({ code: 'SITE_PERSISTENCE_FAILED', phase: 'site_persist' })
        expect(result.errors[0]?.sanitizedTechnicalMessage).toBe('Normalized diagnostic: SITE_PERSISTENCE_FAILED.')
    })

    it('TC-F41-02: classifies a composition timeout without inventing a persistence failure', () => {
        // Arrange
        const input = {
            expectedPages: 0,
            persistedPages: [],
            failedPages: [],
            terminalError: new Error('OpenAI request timed out'),
            terminalErrorPhase: 'composition' as const,
        }

        // Act
        const result = finalizeGenerationOutcome(input)

        // Assert
        expect(result).toMatchObject({ outcome: 'failed' })
        expect(result.errors[0]).toMatchObject({
            phase: 'composition', category: 'composition', code: 'GENERATION_TIMEOUT',
        })
    })

    it('TC-F41-02: never reports a zero-page run as succeeded', () => {
        // Arrange
        const input = { expectedPages: 0, persistedPages: [], failedPages: [] }

        // Act
        const result = finalizeGenerationOutcome(input)

        // Assert
        expect(result.outcome).toBe('failed')
    })

    it('TC-F41-03: records a partial result with four persisted pages and one failed page', () => {
        // Arrange
        const input = {
            expectedPages: 5,
            persistedPages: [
                { key: 'home', slug: '/', title: 'Home' },
                { key: 'about', slug: 'about', title: 'About' },
                { key: 'products', slug: 'products', title: 'Products' },
                { key: 'contact', slug: 'contact', title: 'Contact' },
            ],
            failedPages: [{ key: 'blog', slug: 'blog', title: 'Blog', error: new Error('timeout') }],
        }

        // Act
        const result = finalizeGenerationOutcome(input)

        // Assert
        expect(result.outcome).toBe('partial_failed')
        expect(result.pageSummary).toEqual({ expected: 5, persisted: 4, failed: 1 })
        expect(result.pageOutcomes.find((page) => page.pageKey === 'blog')).toMatchObject({ status: 'failed' })
        expect(result.errors[0]).toMatchObject({ code: 'PERSISTENCE_TIMEOUT', locationKey: 'blog' })
    })

    it('TC-F41-26: never persists a generated page title inside the incident record', () => {
        // Arrange
        const privateTitle = 'Liên hệ private-business@example.com token=private-token'

        // Act
        const result = finalizeGenerationOutcome({
            expectedPages: 1,
            persistedPages: [],
            failedPages: [{ key: 'contact', slug: 'contact', title: privateTitle, error: new Error('page write failed') }],
        })

        // Assert
        expect(result.errors[0]).toMatchObject({ locationType: 'page', locationKey: 'contact' })
        expect(result.errors[0]).toHaveProperty('locationLabel', 'Trang bị ảnh hưởng')
        expect(JSON.stringify(result.errors[0])).not.toContain(privateTitle)
        expect(JSON.stringify(result.errors[0])).not.toContain('private-token')
    })

    it('TC-F41-04: preserves only bounded, sanitized operator evidence', () => {
        // Arrange
        const input = {
            expectedPages: 1,
            persistedPages: [],
            failedPages: [{
                key: 'home', slug: '/', title: 'Home',
                error: 'password=super-secret token=abc prompt=private-business@example.com /home/runner/app/route.ts',
            }],
        }

        // Act
        const result = finalizeGenerationOutcome(input)

        // Assert
        expect(result.errors[0]?.operatorMessage).toBe('Hệ thống chưa thể lưu một trang của website.')
        expect(result.errors[0]?.sanitizedTechnicalMessage).toBe('Normalized diagnostic: PAGE_PERSISTENCE_FAILED.')
        expect(JSON.stringify(result.errors[0])).not.toContain('super-secret')
        expect(JSON.stringify(result.errors[0])).not.toContain('private-business@example.com')
        expect(JSON.stringify(result.errors[0])).not.toContain('/home/runner')
        expect(result.userSafeMessage).not.toContain('PAGE_PERSISTENCE_FAILED')
    })

    it('TC-F41-04: redacts bearer authorization and cookie values completely', () => {
        // Arrange
        const input = {
            expectedPages: 1,
            persistedPages: [],
            failedPages: [{
                key: 'home', slug: '/', title: 'Home',
                error: 'Authorization: Bearer secret-token Cookie: session=private-value',
            }],
        }

        // Act
        const result = finalizeGenerationOutcome(input)

        // Assert
        expect(JSON.stringify(result.errors[0])).not.toContain('secret-token')
        expect(JSON.stringify(result.errors[0])).not.toContain('private-value')
    })

    it('TC-F41-04: redacts JSON-shaped provider secrets', () => {
        // Arrange
        const input = {
            expectedPages: 1,
            persistedPages: [],
            failedPages: [{
                key: 'home', slug: '/', title: 'Home',
                error: '{"token":"private-provider-token","authorization":"Bearer private-bearer","client_secret":"secret-value"} sk-private-key',
            }],
        }

        // Act
        const result = finalizeGenerationOutcome(input)

        // Assert
        expect(JSON.stringify(result.errors[0])).not.toContain('private-provider-token')
        expect(JSON.stringify(result.errors[0])).not.toContain('private-bearer')
        expect(JSON.stringify(result.errors[0])).not.toContain('secret-value')
        expect(JSON.stringify(result.errors[0])).not.toContain('sk-private-key')
    })

    it('TC-F41-04: reports an explicit successful terminal state without error evidence', () => {
        // Arrange
        const input = {
            expectedPages: 1,
            persistedPages: [{ key: 'home', slug: '/', title: 'Home', id: 42, blockCount: 6 }],
            failedPages: [],
        }

        // Act
        const result = finalizeGenerationOutcome(input)

        // Assert
        expect(result).toMatchObject({
            outcome: 'succeeded',
            pageSummary: { expected: 1, persisted: 1, failed: 0 },
            errors: [],
            userSafeMessage: 'Website của bạn đã sẵn sàng.',
        })
        expect(result.pageOutcomes).toEqual([{
            pageKey: 'home', slug: '/', title: 'Home', pageId: '42', blockCount: 6, status: 'persisted',
        }])
    })

    it('TC-F41-02: terminal writer maps outcome once and never overwrites it', async () => {
        // Arrange
        const update = vi.fn().mockResolvedValue({ id: 42 })
        const findByID = vi.fn().mockResolvedValue({ id: 42, lifecycle: 'running' })
        const handle = {
            recordId: 42,
            startTime: Date.now() - 30,
            payload: { update, findByID },
            finalized: false,
        }

        // Act
        const first = await finishWebsiteCapture(handle, {
            expectedPages: 1,
            persistedPages: [],
            failedPages: [],
            terminalError: new Error('page write failed'),
            siteId: 7,
        })
        const second = await finishWebsiteCapture(handle, {
            expectedPages: 1,
            persistedPages: [{ key: 'home', slug: '/', title: 'Home' }],
            failedPages: [],
            siteId: 7,
        })

        // Assert
        expect(first).toBe(true)
        expect(second).toBe(true)
        expect(update).toHaveBeenCalledTimes(1)
        expect(update.mock.calls[0]?.[0].data).toMatchObject({
            lifecycle: 'terminal', outcome: 'failed', status: 'failed', site: 7,
        })
    })

    it.each(['AI_QUOTA_EXCEEDED', 'FORM_INVALID', 'INVALID_TEMPLATE_CONTRACT', 'INVALID_COMPONENT_CONTRACT', 'SITE_PERSISTENCE_FAILED'])('TC-F41-03: routes %s terminal evidence to ticket flow, never retry', async (message) => {
        // Arrange
        const update = vi.fn().mockResolvedValue({ id: 42 })
        const findByID = vi.fn().mockResolvedValue({ id: 42, lifecycle: 'running' })
        const handle = { recordId: 42, startTime: Date.now() - 30, payload: { update, findByID }, finalized: false }

        // Act
        await finishWebsiteCapture(handle, {
            expectedPages: 1,
            persistedPages: [],
            failedPages: [],
            terminalError: new Error(message),
            terminalErrorPhase: 'composition',
        })

        // Assert
        expect(update.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
            data: expect.objectContaining({ recoveryStatus: 'ticket_required' }),
        }))
    })

    it('TC-F41-05: keeps F41 array migrations idempotent and non-destructive', () => {
        // Arrange
        const migration = readFileSync(resolve(process.cwd(), 'scripts/db-setup.js'), 'utf8')

        // Act
        const f41Block = migration.slice(
            migration.indexOf("name: 'ai_generation_records.f41_columns'"),
            migration.indexOf('// ── Pages: Data cleanup for F05 Footer variants ──'),
        )

        // Assert
        expect(f41Block).toContain('ADD COLUMN IF NOT EXISTS lifecycle varchar')
        expect(f41Block).toContain('CREATE TABLE IF NOT EXISTS ai_generation_records_page_outcomes')
        expect(f41Block).toContain('CREATE TABLE IF NOT EXISTS ai_generation_records_generation_errors')
        expect(f41Block).toContain('location_label varchar, validation_rule varchar, observed_state varchar')
        expect(f41Block).toContain("name: 'ai_generation_records_generation_errors.structured_incident_columns'")
        expect(f41Block).toContain('ADD COLUMN IF NOT EXISTS location_label varchar')
        expect(f41Block).toMatch(/id varchar PRIMARY KEY DEFAULT gen_random_uuid\(\)::text/)
        expect(f41Block).toContain('_order integer NOT NULL DEFAULT 0')
        expect(f41Block).toContain('_parent_id integer NOT NULL REFERENCES ai_generation_records(id)')
        expect(f41Block).toContain('_uuid varchar NOT NULL DEFAULT gen_random_uuid()::text')
        expect(f41Block).not.toMatch(/DROP\s+TABLE/i)
    })

    it('TC-F41-05: adds isolated retry lineage and durable job guards idempotently', () => {
        // Arrange
        const migration = readFileSync(resolve(process.cwd(), 'scripts/db-setup.js'), 'utf8')
        const f41RetryBlock = migration.slice(
            migration.indexOf('// ── F41-03: durable, isolated website recovery queue ────────────────────'),
            migration.indexOf('// ── Pages: Data cleanup for F05 Footer variants ──'),
        )

        // Act
        const hasActiveChildGuard = f41RetryBlock.includes('ai_generation_records_one_active_retry_child_idx')
        const hasActiveJobGuard = f41RetryBlock.includes('generation_recovery_jobs_one_active_source_idx')

        // Assert
        expect(f41RetryBlock).toContain('ADD COLUMN IF NOT EXISTS parent_generation_id integer')
        expect(f41RetryBlock).toContain('ADD COLUMN IF NOT EXISTS tenant_id integer')
        expect(f41RetryBlock).toContain('ADD COLUMN IF NOT EXISTS retry_root_generation_id integer')
        expect(f41RetryBlock).toContain('CREATE TABLE IF NOT EXISTS generation_recovery_jobs')
        expect(f41RetryBlock).toContain('generation_recovery_jobs_source_retry_idempotency_uniq')
        expect(hasActiveChildGuard).toBe(true)
        expect(hasActiveJobGuard).toBe(true)
        expect(f41RetryBlock).not.toMatch(/DROP\s+TABLE/i)
    })
})

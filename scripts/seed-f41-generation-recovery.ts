/**
 * Local-only, idempotent UI fixture for F41-03.
 *
 * Creates one retry-eligible parent generation. It deliberately does not queue
 * a recovery job or invoke AI: the operator can exercise the real retry CTA.
 * Usage: npx tsx --require ./scripts/seed-preload.cjs scripts/seed-f41-generation-recovery.ts
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { hashGenerationSnapshot } from '../src/lib/ai/generation-snapshot-hash'

const OPERATOR_EMAIL = 'f41-ui-operator@primeweb.local'

async function getOrCreateOperator(password: string) {
    const payload = await getPayload({ config })
    const existing = await payload.find({
        collection: 'users',
        where: { email: { equals: OPERATOR_EMAIL } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
    })
    if (existing.docs[0]) return { payload, user: existing.docs[0] }

    const user = await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
            email: OPERATOR_EMAIL,
            password,
            firstName: 'F41',
            lastName: 'UI Operator',
            roles: ['super-admin'],
        },
    })
    return { payload, user }
}

async function main() {
    const password = process.env.F41_FIXTURE_PASSWORD
    if (!password || password.length < 12) {
        throw new Error('Set F41_FIXTURE_PASSWORD (at least 12 characters) before running this local-only seed.')
    }
    const { payload, user } = await getOrCreateOperator(password)
    const tenantSlug = 'f41-ui-fixture-lala-florist'
    const tenants = await payload.find({ collection: 'tenants', where: { slug: { equals: tenantSlug } }, limit: 1, depth: 0, overrideAccess: true })
    const tenant = tenants.docs[0] ?? await payload.create({ collection: 'tenants', overrideAccess: true, data: { name: 'Lala Florist · F41 UI fixture', slug: tenantSlug } })
    const snapshot = {
        businessInfo: { businessName: 'Lala Florist', industry: 'Hoa tươi & quà tặng', shortDescription: 'Đặt hoa sinh nhật, khai trương và giao nội thành.', products: 'Bó hoa, giỏ hoa, hoa chúc mừng.' },
        extraInstructions: 'Phong cách nhẹ nhàng, ưu tiên màu pastel.', language: 'vi', generationLocale: 'vi', contentBrief: null,
    }
    const inputHash = hashGenerationSnapshot(snapshot)
    const fixtures = [
        { key: 'component', siteName: 'Lala Florist · component lỗi', recoveryStatus: 'eligible', outcome: 'partial_failed', phase: 'component_persist', locationType: 'component', locationKey: 'products-gallery', code: 'INVALID_COMPONENT_CONTRACT', category: 'composition', message: 'Không thể tạo component Gallery.', retryable: true },
        { key: 'page', siteName: 'Mộc Home · trang lỗi', recoveryStatus: 'eligible', outcome: 'partial_failed', phase: 'page_persist', locationType: 'page', locationKey: 'contact', code: 'PAGE_GENERATION_FAILED', category: 'composition', message: 'Không tạo được trang Liên hệ.', retryable: true },
        { key: 'quota', siteName: 'Bình Minh Coffee · hết quota', recoveryStatus: 'ticket_required', outcome: 'failed', phase: 'composition', locationType: 'site', locationKey: null, code: 'AI_QUOTA_EXCEEDED', category: 'quota', message: 'Quota AI của website đã hết.', retryable: false },
        { key: 'system', siteName: 'An Nhiên Studio · dịch vụ AI', recoveryStatus: 'eligible', outcome: 'failed', phase: 'composition', locationType: 'site', locationKey: null, code: 'UPSTREAM_TIMEOUT', category: 'system', message: 'Dịch vụ AI không phản hồi trong thời gian cho phép.', retryable: true },
        { key: 'persistence', siteName: 'Sora Bakery · không lưu được', recoveryStatus: 'ticket_required', outcome: 'failed', phase: 'site_persist', locationType: 'site', locationKey: null, code: 'SITE_PERSISTENCE_FAILED', category: 'persistence', message: 'Không thể lưu website sau khi AI tạo nội dung.', retryable: false },
        // Keep one untouched escalation fixture so operators can open the
        // confirmation dialog and inspect the generated Dev handoff locally.
        { key: 'ticket-preview', siteName: 'Demo ticket Dev · chưa gửi', recoveryStatus: 'ticket_required', outcome: 'partial_failed', phase: 'page_persist', locationType: 'page', locationKey: 'about', code: 'PAGE_GENERATION_FAILED', category: 'persistence', message: 'Không thể lưu trang Giới thiệu sau khi AI tạo nội dung.', retryable: false },
        { key: 'ticket-handoff-preview', siteName: 'Demo ticket Dev · đủ context', recoveryStatus: 'ticket_required', outcome: 'partial_failed', phase: 'page_persist', locationType: 'page', locationKey: 'contact', code: 'PAGE_GENERATION_FAILED', category: 'persistence', message: 'Không thể lưu trang Liên hệ sau khi AI tạo nội dung.', retryable: false },
        { key: 'input', siteName: 'Nắng Spa · dữ liệu nhập lỗi', recoveryStatus: 'none', outcome: 'failed', phase: 'validate', locationType: 'input', locationKey: 'businessInfo.businessName', code: 'INVALID_INPUT', category: 'input_validation', message: 'Tên doanh nghiệp đang bị thiếu.', retryable: false, validationRule: 'required', observedState: 'missing' },
    ] as const

    let created = 0
    for (const fixture of fixtures) {
        const traceId = `f41-ui-fixture-${fixture.key}-v1`
        const pageOutcomes = fixture.key === 'page'
            ? [{ pageKey: 'contact', title: 'Liên hệ', slug: 'contact', status: 'failed', blockCount: 2, errorCode: fixture.code, errorSummary: 'Không thể tạo trang Liên hệ.' }]
            : fixture.key === 'component'
                ? [{ pageKey: 'products', title: 'Sản phẩm', slug: 'products', status: 'failed', blockCount: 4, errorCode: fixture.code, errorSummary: 'Component Gallery không thể tạo.' }]
                : []
        const existing = await payload.find({ collection: 'ai-generation-records', where: { traceId: { equals: traceId } }, limit: 1, depth: 0, overrideAccess: true })
        if (existing.docs[0]) {
            // Fixtures created before canonical hashing used insertion-order
            // JSON.stringify and cannot be retried after JSONB reload. Keep
            // this local-only seed idempotent while repairing its test data.
            await payload.update({ collection: 'ai-generation-records', id: existing.docs[0].id, overrideAccess: true, data: {
                inputSnapshot: snapshot, inputHash, inputSchemaVersion: 'f41.v1',
                recoveryStatus: fixture.recoveryStatus,
                pageOutcomes,
                generationErrors: [{ phase: fixture.phase, locationType: fixture.locationType, ...(fixture.locationKey ? { locationKey: fixture.locationKey } : {}), ...(fixture.validationRule ? { validationRule: fixture.validationRule, observedState: fixture.observedState } : {}), code: fixture.code, category: fixture.category, retryabilityReason: fixture.retryable ? 'transient_timeout' : 'requires_operator_review', operatorMessage: fixture.message, userSafeMessage: 'Đã ghi nhận lỗi. Xem detail để xử lý.', sanitizedTechnicalMessage: `Normalized diagnostic: ${fixture.code}.` }],
            } })
            continue
        }
        const site = await payload.create({
            collection: 'sites', overrideAccess: true,
            data: { tenant: tenant.id, name: fixture.siteName, status: 'draft', generationStatus: 'failed', siteType: 'business', locale: 'en', generationLocale: 'vi' },
        })
        await payload.create({
            collection: 'ai-generation-records', overrideAccess: true,
            data: {
                endpoint: 'site-generator', category: 'f41-ui-fixture', source: 'user_submit', tenant: tenant.id, user: user.id, site: site.id,
                promptMode: 'hashed', promptHash: inputHash, status: 'failed', lifecycle: 'terminal', outcome: fixture.outcome, recoveryStatus: fixture.recoveryStatus,
                traceId, inputSnapshot: snapshot, inputSchemaVersion: 'f41.v1', inputHash,
                pageSummary: { expected: 5, persisted: fixture.outcome === 'partial_failed' ? 4 : 0, failed: fixture.outcome === 'partial_failed' ? 1 : 5 },
                pageOutcomes,
                generationErrors: [{ phase: fixture.phase, locationType: fixture.locationType, ...(fixture.locationKey ? { locationKey: fixture.locationKey } : {}), ...(fixture.validationRule ? { validationRule: fixture.validationRule, observedState: fixture.observedState } : {}), code: fixture.code, category: fixture.category, retryabilityReason: fixture.retryable ? 'transient_timeout' : 'requires_operator_review', operatorMessage: fixture.message, userSafeMessage: 'Đã ghi nhận lỗi. Xem detail để xử lý.', sanitizedTechnicalMessage: `Normalized diagnostic: ${fixture.code}.` }],
                userSafeMessage: fixture.retryable ? 'Chúng tôi đang hoàn thiện website của bạn.' : 'Thông tin của bạn đã được lưu.', startedAt: new Date(Date.now() - 120_000).toISOString(), terminalAt: new Date(Date.now() - 10_000).toISOString(), lastHeartbeatAt: new Date(Date.now() - 10_000).toISOString(),
            },
        })
        created += 1
    }
    console.log(`F41 fixtures ready: ${created} created, ${fixtures.length - created} already existed; operator ${OPERATOR_EMAIL}`)
    console.log('Open /studio/generations, default Needs Attention, to compare each incident category. No retry job was queued by this seed.')
}

main().catch((error: unknown) => {
    console.error('Failed to create F41 UI fixture:', error instanceof Error ? error.message : error)
    process.exitCode = 1
})

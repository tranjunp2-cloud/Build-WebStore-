import { describe, expect, it } from 'vitest'
import { publishOrigin } from '@/lib/migration/pw1-publish'
import { buildBatchReport, batchReportCsv } from '@/lib/migration/pw1-batch-report'

describe('[TC-F35.M48] Automatic CLI publication', () => {
    it('accepts configured HTTPS and explicit local origins', () => {
        expect(publishOrigin('https://cms.example/')).toBe('https://cms.example')
        expect(publishOrigin('http://localhost:3000')).toBe('http://localhost:3000')
    })
    it.each([undefined,'http://cms.example','https://user:password@cms.example','https://cms.example/path','https://cms.example/?token=test','file:///tmp/site'])('rejects unsafe or missing origin %s', origin => {
        expect(()=>publishOrigin(origin)).toThrow()
    })
    it('keeps generation success separate from publication failure in JSON and CSV', () => {
        const report = buildBatchReport({id:'batch',status:'failed',started_at:'2026-09-17',finished_at:'2026-09-17',results:[
            {sourceStoreId:'1',status:'completed',publish:{status:'failed',attempts:3,error:'API unavailable'}},
            {sourceStoreId:'2',status:'skipped',publish:{status:'already-published',attempts:0}},
        ]},[])
        expect(report.totals).toMatchObject({completed:1,failed:0,publishFailed:1,published:1})
        expect(batchReportCsv(report)).toContain('"publish"')
        expect(batchReportCsv(report)).toContain('API unavailable')
    })
})

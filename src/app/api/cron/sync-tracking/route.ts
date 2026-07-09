import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { syncTrackingJob } from '@/lib/jobs/sync-tracking'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const payload = await getPayload({ config })
        const result = await syncTrackingJob(payload)
        return NextResponse.json({ success: true, ...result })
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

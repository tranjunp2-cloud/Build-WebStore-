import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'

export const GET = withAuth(async (user) => {
    try {
        const payload = await getPayload({ config })

        const countStatus = async (status: string) => {
            const res = await payload.find({
                collection: 'orders',
                where: { status: { equals: status } },
                limit: 0,
                depth: 0,
                user,
                overrideAccess: false,
            })
            return res.totalDocs
        }

        const [pending, readyToShip, confirmed, shipped] = await Promise.all([
            countStatus('pending'),
            countStatus('ready_to_ship'),
            countStatus('confirmed'),
            countStatus('shipped'),
        ])

        return NextResponse.json({
            success: true,
            data: {
                pending,
                readyToShip,
                confirmed,
                shipped,
            }
        })
    } catch (error: any) {
        return NextResponse.json({ success: false }, { status: 500 })
    }
})

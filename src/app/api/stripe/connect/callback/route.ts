import { NextResponse } from 'next/server'

// STRIPE_CONNECT_DISABLED — OAuth Connect flow deferred to Wave 7 (tracked in GH issue)
export async function GET() {
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/dashboard/settings/payments?stripe=refresh`)
}

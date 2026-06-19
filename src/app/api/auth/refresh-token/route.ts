import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getPayload } from 'payload';
import config from '@payload-config';
import { checkRateLimit } from '@/lib/rateLimit';

// Re-mints the payload-token cookie without going through Payload's built-in
// refresh-token endpoint, which is blocked by the Users collection access control.
// Verifies the existing token cryptographically, then issues a fresh 24h JWT.
export async function POST(req: NextRequest) {
    // Rate limiting: 10 attempts per minute per IP (mirrors sso-session pattern)
    const ip =
        req.headers.get('x-real-ip')?.trim() ||
        req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
        'unknown';
    const rateLimit = await checkRateLimit(`refresh-token:${ip}`, 10, 60_000);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'rate_limited' },
            {
                status: 429,
                headers: { 'Retry-After': String(Math.max(0, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
            },
        );
    }

    try {
        const secret = process.env.PAYLOAD_SECRET;
        if (!secret) {
            console.error('[refresh-token] PAYLOAD_SECRET is not defined');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const cookieStore = await cookies();
        const rawToken = cookieStore.get('payload-token')?.value;

        if (!rawToken) {
            return NextResponse.json({ error: 'No token found' }, { status: 401 });
        }

        // Verify JWT signature and extract claims — rejects forged or expired tokens
        const { jwtVerify, SignJWT } = await import('jose');
        const secretKey = new TextEncoder().encode(secret);

        let userId: string | number | undefined;
        try {
            const { payload } = await jwtVerify(rawToken, secretKey, { algorithms: ['HS256'] });
            userId = payload.id as string | number | undefined;
        } catch {
            // Covers: expired, invalid signature, malformed
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
        }

        if (!userId) {
            return NextResponse.json({ error: 'Token missing user id' }, { status: 401 });
        }

        // Use find() not findByID() — findByID throws NotFound on missing doc, producing 500 not 403
        const payloadClient = await getPayload({ config });
        const userResult = await payloadClient.find({
            collection: 'users',
            where: { id: { equals: userId } },
            limit: 1,
            depth: 1,
            overrideAccess: true,
        });
        const user = userResult.docs[0] ?? null;

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 403 });
        }

        // Suspended tenant check — mirrors sso-session/route.ts ban enforcement
        const userTenants = user.tenants as Array<{ tenant: string | number | { id: string | number } }> | undefined;
        if (userTenants && userTenants.length > 0) {
            const tenantIds = userTenants
                .map((t) => {
                    if (t.tenant == null) return null;
                    if (typeof t.tenant === 'object') return String((t.tenant as { id: string | number }).id);
                    return String(t.tenant);
                })
                .filter((tid): tid is string => Boolean(tid) && tid !== '0');
            if (tenantIds.length > 0) {
                const tenantResults = await Promise.all(
                    tenantIds.map((tid) =>
                        payloadClient.find({ collection: 'tenants', where: { id: { equals: tid } }, limit: 1, depth: 0 }),
                    ),
                );
                const allSuspended = tenantResults.every(
                    (r) => (r.docs[0] as { status?: string } | undefined)?.status === 'suspended',
                );
                if (allSuspended) {
                    return NextResponse.json({ error: 'account_suspended' }, { status: 403 });
                }
            }
        }

        // Mint a fresh JWT — same structure as OTP verification and sso-session paths
        const expSeconds = 60 * 60 * 24; // 24h
        const now = Math.floor(Date.now() / 1000);

        const newToken = await new SignJWT({
            id: user.id,
            email: user.email,
            collection: 'users',
            mfa_verified: true,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt(now)
            .setExpirationTime(now + expSeconds)
            .sign(secretKey);

        const response = NextResponse.json({ ok: true });
        response.cookies.set('payload-token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: expSeconds,
        });
        return response;
    } catch (error) {
        console.error('[refresh-token] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

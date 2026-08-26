import { z } from 'zod'
import { NextResponse } from 'next/server'

export async function parseRequest<T>(req: Request, schema: z.ZodType<T>) {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return {
            errorResponse: NextResponse.json(
                { success: false, error: { code: 'INVALID_JSON', details: 'Invalid JSON body' } },
                { status: 400 }
            )
        }
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
        return {
            errorResponse: NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } },
                { status: 400 }
            )
        }
    }

    return { data: parsed.data }
}

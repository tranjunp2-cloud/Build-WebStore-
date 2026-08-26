import { REST_DELETE, REST_GET, REST_PATCH, REST_POST } from '@payloadcms/next/routes'
import config from '@payload-config'
import { NextRequest } from 'next/server'

export const maxDuration = 60

export const GET = REST_GET(config)
export const DELETE = REST_DELETE(config)

/**
 * Wrapper for POST/PATCH: convert multipart/form-data → application/json.
 *
 * Payload CMS admin sends ALL mutations as multipart/form-data with a
 * `_payload` field containing JSON. On Vercel serverless, request.formData()
 * fails silently → Payload gets undefined body → 500.
 *
 * Fix: intercept multipart requests, extract _payload, reconstruct as JSON.
 * File uploads still work because they include actual file parts.
 */
function wrapWithFormDataFix(handler: (req: NextRequest, args: { params: Promise<{ slug: string[] }> }) => Promise<Response>) {
    return async (req: NextRequest, args: { params: Promise<{ slug: string[] }> }) => {
        const contentType = req.headers.get('content-type') || ''

        if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
            try {
                const formData = await req.formData()
                const payloadField = formData.get('_payload')

                // If _payload exists and no file uploads → convert to JSON request
                const hasFiles = Array.from(formData.entries()).some(
                    ([key, value]) => key !== '_payload' && value instanceof File
                )

                if (payloadField && !hasFiles) {
                    const jsonBody = typeof payloadField === 'string' ? payloadField : await (payloadField as File).text()
                    const newHeaders = new Headers(req.headers)
                    newHeaders.set('content-type', 'application/json')

                    const newReq = new NextRequest(req.url, {
                        method: req.method,
                        headers: newHeaders,
                        body: jsonBody,
                    })

                    return handler(newReq, args)
                }
            } catch {
                // formData() failed — try raw body fallback
                try {
                    const text = await req.text()
                    const match = text.match(new RegExp('"_payload"\\s*\\n\\n(.+?)(?:\\n--|$)', 's'))
                    if (match) {
                        const jsonBody = match[1].trim()
                        const newHeaders = new Headers(req.headers)
                        newHeaders.set('content-type', 'application/json')

                        const newReq = new NextRequest(req.url, {
                            method: req.method,
                            headers: newHeaders,
                            body: jsonBody,
                        })

                        return handler(newReq, args)
                    }
                } catch {
                    // Both methods failed — let Payload handle it
                }
            }
        }

        return handler(req, args)
    }
}

const payloadPost = REST_POST(config)
const payloadPatch = REST_PATCH(config)

export const POST = wrapWithFormDataFix(payloadPost as (req: NextRequest, args: { params: Promise<{ slug: string[] }> }) => Promise<Response>)
export const PATCH = wrapWithFormDataFix(payloadPatch as (req: NextRequest, args: { params: Promise<{ slug: string[] }> }) => Promise<Response>)

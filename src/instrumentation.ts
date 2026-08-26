/**
 * Next.js Instrumentation
 * Polyfills for Node.js 18 compatibility with undici
 * Fixes: ReferenceError: File is not defined
 */

export async function register() {
    // Node.js-only polyfills — node:buffer is not available in Edge Runtime
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Node 18 doesn't have File, Blob, FormData in globalThis
        // undici requires these at module-load time
        if (typeof globalThis.File === 'undefined') {
            const { File, Blob } = await import('node:buffer')
            // @ts-ignore
            globalThis.File = File
            // @ts-ignore
            if (typeof globalThis.Blob === 'undefined') globalThis.Blob = Blob
        }
        if (typeof globalThis.FormData === 'undefined') {
            // @ts-ignore — minimal FormData polyfill for Node 18
            globalThis.FormData = class FormData { }
        }

        await import('../sentry.server.config')
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('../sentry.edge.config')
    }
}

// Captures all server-side request errors (RSC, API routes, streaming)
export const onRequestError = async (...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) => {
    const { captureRequestError } = await import('@sentry/nextjs')
    return captureRequestError(...args)
}

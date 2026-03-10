/**
 * Next.js Instrumentation
 * Polyfills for Node.js 18 compatibility with undici
 * Fixes: ReferenceError: File is not defined
 */

export async function register() {
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
}

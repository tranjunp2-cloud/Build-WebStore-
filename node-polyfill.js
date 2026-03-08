/**
 * Node.js preload script for polyfilling File/Blob before undici loads.
 * Usage: NODE_OPTIONS="--require ./node-polyfill.js" npm run dev
 */
if (typeof globalThis.File === 'undefined') {
    const { File, Blob } = require('node:buffer')
    globalThis.File = File
    if (typeof globalThis.Blob === 'undefined') globalThis.Blob = Blob
}

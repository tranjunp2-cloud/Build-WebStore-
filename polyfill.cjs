/**
 * Node.js 18 polyfill for File global
 * Load via: NODE_OPTIONS='--require ./polyfill.cjs'
 * Required because undici (used by Payload CMS) references File at parse time
 */
if (typeof globalThis.File === 'undefined') {
    try {
        const { File } = require('node:buffer')
        globalThis.File = File
    } catch (e) {
        // Fallback — define minimal File class
        globalThis.File = class File extends Blob {
            constructor(bits, name, options = {}) {
                super(bits, options)
                this.name = name
                this.lastModified = options.lastModified || Date.now()
            }
        }
    }
}

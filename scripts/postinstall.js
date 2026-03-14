#!/usr/bin/env node
/**
 * Postinstall script to patch undici for Node 18 compatibility.
 * Adds File/Blob polyfill from node:buffer before undici uses them.
 * Never fails the build: all errors are caught and exit 0.
 */
const fs = require('fs')
const path = require('path')

function run() {
    const targetFile = path.join(__dirname, '..', 'node_modules/undici/lib/web/webidl/index.js')
    if (!fs.existsSync(targetFile)) {
        console.log('[postinstall] undici not found, skipping patch')
        return
    }

    let content
    try {
        content = fs.readFileSync(targetFile, 'utf8')
    } catch (e) {
        console.log('[postinstall] could not read undici file, skipping:', e.message)
        return
    }

    const patchMarker = '// Node 18 compatibility: polyfill File and Blob'
    if (content.includes(patchMarker)) {
        console.log('[postinstall] undici already patched')
        return
    }

    const target = 'webidl.is.ReadableStream = webidl.util.MakeTypeAssertion(ReadableStream)'
    if (!content.includes(target)) {
        console.log('[postinstall] undici version has different structure, skipping patch')
        return
    }

    const patch = `${patchMarker} if not in globalThis
if (typeof globalThis.File === 'undefined') { try { globalThis.File = require('node:buffer').File } catch(e) {} }
if (typeof globalThis.Blob === 'undefined') { try { globalThis.Blob = require('node:buffer').Blob } catch(e) {} }

${target}`

    try {
        content = content.replace(target, patch)
        fs.writeFileSync(targetFile, content, 'utf8')
        console.log('[postinstall] undici patched for Node 18')
    } catch (e) {
        console.log('[postinstall] could not write patch:', e.message)
    }
}

try {
    run()
} catch (err) {
    console.log('[postinstall] skipped:', err.message)
}
process.exit(0)

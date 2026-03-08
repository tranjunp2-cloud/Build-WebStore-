#!/usr/bin/env node
/**
 * Postinstall script to patch undici for Node 18 compatibility.
 * Adds File/Blob polyfill from node:buffer before undici uses them.
 */
const fs = require('fs')
const path = require('path')

const targetFile = path.join(__dirname, 'node_modules/undici/lib/web/webidl/index.js')
if (!fs.existsSync(targetFile)) {
    console.log('[postinstall] undici not found, skipping patch')
    process.exit(0)
}

let content = fs.readFileSync(targetFile, 'utf8')
const patchMarker = '// Node 18 compatibility: polyfill File and Blob'

if (content.includes(patchMarker)) {
    console.log('[postinstall] undici already patched')
    process.exit(0)
}

const target = 'webidl.is.ReadableStream = webidl.util.MakeTypeAssertion(ReadableStream)'
const patch = `${patchMarker} if not in globalThis
if (typeof globalThis.File === 'undefined') { try { globalThis.File = require('node:buffer').File } catch(e) {} }
if (typeof globalThis.Blob === 'undefined') { try { globalThis.Blob = require('node:buffer').Blob } catch(e) {} }

${target}`

if (content.includes(target)) {
    content = content.replace(target, patch)
    fs.writeFileSync(targetFile, content, 'utf8')
    console.log('[postinstall] ✅ undici patched for Node 18')
} else {
    console.log('[postinstall] ⚠️ Could not find patch target in undici')
}

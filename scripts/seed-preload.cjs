/**
 * Preload shim: patches @next/env so payload's loadEnv.js works
 * when running tsx outside of Next.js in Node 22.
 *
 * Usage: tsx --require ./scripts/seed-preload.cjs scripts/seed.ts
 */
'use strict'

const fs = require('fs')
const path = require('path')

// Manually load .env file using Node builtins (no dotenv dependency)
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

const cwd = process.cwd()
loadEnvFile(path.join(cwd, '.env.local'))
loadEnvFile(path.join(cwd, '.env'))

// Monkey-patch require('@next/env') so payload/dist/bin/loadEnv.js gets a shim
const Module = require('module')
const originalLoad = Module._load

Module._load = function (request, parent, isMain) {
  if (request === '@next/env') {
    const shim = { loadEnvConfig: () => ({ loadedEnvFiles: [] }) }
    shim.default = shim
    return shim
  }
  return originalLoad.apply(this, arguments)
}

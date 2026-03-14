#!/usr/bin/env node
/**
 * One-time schema push to a fresh Postgres DB (e.g. staging on DO).
 * Payload only pushes schema when NODE_ENV !== 'production'. This script
 * starts the app in development mode, triggers a request so Payload connects
 * and pushes, then exits.
 *
 * Usage:
 *   DATABASE_URI="postgresql://..." node scripts/db-push-once.js
 *   # or
 *   npm run db:push
 */
const { spawn } = require('child_process')
const http = require('http')

const PORT = process.env.PORT || 3000
const WAIT_MS = 25000
const POLL_MS = 500

function waitForServer() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + WAIT_MS
    function tryConnect() {
      const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (Date.now() > deadline) return reject(new Error('Server did not start in time'))
        setTimeout(tryConnect, POLL_MS)
      })
    }
    tryConnect()
  })
}

async function main() {
  if (!process.env.DATABASE_URI) {
    console.error('Set DATABASE_URI (e.g. your staging Postgres connection string).')
    process.exit(1)
  }
  process.env.NODE_ENV = 'development'
  if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('node-polyfill')) {
    process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --require ./node-polyfill.js'
  }

  console.log('Starting app in development mode to push schema (NODE_ENV=development)...')
  const child = spawn('node', ['node_modules/next/dist/bin/next', 'start'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT) },
    cwd: process.cwd(),
  })

  try {
    await waitForServer()
    console.log('App is up; schema push runs on first connect. Waiting 8s then exiting...')
    await new Promise((r) => setTimeout(r, 8000))
    child.kill()
    console.log('Done. Tables should exist. Redeploy with NODE_ENV=production.')
    process.exit(0)
  } catch (err) {
    console.error(err.message)
    child.kill()
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

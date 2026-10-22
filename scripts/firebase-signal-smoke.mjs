#!/usr/bin/env node
/**
 * Smoke test for the F16 Firebase notification signal (#1972).
 * Verifies a Firebase project is ready: service account, Auth, and the pw2 rules.
 *
 * Usage: node --env-file=.env.local scripts/firebase-signal-smoke.mjs [env-prefix]
 * Needs FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY/DATABASE_URL/WEB_API_KEY.
 * Writes + removes only pw2/<env-prefix>-smoke/*  (default prefix: "smoke").
 * Never prints secrets.
 */
import crypto from 'node:crypto'

const need = ['FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_DATABASE_URL', 'FIREBASE_WEB_API_KEY']
const missing = need.filter((k) => !process.env[k])
if (missing.length) { console.error('Missing env:', missing.join(', ')); process.exit(2) }

const email = process.env.FIREBASE_CLIENT_EMAIL
const key = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
const db = process.env.FIREBASE_DATABASE_URL.replace(/\/+$/, '')
const apiKey = process.env.FIREBASE_WEB_API_KEY
const env = `${process.argv[2] || 'smoke'}`.replace(/[^a-z0-9-]/g, '')
const now = Math.floor(Date.now() / 1000)
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const sign = (p) => { const u = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(p)}`; return `${u}.${crypto.sign('RSA-SHA256', Buffer.from(u), key).toString('base64url')}` }

let failed = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!ok) failed++ }

const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + sign({
    iss: email, scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 300 }),
})).json()
check('service account -> access token', !!tok.access_token)
if (!tok.access_token) process.exit(1)

const put = (p, v) => fetch(`${db}/${p}.json`, { method: 'PUT', headers: { authorization: `Bearer ${tok.access_token}` }, body: JSON.stringify(v) })
const base = `pw2/${env}`
const w = await put(`${base}/u/111`, { at: 1 }); check('server write', w.ok, `(${w.status})`)
await put(`${base}/u/222`, { at: 2 }); await put(`${base}/broadcast`, { at: 3 })

const anon = await fetch(`${db}/${base}/u/111.json`)
check('anonymous read blocked', anon.status === 401, `(${anon.status})`)

const ak = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ returnSecureToken: true, token: sign({
    iss: email, sub: email, aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now, exp: now + 3600, uid: `pw2_${env}_111` }) }),
})).json()
check('custom token sign-in (Auth enabled)', !!ak.idToken, ak.error?.message ?? '')
if (ak.idToken) {
  const get = async (p) => (await fetch(`${db}/${p}.json?auth=${ak.idToken}`)).status
  check('read own node', (await get(`${base}/u/111`)) === 200)
  check('read other user blocked', (await get(`${base}/u/222`)) === 401)
  check('read broadcast', (await get(`${base}/broadcast`)) === 200)
  check('list all users blocked', (await get(`${base}/u`)) === 401)
  check('other env blocked', (await get(`pw2/other-env/u/111`)) === 401)
  const cw = await fetch(`${db}/${base}/u/111.json?auth=${ak.idToken}`, { method: 'PUT', body: '{"x":1}' })
  check('client write blocked', cw.status === 401, `(${cw.status})`)
  await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: ak.idToken }) })
}
await fetch(`${db}/${base}.json`, { method: 'DELETE', headers: { authorization: `Bearer ${tok.access_token}` } })
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed')
process.exit(failed ? 1 : 0)

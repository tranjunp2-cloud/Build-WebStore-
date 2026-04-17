import { SignJWT } from 'jose'
import { readFileSync } from 'fs'

// Read env
const envContent = readFileSync('.env.local', 'utf-8')
const SECRET = envContent.match(/PAYLOAD_SECRET=(.*)/)?.[1]?.trim()
const DB_URI = envContent.match(/DATABASE_URI=(.*)/)?.[1]?.trim()

if (!SECRET) { console.error('No PAYLOAD_SECRET'); process.exit(1) }

// Generate JWT
const secret = new TextEncoder().encode(SECRET)
const token = await new SignJWT({ id: 1, email: 'phuong.ltweb@gmail.com', collection: 'users' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret)

console.log('Token generated:', token.slice(0, 30) + '...')

// Get template ID
import pg from 'pg'
const pool = new pg.Pool({ connectionString: DB_URI })
const { rows } = await pool.query('SELECT id, name FROM templates LIMIT 1')
const templateId = String(rows[0].id)
console.log('Template:', rows[0].name, '(id:', templateId, ')')
await pool.end()

// Apply template
console.log('Calling POST /api/ai/apply-template...')
const res = await fetch('http://localhost:3000/api/ai/apply-template', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `JWT ${token}`,
    },
    body: JSON.stringify({ templateId }),
})

console.log('Status:', res.status)
const body = await res.json()
console.log('Response:', JSON.stringify(body, null, 2))

if (res.ok && body.success) {
    console.log('\n✅ APPLY TEMPLATE SUCCESS!')
    console.log('Site ID:', body.siteId)
    console.log('Pages created:', body.pagesCreated)
} else {
    console.log('\n❌ APPLY TEMPLATE FAILED')
    // Check server log for details
    console.log('Check terminal running npm run dev for error details')
}

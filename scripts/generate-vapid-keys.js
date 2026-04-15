#!/usr/bin/env node
/**
 * Generate VAPID keys for Web Push notifications.
 *
 * Usage:
 *   node scripts/generate-vapid-keys.js
 *
 * Then add the output to Vercel Dashboard → Environment Variables:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY = <publicKey>
 *   VAPID_PRIVATE_KEY            = <privateKey>
 *
 * Scopes: Production, Preview, Custom (staging)
 */

const webpush = require('web-push')

const vapidKeys = webpush.generateVAPIDKeys()

console.log('=== VAPID Keys Generated ===\n')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`)
console.log('\nAdd these to Vercel Dashboard → Settings → Environment Variables.')
console.log('Scopes: Production, Preview, Custom Environment: staging')

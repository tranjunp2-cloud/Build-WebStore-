/**
 * QC environment safety guard.
 *
 * Prevents accidental execution of destructive QC scripts (seed / reset)
 * against staging / production databases. Every QC-only script MUST call
 * `assertQcEnv()` at the top of its `main()` before touching the DB.
 *
 * A run counts as QC when ALL of the following hold:
 *   1. APP_ENV / NEXT_PUBLIC_APP_ENV equals `qc-test`
 *   2. `DATABASE_URI` hostname is NOT in the known non-QC denylist below
 *      (staging + production Neon endpoints)
 *   3. `DATABASE_URI` hostname does NOT contain the substring `staging`
 *      or `production` (defense-in-depth against renamed endpoints)
 *
 * Rationale (2026-07-03 update): initial design required the substring
 * `qc-test` in the hostname, but Neon assigns random endpoint names
 * (e.g. `ep-dawn-scene-ao97yus8`) that never contain the project name.
 * Switched to denylist model — allow any host EXCEPT the known
 * staging/prod endpoints. Denylist is kept in the code (not env-driven)
 * so it can never be silently disabled by a missing env var.
 *
 * When adding a new production endpoint, append to KNOWN_NON_QC_HOSTS.
 */

// Known Neon endpoints that must NEVER be wiped by QC scripts.
// Update this list when infrastructure changes (prod launches, staging
// rebuilds, etc.). Substring match — so `ep-blue-king-a1qufqjg` blocks
// both the direct and `-pooler` variants of the same endpoint.
const KNOWN_NON_QC_HOSTS: readonly string[] = [
  'ep-blue-king-a1qufqjg', // staging Neon endpoint (2026-04-13)
  // 'ep-XXX-prod', // TODO: add when production Neon endpoint provisioned
]

export function assertQcEnv(): void {
  const uri = process.env.DATABASE_URI ?? ''
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? ''

  const hostFromUri = (() => {
    try {
      return new URL(uri).hostname
    } catch {
      return ''
    }
  })()

  const appEnvIsQc = appEnv === 'qc-test'
  const hostIsKnownNonQc = KNOWN_NON_QC_HOSTS.some((h) => hostFromUri.includes(h))
  const hostContainsNonQcKeyword =
    hostFromUri.includes('staging') ||
    hostFromUri.includes('production') ||
    hostFromUri.includes('.prod.')

  const isQc = appEnvIsQc && !hostIsKnownNonQc && !hostContainsNonQcKeyword && hostFromUri !== ''

  if (!isQc) {
    // Redact the URI when echoing back — never dump the full connection
    // string to logs (may be surfaced by CI aggregators).
    const redactedHost = hostFromUri || '<unparseable DATABASE_URI>'
    console.error('❌ QC SAFETY BLOCK — refusing to run outside QC env.')
    console.error(`   Detected APP_ENV="${appEnv}" (need "qc-test")`)
    console.error(`   Detected DATABASE_URI host="${redactedHost}"`)
    if (hostIsKnownNonQc) {
      console.error('   ⚠ Host matches a known non-QC (staging/prod) endpoint denylist.')
    }
    if (hostContainsNonQcKeyword) {
      console.error('   ⚠ Host contains "staging" | "production" | ".prod." keyword.')
    }
    console.error('   Required:')
    console.error('     1. APP_ENV=qc-test')
    console.error('     2. DATABASE_URI must NOT point at a known staging/prod endpoint')
    console.error('   Load QC env first: `set -a && . .env.qc-test && set +a` then re-run.')
    process.exit(1)
  }

  console.log(`✅ QC env verified (APP_ENV=${appEnv}, host=${hostFromUri})`)
}

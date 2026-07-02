/**
 * QC environment safety guard.
 *
 * Prevents accidental execution of destructive QC scripts (seed / reset)
 * against staging / production databases. Every QC-only script MUST call
 * `assertQcEnv()` at the top of its `main()` before touching the DB.
 *
 * A run counts as QC ONLY if BOTH of the following hold:
 *   - `DATABASE_URI` hostname contains the substring `qc-test`
 *     (Neon project name convention: `ech-prime-web-v2-qc-test`), AND
 *   - APP_ENV / NEXT_PUBLIC_APP_ENV equals `qc-test`
 *
 * Additionally, hostnames containing `staging` or `prod` are hard-blocked
 * even if both flags align, as an explicit denylist backstop.
 *
 * Rationale: OR-logic allowed a stale `APP_ENV=qc-test` in a dev's shell
 * to satisfy the check while `DATABASE_URI` still pointed at staging,
 * causing reset to wipe staging. AND-logic + hostname denylist closes
 * that gap. See plans/260702-1719-qc-test-env-setup/reports/code-review-*
 * finding H1.
 */

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

  const hostIsQc = hostFromUri.includes('qc-test')
  const appEnvIsQc = appEnv === 'qc-test'
  const hostIsDenylisted =
    hostFromUri.includes('staging') || hostFromUri.includes('prod') || hostFromUri.includes('production')

  const isQc = hostIsQc && appEnvIsQc && !hostIsDenylisted

  if (!isQc) {
    // Redact the URI when echoing back — never dump the full connection
    // string to logs (may be surfaced by CI aggregators).
    const redactedHost = hostFromUri || '<unparseable DATABASE_URI>'
    console.error('❌ QC SAFETY BLOCK — refusing to run outside QC env.')
    console.error(`   Detected APP_ENV="${appEnv}"`)
    console.error(`   Detected DATABASE_URI host="${redactedHost}"`)
    console.error('   Required (BOTH):')
    console.error('     1. APP_ENV=qc-test (env var)')
    console.error('     2. DATABASE_URI host containing "qc-test"')
    console.error('   Denylisted hosts: any containing "staging" | "prod" | "production".')
    console.error('   Load QC env first: `set -a && . .env.qc-test && set +a` then re-run.')
    process.exit(1)
  }

  console.log(`✅ QC env verified (APP_ENV=${appEnv}, host=${hostFromUri})`)
}

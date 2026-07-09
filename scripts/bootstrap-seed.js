'use strict';

/**
 * bootstrapSeed — creates essential user accounts if they don't exist.
 *
 * Pure function: accepts pool + env object (no direct process.env reads).
 * Called by db-setup.js on every startup — must be idempotent.
 *
 * Security rules:
 * - Existing users: log only, NEVER modify roles (avoid privilege escalation)
 * - New users: insert email + role only, NO password (set via `npm run db:seed-sso`)
 * - Email source: env vars only (BOOTSTRAP_ADMIN_EMAIL, SSO_SERVICE_EMAIL)
 *
 * @param {object} pool  pg pool with .query(sql, params) method
 * @param {object} env   environment variables object (e.g. process.env)
 * @returns {Promise<Array<{label: string, action: 'skipped'|'exists'|'created'|'error'}>>}
 */
async function bootstrapSeed(pool, env) {
  const accounts = [
    { label: 'Admin', email: env.BOOTSTRAP_ADMIN_EMAIL || '' },
    { label: 'SSO Service', email: env.SSO_SERVICE_EMAIL || '' },
  ];

  const results = [];

  for (const account of accounts) {
    if (!account.email) {
      results.push({ label: account.label, action: 'skipped' });
      continue;
    }

    try {
      const existing = await pool.query(
        'SELECT id, email FROM users WHERE email = $1 LIMIT 1',
        [account.email],
      );

      if (existing.rows.length > 0) {
        // User exists — DO NOT modify roles (security: avoid privilege escalation)
        results.push({ label: account.label, action: 'exists' });
      } else {
        // Create user row (email + name + role only, NO password)
        // Password must be set via `npm run db:seed-sso` (Payload Local API — scrypt hash)
        const result = await pool.query(
          `INSERT INTO users (email, first_name, last_name, updated_at, created_at)
           VALUES ($1, $2, $3, now(), now())
           RETURNING id`,
          [
            account.email,
            account.label.split(' ')[0],
            account.label.split(' ').slice(1).join(' ') || 'Web Store',
          ],
        );
        const newId = result.rows[0].id;

        // id in users_roles is serial (auto-increment) — omit from INSERT
        await pool.query(
          `INSERT INTO users_roles ("order", parent_id, value)
           VALUES (0, $1, 'super-admin')`,
          [newId],
        );

        results.push({ label: account.label, action: 'created' });
      }
    } catch {
      results.push({ label: account.label, action: 'error' });
    }
  }

  return results;
}

module.exports = { bootstrapSeed };

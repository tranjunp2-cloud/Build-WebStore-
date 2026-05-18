'use strict';

/**
 * seedMalaysiaGeo — populates malaysia_states, malaysia_districts, malaysia_postcodes
 * from scripts/data/malaysia-geo.json on first deploy (idempotent).
 *
 * Called by db-setup.js runBootstrapSeed() after migrations run.
 * Safe to call on every deploy: skips entirely if malaysia_states already has rows.
 *
 * @param {object} pool  pg pool with .query(sql, params) method
 */
const fs = require('fs');
const path = require('path');

async function seedMalaysiaGeo(pool) {
  const check = await pool.query('SELECT COUNT(*) AS n FROM malaysia_states');
  if (parseInt(check.rows[0].n, 10) > 0) {
    return { action: 'exists', count: parseInt(check.rows[0].n, 10) };
  }

  const dataPath = path.join(__dirname, 'data', 'malaysia-geo.json');
  const { states, districts } = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const s of states) {
      await client.query(
        `INSERT INTO malaysia_states (id, name, state_code, zone)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.name, s.state_code, s.zone],
      );
    }

    for (const d of districts) {
      await client.query(
        `INSERT INTO malaysia_districts (id, state_id, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [d.id, d.state_id, d.name],
      );
      for (const pc of d.postcodes) {
        await client.query(
          `INSERT INTO malaysia_postcodes (postcode, district_id)
           VALUES ($1, $2)
           ON CONFLICT (postcode) DO NOTHING`,
          [pc, d.id],
        );
      }
    }

    await client.query('COMMIT');
    const totalPc = districts.reduce((s, d) => s + d.postcodes.length, 0);
    return { action: 'seeded', states: states.length, districts: districts.length, postcodes: totalPc };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { seedMalaysiaGeo };

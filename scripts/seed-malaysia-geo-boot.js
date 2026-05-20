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

  // Flatten postcodes before acquiring client (CPU only, no I/O)
  const allPostcodes = [];
  const allDistrictIds = [];
  for (const d of districts) {
    for (const pc of d.postcodes) {
      allPostcodes.push(String(pc));
      allDistrictIds.push(d.id);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 3,855 individual queries → 3 batch UNNEST queries
    await client.query(
      `INSERT INTO malaysia_states (id, name, state_code, zone)
       SELECT * FROM UNNEST($1::int[], $2::varchar[], $3::varchar[], $4::varchar[])
       ON CONFLICT (id) DO NOTHING`,
      [states.map(s => s.id), states.map(s => s.name), states.map(s => s.state_code), states.map(s => s.zone)],
    );

    await client.query(
      `INSERT INTO malaysia_districts (id, state_id, name)
       SELECT * FROM UNNEST($1::int[], $2::int[], $3::varchar[])
       ON CONFLICT (id) DO NOTHING`,
      [districts.map(d => d.id), districts.map(d => d.state_id), districts.map(d => d.name)],
    );

    await client.query(
      `INSERT INTO malaysia_postcodes (postcode, district_id)
       SELECT * FROM UNNEST($1::varchar[], $2::int[])
       ON CONFLICT (postcode) DO NOTHING`,
      [allPostcodes, allDistrictIds],
    );

    await client.query('COMMIT');
    return { action: 'seeded', states: states.length, districts: districts.length, postcodes: allPostcodes.length };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { seedMalaysiaGeo };

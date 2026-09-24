require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const file = path.join(__dirname, 'prisma', 'migrations', '35_add_multi_bus_driver_to_bus_bookings.sql');

(async () => {
  const sql = fs.readFileSync(file, 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sql);
    const check = await pool.query(
      `SELECT column_name, column_default, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'bus_bookings' AND column_name IN ('bus_ids', 'driver_ids')`
    );
    console.log('Applied. bus_bookings multi-assign columns:', check.rows);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

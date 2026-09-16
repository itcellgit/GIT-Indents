require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const file = path.join(__dirname, 'prisma', 'migrations', '33_rename_vehicle_name_to_driver_name.sql');

(async () => {
  const sql = fs.readFileSync(file, 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sql);
    const check = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'vehicles' ORDER BY ordinal_position`
    );
    console.log('Applied. vehicles columns:', check.rows.map((r) => r.column_name));
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

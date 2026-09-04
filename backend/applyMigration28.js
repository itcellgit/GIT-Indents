require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const file = path.join(__dirname, 'prisma', 'migrations', '28_add_hod_review_to_dept_stationary_indents.sql');

(async () => {
  const sql = fs.readFileSync(file, 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sql);
    const check = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'dept_stationary_indents' AND column_name LIKE 'hod%'`
    );
    console.log('Applied. hod_* columns now present:', check.rows.map((r) => r.column_name));
    const backfilled = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM public.dept_stationary_indents GROUP BY status ORDER BY status`
    );
    console.log('Status counts:', backfilled.rows);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

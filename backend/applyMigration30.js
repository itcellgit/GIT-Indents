require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const file = path.join(__dirname, 'prisma', 'migrations', '30_add_hod_review_and_serial_to_book_indents.sql');

(async () => {
  const sql = fs.readFileSync(file, 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sql);
    const check = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'faculty_book_indent_forms' ORDER BY ordinal_position`
    );
    console.log('Applied. faculty_book_indent_forms columns:', check.rows.map((r) => r.column_name));
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

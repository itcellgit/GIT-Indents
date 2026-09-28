require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const file = path.join(__dirname, 'prisma', 'migrations', '36_add_partial_arrival_to_book_indents.sql');

(async () => {
  const sql = fs.readFileSync(file, 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sql);
    const check = await pool.query(
      `SELECT column_name, column_default, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'faculty_book_indent_forms' AND column_name = 'received_quantity'`
    );
    console.log('Applied. faculty_book_indent_forms.received_quantity:', check.rows);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const file = path.join(__dirname, 'prisma', 'migrations', '34_add_material_quotation_to_material_used.sql');

(async () => {
  const sql = fs.readFileSync(file, 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sql);
    const check = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'MaterialUsed' AND column_name = 'material_quatation'`
    );
    console.log('Applied. material_quatation column exists:', check.rows.length === 1);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
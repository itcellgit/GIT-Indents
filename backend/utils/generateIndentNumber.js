const prisma = require('../prismaClient');

const { getDepartmentShortName } = require('./departments');

const generateIndentNumber = async (requesterId, categoryId) => {
  const userRows = await prisma.$queryRawUnsafe(
    'SELECT id, department FROM "User" WHERE id = $1 LIMIT 1',
    requesterId
  );
  const categoryRows = await prisma.$queryRawUnsafe(
    'SELECT id, name FROM "Category" WHERE id = $1 LIMIT 1',
    categoryId
  );

  const user = userRows[0] || null;
  const category = categoryRows[0] || null;
  
  const creatorDept = getDepartmentShortName(user?.department);
  const maintDept = getDepartmentShortName(category?.name);
  
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const dateStr = `${dd}-${mm}-${yy}`;
  
  // Atomic upsert-and-increment: a single INSERT .. ON CONFLICT DO UPDATE .. RETURNING
  // is serialized by Postgres's row-level locking, so two concurrent requests can never
  // read the same count and generate the same indentNumber (unlike the previous
  // COUNT(*)-then-add-one approach, which had exactly that race). Passed as an explicit
  // 'YYYY-MM-DD' string (not a JS Date) so the counter's day bucket always matches the
  // same local day used in dateStr above, regardless of the DB session's timezone.
  const isoDateStr = `${now.getFullYear()}-${mm}-${dd}`;
  const counterRows = await prisma.$queryRawUnsafe(
    `INSERT INTO "indent_number_counters" (counter_date, count)
     VALUES ($1::date, 1)
     ON CONFLICT (counter_date) DO UPDATE SET count = "indent_number_counters".count + 1
     RETURNING count`,
    isoDateStr
  );

  const slNo = String(counterRows[0].count).padStart(2, '0');
  
  return `${creatorDept}/${dateStr}-${slNo}/${maintDept}`;
};

module.exports = generateIndentNumber;

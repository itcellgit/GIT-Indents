const prisma = require('../prismaClient');

// Atomic upsert-and-increment counter, one row per calendar month, so the
// sequence resets every month and two concurrent requisitions in the same
// month can never collide (same pattern as generateIndentNumber.js).
const generateBookIndentSerialNo = async () => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const monthKey = `${yyyy}-${mm}`;

  const counterRows = await prisma.$queryRawUnsafe(
    `INSERT INTO public.book_indent_serial_counters (counter_month, count)
     VALUES ($1, 1)
     ON CONFLICT (counter_month) DO UPDATE SET count = book_indent_serial_counters.count + 1
     RETURNING count`,
    monthKey
  );

  const seq = String(counterRows[0].count).padStart(3, '0');
  return `${mm}/${yyyy}-${seq}`;
};

module.exports = generateBookIndentSerialNo;

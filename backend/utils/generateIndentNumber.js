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
  
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  const todayCount = await prisma.indent.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });
  
  const slNo = String(todayCount + 1).padStart(2, '0');
  
  return `${creatorDept}/${dateStr}-${slNo}/${maintDept}`;
};

module.exports = generateIndentNumber;

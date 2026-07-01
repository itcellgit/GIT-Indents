const prisma = require('../prismaClient');

const generateIndentNumber = async (requesterId, categoryId) => {
  const user = await prisma.user.findUnique({ where: { id: requesterId } });
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  
  const creatorDeptStr = user && user.department ? user.department : 'UNK';
  const maintDeptStr = category && category.name ? category.name : 'UNK';
  
  const creatorDept = creatorDeptStr.substring(0, 3).toUpperCase();
  const maintDept = maintDeptStr.substring(0, 3).toUpperCase();
  
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

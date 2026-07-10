require('dotenv').config();
const prisma = require('./prismaClient');

const normalizeRole = (role) => {
  if (!role) return 'Faculty';
  const roleMap = {
    'admin': 'Admin',
    'principal': 'Principal',
    'hod': 'HOD',
    'faculty': 'Faculty',
    'non-teaching': 'Non-Teaching',
    'non teaching': 'Non-Teaching',
    'nonteaching': 'Non-Teaching'
  };
  return roleMap[role.toLowerCase().trim()] || 'Faculty';
};

async function main() {
  console.log("Starting role normalization process...");
  const users = await prisma.user.findMany();
  let updatedCount = 0;

  for (const user of users) {
    const standardizedRole = normalizeRole(user.role);
    if (user.role !== standardizedRole) {
      console.log(`Updating user ${user.email}: ${user.role} -> ${standardizedRole}`);
      await prisma.user.update({
        where: { id: user.id },
        data: { role: standardizedRole }
      });
      updatedCount++;
    }
  }

  console.log(`Role normalization complete. Updated ${updatedCount} users.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

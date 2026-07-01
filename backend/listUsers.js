const prisma = require('./prismaClient');
async function main() {
  const users = await prisma.user.findMany();
  console.log(users);
}
main().then(() => process.exit(0));

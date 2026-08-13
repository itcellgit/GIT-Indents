// backend/seedPrincipal.js
const dotenv = require('dotenv');
dotenv.config();

const prisma = require('./prismaClient');
const bcrypt = require('bcryptjs');
const { ROLES } = require('./utils/roles');
const { setUserRole } = require('./utils/userRoles');

async function main() {
  const email = 'principal@git.edu';
  const plainPassword = 'Password@123';
  const name = 'Principal GIT';
  const department = 'Princiapal';
  const role = ROLES.PRINCIPAL;

  try {
    console.log(`Checking if user ${email} already exists...`);
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    let user;
    if (existingUser) {
      console.log(`User ${email} already exists. Updating details...`);
      user = await prisma.user.update({
        where: { email },
        data: {
          name,
          password: hashedPassword,
          department,
        },
      });
      console.log('User updated successfully:', user);
    } else {
      console.log(`Creating user ${email}...`);
      user = await prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          department,
        },
      });
      console.log('User created successfully:', user);
    }

    await setUserRole(prisma, user.id, role);
  } catch (error) {
    console.error('Error seeding principal user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

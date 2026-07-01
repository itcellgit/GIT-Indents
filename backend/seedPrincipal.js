// backend/seedPrincipal.js
const dotenv = require('dotenv');
dotenv.config();

const prisma = require('./prismaClient');
const bcrypt = require('bcryptjs');

async function main() {
  const email = 'principal@git.edu';
  const plainPassword = '123456';
  const name = 'Principal GIT';
  const department = 'Princiapal';
  const role = 'Principal';

  try {
    console.log(`Checking if user ${email} already exists...`);
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    if (existingUser) {
      console.log(`User ${email} already exists. Updating details...`);
      const updatedUser = await prisma.user.update({
        where: { email },
        data: {
          name,
          password: hashedPassword,
          department,
          role,
        },
      });
      console.log('User updated successfully:', updatedUser);
    } else {
      console.log(`Creating user ${email}...`);
      const newUser = await prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          department,
          role,
        },
      });
      console.log('User created successfully:', newUser);
    }
  } catch (error) {
    console.error('Error seeding principal user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'sandeep140499@gmail.com';
  const employee = await prisma.employee.findUnique({
    where: { email }
  });
  console.log('Employee found:', JSON.stringify(employee, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

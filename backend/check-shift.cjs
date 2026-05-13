const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const shift = await prisma.employeeShift.findFirst({
    where: { branchId: 1, status: 'ACTIVE' }
  });
  console.log('Active shift:', !!shift);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

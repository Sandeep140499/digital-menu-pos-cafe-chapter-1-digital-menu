const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cats = await prisma.menuCategory.findMany({
    select: { id: true, name: true, branchId: true },
    orderBy: { branchId: 'asc' }
  });
  console.log('Categories in DB:', JSON.stringify(cats, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

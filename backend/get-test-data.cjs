const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const table = await prisma.table.findFirst({
    where: { branchId: 1 },
    select: { id: true }
  });
  console.log('Table ID:', table?.id);
  
  const item = await prisma.menuItem.findFirst({
    where: { category: { branchId: 1 } },
    select: { id: true, name: true, basePrice: true }
  });
  console.log('Item:', JSON.stringify(item));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

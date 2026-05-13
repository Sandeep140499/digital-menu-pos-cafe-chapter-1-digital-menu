const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const errors = await prisma.errorLog.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } }, // last 5 minutes
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Recent Errors:', JSON.stringify(errors, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

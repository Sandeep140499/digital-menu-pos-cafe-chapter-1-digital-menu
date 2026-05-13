import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debugOrder() {
  try {
    const order = await prisma.order.findUnique({
      where: { id: 3 },
      include: {
        items: true,
        modifications: true,
        branch: true,
      }
    });

    console.log('Order #3 Data:');
    console.log(JSON.stringify(order, null, 2));

    if (!order) {
      console.log('Order #3 NOT FOUND');
    }
  } catch (error) {
    console.error('Error debugging order:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugOrder();

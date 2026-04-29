import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkShifts() {
  try {
    const activeShifts = await prisma.employeeShift.findMany({
      where: { shiftEnd: null },
      include: { 
        employee: { select: { name: true, email: true } },
        branch: { select: { name: true } }
      }
    });
    
    console.log('Active shifts:', activeShifts.length);
    console.log(JSON.stringify(activeShifts, null, 2));
    
    // Check today's shifts
    const today = new Date();
    const timeZone = process.env.TZ || 'Asia/Kolkata';
    const dateStr = today.toLocaleDateString('en-CA', { timeZone });
    const [y, m, d] = dateStr.split('-').map(Number);
    const businessDayStart = new Date(Date.UTC(y, m - 1, d, 4, 0, 0, 0));
    
    const todayShifts = await prisma.employeeShift.findMany({
      where: {
        shiftStart: { gte: businessDayStart }
      },
      include: { employee: { select: { name: true } } }
    });
    
    console.log('\nToday\'s shifts (since 4 AM):', todayShifts.length);
    console.log(JSON.stringify(todayShifts, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkShifts();

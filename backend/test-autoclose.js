import { PrismaClient } from '@prisma/client';
import { getBusinessDayRange } from './src/utils/businessDay.js';

const prisma = new PrismaClient();
const TIMEZONE = process.env.TZ || 'Asia/Kolkata';

async function testAutoClose() {
  try {
    const now = new Date();
    const { dateKey: nowKey, start: boundaryAtStartOfNowsBusinessDay } = getBusinessDayRange({
      date: now,
      boundaryHour: 4,
      timeZone: TIMEZONE,
    });

    console.log('Current time:', now.toISOString());
    console.log('Current business day key:', nowKey);
    console.log('Business day start:', boundaryAtStartOfNowsBusinessDay.toISOString());

    const openShifts = await prisma.employeeShift.findMany({
      where: { shiftEnd: null },
      include: { employee: true },
    });

    console.log('\nOpen shifts:', openShifts.length);

    for (const shift of openShifts) {
      const { dateKey: shiftKey } = getBusinessDayRange({
        date: shift.shiftStart,
        boundaryHour: 4,
        timeZone: TIMEZONE,
      });
      
      console.log(`\nShift ID ${shift.id}:`);
      console.log(`  Employee: ${shift.employee.name}`);
      console.log(`  Shift start: ${shift.shiftStart.toISOString()}`);
      console.log(`  Shift business day key: ${shiftKey}`);
      console.log(`  Current business day key: ${nowKey}`);
      console.log(`  Should close: ${shiftKey < nowKey}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAutoClose();

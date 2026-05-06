import { runAutoCloseAt4AM } from './src/services/shiftAutoClose.js';
import { prisma } from './src/config/prisma.js';

async function main() {
  await runAutoCloseAt4AM();
  await prisma.$disconnect();
}
main();

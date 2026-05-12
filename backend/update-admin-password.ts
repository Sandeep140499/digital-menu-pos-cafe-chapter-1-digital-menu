import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './src/config/prisma.js';

async function updateAdminPassword() {
  const newHash = await bcrypt.hash('Admin@1208', 10);
  
  await prisma.admin.update({
    where: { email: 'chapteronecafe11@gmail.com' },
    data: { passwordHash: newHash }
  });
  
  console.log('✅ Admin password updated to: Admin@1208');
  console.log('Email: chapteronecafe11@gmail.com');
  await prisma.$disconnect();
}

updateAdminPassword();

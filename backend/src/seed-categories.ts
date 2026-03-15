import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Category image URLs as provided
const categoryImages = {
  'Cold Coffee': 'https://i.ibb.co/LQk1bMj/cold-coffee.jpg',
  'Milkshake': 'https://i.ibb.co/6Pjw8H4/milkshake.jpg',
  'Mocktails': 'https://i.ibb.co/3T6vj0D/mocktails.jpg',
  'Ice Tea': 'https://i.ibb.co/K0Xq4B2/ice-tea.jpg',
  'Hot Coffee': 'https://i.ibb.co/3T6vj0D/hot-coffee.jpg',
  'Soda': 'https://i.ibb.co/LQk1bMj/soda.jpg',
  'Fresh Juice': 'https://i.ibb.co/6Pjw8H4/fresh-juice.jpg',
  'Momos Steam': 'https://i.ibb.co/3T6vj0D/momos-steam.jpg',
  'Momos Fried': 'https://i.ibb.co/K0Xq4B2/momos-fried.jpg',
  'Momos Gravy': 'https://i.ibb.co/LQk1bMj/momos-gravy.jpg',
  'Chowmein': 'https://i.ibb.co/6Pjw8H4/chowmein.jpg',
  'Spring Roll': 'https://i.ibb.co/3T6vj0D/spring-roll.jpg',
  'Manchurian': 'https://i.ibb.co/K0Xq4B2/manchurian.jpg',
  'Noodles': 'https://i.ibb.co/LQk1bMj/noodles.jpg',
  'Rice': 'https://i.ibb.co/6Pjw8H4/rice.jpg',
  'Dal / Paneer': 'https://i.ibb.co/3T6vj0D/dal-paneer.jpg',
  'Roti / Naan': 'https://i.ibb.co/K0Xq4B2/roti-naan.jpg',
  'Specials': 'https://i.ibb.co/LQk1bMj/specials.jpg',
  'Biryani': 'https://i.ibb.co/6Pjw8H4/biryani.jpg',
  'Chinese': 'https://i.ibb.co/3T6vj0D/chinese.jpg',
  'Tandoori': 'https://i.ibb.co/K0Xq4B2/tandoori.jpg',
  'Starters': 'https://i.ibb.co/LQk1bMj/starters.jpg',
  'Desserts': 'https://i.ibb.co/6Pjw8H4/desserts.jpg'
};

// Function to create slug from name
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function migrateCategories() {
  console.log('Starting category migration...');
  
  try {
    // Get all categories
    const categories = await prisma.menuCategory.findMany();
    console.log(`Found ${categories.length} categories to migrate`);
    
    for (const category of categories) {
      const slug = createSlug(category.name);
      const imageUrl = categoryImages[category.name as keyof typeof categoryImages] || null;
      
      await prisma.menuCategory.update({
        where: { id: category.id },
        data: {
          slug: slug,
          imageUrl: imageUrl,
          updatedAt: new Date()
        }
      });
      
      console.log(`Updated category "${category.name}" -> slug: "${slug}", image: ${imageUrl ? '✓' : '✗'}`);
    }
    
    console.log('Category migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateCategories();

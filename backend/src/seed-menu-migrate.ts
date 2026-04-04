/**
 * Migrates menu categories: slug, name, image_url.
 * Run from backend: npm run seed:migrate
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories: { slug: string; name: string; imageUrl: string }[] = [
  {
    slug: 'cold-coffee',
    name: 'Cold Coffee',
    imageUrl: 'https://jalojog.com/wp-content/uploads/2024/04/Cold_Coffee.jpg',
  },
  {
    slug: 'milkshake',
    name: 'Milkshake',
    imageUrl:
      'https://png.pngtree.com/png-vector/20240819/ourmid/pngtree-chocolate-banana-milkshake-png-image_13347216.png',
  },
  {
    slug: 'mocktails',
    name: 'Mocktails',
    imageUrl:
      'https://s7ap1.scene7.com/is/image/itcportalprod/five-best-mocktails-with-lychee-juice?fmt=webp-alpha',
  },
  {
    slug: 'chai',
    name: 'Chai',
    imageUrl:
      'https://imgs.etvbharat.com/etvbharat/prod-images/768-512-17212133-411-17212133-1671088316048.jpg',
  },
  {
    slug: 'ice-tea',
    name: 'Ice-Tea',
    imageUrl: 'https://buytea.com/cdn/shop/articles/Summer-Explore-Iced-Tea.jpg?v=1682577131',
  },
  {
    slug: 'hot-coffee',
    name: 'Hot Coffee',
    imageUrl:
      'https://t3.ftcdn.net/jpg/05/34/82/24/360_F_534822425_9Ok2L60rSndeunIM6sELPKvuDqzhopX7.jpg',
  },
  {
    slug: 'momos-steam',
    name: 'Momos - Steam',
    imageUrl:
      'https://www.thespruceeats.com/thmb/UnVh_-znw7ikMUciZIx5sNqBtTU=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/steamed-momos-wontons-1957616-hero-01-1c59e22bad0347daa8f0dfe12894bc3c.jpg',
  },
  {
    slug: 'momos-fried',
    name: 'Momos - Fried',
    imageUrl: 'https://cdn.dotpe.in/longtail/store-items/8635073/KAqPycAS.webp',
  },
  {
    slug: 'momos-kurkure',
    name: 'Momos - Kurkure',
    imageUrl: 'https://c.ndtvimg.com/2022-10/57qe3h68_kurkure-momo_625x300_28_October_22.png',
  },
  {
    slug: 'pasta',
    name: 'Pasta',
    imageUrl: 'https://s.lightorangebean.com/media/20240914160809/Spicy-Penne-Pasta_-done.png',
  },
  {
    slug: 'sandwich',
    name: 'Sandwich',
    imageUrl:
      'https://img.freepik.com/free-photo/side-view-club-sandwich-with-salted-cucumbers-lemon-olives-round-white-plate_176474-3049.jpg',
  },
  {
    slug: 'pizza',
    name: 'Pizza',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591',
  },
  {
    slug: 'maggi',
    name: 'Maggi',
    imageUrl: 'https://nfcihospitality.com/wp-content/uploads/2024/09/types-of-Maggi-Noodles.jpg',
  },
  {
    slug: 'sweetcorn',
    name: 'Sweetcorn',
    imageUrl: 'https://rakskitchen.net/wp-content/uploads/2022/01/crispy-corn-recipe.jpg',
  },
  {
    slug: 'fries',
    name: 'Fries',
    imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f390859f',
  },
  {
    slug: 'slush',
    name: 'Slush',
    imageUrl:
      'https://static.vecteezy.com/system/resources/thumbnails/074/380/819/small/refreshing-slushies-on-ice-a-colorful-and-delicious-treat-photo.jpg',
  },
  {
    slug: 'fresh-smoothies',
    name: 'Fresh Smoothies',
    imageUrl:
      'https://images.unsplash.com/photo-1553530666-d3408ec28ec0?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'garlic-bread',
    name: 'Garlic Bread',
    imageUrl:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTB5dLVCgT8j8evpL38IluG6wt4GJzXjDLzUA',
  },
  {
    slug: 'noodles',
    name: 'Noodles',
    imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246',
  },
  {
    slug: 'burger',
    name: 'Burger',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd',
  },
  {
    slug: 'rolls',
    name: 'Chapter Roll / Wapp',
    imageUrl: 'https://manjulaskitchen.com/wp-content/uploads/vegetable_kathi_roll.jpg',
  },
  {
    slug: 'poha',
    name: 'Poha',
    imageUrl:
      'https://palatesdesire.com/wp-content/uploads/2022/07/Vegetable-diet-poha-recipe@palates-desire.jpg',
  },
  {
    slug: 'rice',
    name: 'Rice Bowl (Lunch/Dinner)',
    imageUrl:
      'https://eatmoreart.org/wp-content/uploads/2020/05/Rajma-Chawal-Indian-Curried-Kidney-Beans-Rice-IMG_1801-500x500.jpg',
  },
  {
    slug: 'soup',
    name: 'Soup',
    imageUrl:
      'https://www.suburbansimplicity.com/wp-content/uploads/2021/07/Homemade-Chicken-Soup-from-scratch.jpg',
  },
];

async function main() {
  console.log('Migrating menu categories (slug, name, image_url)...');
  for (const row of categories) {
    const existing = await prisma.menuCategory.findUnique({
      where: { slug: row.slug },
    });
    if (existing) {
      await prisma.menuCategory.update({
        where: { id: existing.id },
        data: { name: row.name, imageUrl: row.imageUrl },
      });
      console.log(`Updated: ${row.slug} -> ${row.name}`);
    } else {
      await prisma.menuCategory.create({
        data: { slug: row.slug, name: row.name, imageUrl: row.imageUrl },
      });
      console.log(`Created: ${row.slug} -> ${row.name}`);
    }
  }
  console.log('Done. Total categories:', categories.length);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

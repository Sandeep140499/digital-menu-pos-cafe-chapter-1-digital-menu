import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './config/prisma.js';

async function main() {
  const adminEmail = 'chapteronecafe11@gmail.com';
  const adminPassword = 'admin@1208';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Super Admin',
      passwordHash: adminHash,
    },
    create: {
      name: 'Super Admin',
      email: adminEmail,
      passwordHash: adminHash,
    },
  });

  const branch = await prisma.branch.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Main Branch',
      location: 'Gautam Nagar',
      timezone: 'Asia/Kolkata',
    },
  });

  const employeeEmail = 'sandeep140499kumar@gmail.com';
  const employeeHash = await bcrypt.hash('user@123', 10);

  await prisma.employee.upsert({
    where: { email: employeeEmail },
    update: { emailVerified: true, passwordHash: employeeHash },
    create: {
      name: 'Sandeep Kumar',
      email: employeeEmail,
      passwordHash: employeeHash,
      branchId: branch.id,
      employeeCode: 'CC100001',
      emailVerified: true,
    },
  });

  await prisma.table.upsert({
    where: { id: 1 },
    update: {},
    create: {
      branchId: branch.id,
      tableNumber: 'T1',
      qrCodeUrl: '',
    },
  });

  // Menu categories with slugs and image URLs (full list)
  const categoryRows: { slug: string; name: string; imageUrl: string }[] = [
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
      slug: 'fresh-smoothies',
      name: 'Fresh Smoothies',
      imageUrl:
        'https://images.unsplash.com/photo-1553530666-d3408ec28ec0?auto=format&fit=crop&w=1200&q=80',
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
      slug: 'fried-rice',
      name: 'Rice',
      imageUrl:
        'https://thai-foodie.com/wp-content/uploads/2025/04/thai-curry-fried-rice-plated.jpg',
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

  for (const row of categoryRows) {
    await prisma.menuCategory.upsert({
      where: { branchId_slug: { branchId: branch.id, slug: row.slug } },
      update: { name: row.name, imageUrl: row.imageUrl },
      create: { branchId: branch.id, slug: row.slug, name: row.name, imageUrl: row.imageUrl },
    });
  }

  const coldCoffee = await prisma.menuCategory.findFirst({
    where: { slug: 'cold-coffee', branchId: branch.id },
  });
  const freshSmoothies = await prisma.menuCategory.findFirst({
    where: { slug: 'fresh-smoothies', branchId: branch.id },
  });
  const milkshake = await prisma.menuCategory.findFirst({
    where: { slug: 'milkshake', branchId: branch.id },
  });
  const chai = await prisma.menuCategory.findFirst({
    where: { slug: 'chai', branchId: branch.id },
  });
  const pizza = await prisma.menuCategory.findFirst({
    where: { slug: 'pizza', branchId: branch.id },
  });
  const burger = await prisma.menuCategory.findFirst({
    where: { slug: 'burger', branchId: branch.id },
  });
  const rice = await prisma.menuCategory.findFirst({
    where: { slug: 'rice', branchId: branch.id },
  });

  const sampleItems: {
    name: string;
    description?: string;
    basePrice: number;
    hasHalf?: boolean;
    halfPrice?: number;
    categoryId: number | null;
  }[] = [
    {
      name: 'Paneer Butter Masala',
      description: 'Rich and creamy paneer curry',
      basePrice: 260,
      hasHalf: true,
      halfPrice: 150,
      categoryId: rice?.id ?? null,
    },
    {
      name: 'Dal Tadka',
      description: 'Yellow dal tempered with spices',
      basePrice: 180,
      hasHalf: true,
      halfPrice: 110,
      categoryId: rice?.id ?? null,
    },
    {
      name: 'Cold Coffee',
      description: 'Chilled coffee',
      basePrice: 120,
      categoryId: coldCoffee?.id ?? null,
    },
    {
      name: 'Iced Latte',
      description: 'Espresso with cold milk',
      basePrice: 150,
      categoryId: coldCoffee?.id ?? null,
    },
    {
      name: 'Strawberries',
      description:
        'Fresh strawberry smoothie — pure fruit flavour, naturally refreshing. Light, uplifting, and a delicious better-for-you choice.',
      basePrice: 179,
      hasHalf: false,
      categoryId: freshSmoothies?.id ?? null,
    },
    {
      name: 'Oreo Shake',
      description: 'Milkshake with Oreo',
      basePrice: 169,
      categoryId: milkshake?.id ?? null,
    },
    {
      name: 'Kitkat Shake',
      description: 'Milkshake with Kitkat',
      basePrice: 199,
      categoryId: milkshake?.id ?? null,
    },
    { name: 'Masala Chai', description: 'Spiced tea', basePrice: 30, categoryId: chai?.id ?? null },
    {
      name: 'Margherita Pizza',
      description: 'Classic tomato and cheese',
      basePrice: 249,
      categoryId: pizza?.id ?? null,
    },
    {
      name: 'Veg Burger',
      description: 'Crispy veg patty',
      basePrice: 129,
      categoryId: burger?.id ?? null,
    },
  ];

  for (const item of sampleItems) {
    if (!item.categoryId) continue;
    const existing = await prisma.menuItem.findFirst({
      where: { categoryId: item.categoryId, name: item.name },
    });
    if (!existing) {
      await prisma.menuItem.create({
        data: {
          name: item.name,
          description: item.description,
          basePrice: item.basePrice,
          hasHalf: item.hasHalf ?? false,
          halfPrice: item.halfPrice,
          categoryId: item.categoryId,
          isActive: true,
        },
      });
    }
  }

  const itemCount = await prisma.menuItem.count();
  const firstCategory = await prisma.menuCategory.findFirst({
    where: { branchId: branch.id },
    orderBy: { id: 'asc' },
  });
  if (firstCategory && itemCount === 0) {
    await prisma.menuItem.createMany({
      data: [
        { name: 'Sample Item 1', basePrice: 99, categoryId: firstCategory.id, isActive: true },
        { name: 'Sample Item 2', basePrice: 149, categoryId: firstCategory.id, isActive: true },
      ],
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    'Seed completed: admin, employee (verified), branch, table, categories, sample items.'
  );
}

main()
  .catch(e => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

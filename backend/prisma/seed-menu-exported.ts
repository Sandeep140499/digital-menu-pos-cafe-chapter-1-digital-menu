import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const menuData = [
  {
    name: 'Fresh Smoothies',
    slug: 'fresh-smoothies',
    imageUrl:
      'https://static.vecteezy.com/system/resources/previews/057/178/686/non_2x/refreshing-strawberry-juice-with-fruit-splash-surrounding-a-glass-on-a-clean-background-strawberry-juice-with-fruits-splash-stock-illustration-free-png.png',
    items: [
      {
        name: 'Strawberries',
        description:
          'Fresh strawberry smoothie — pure fruit flavour, naturally refreshing. Light, uplifting, and a delicious better-for-you choice.',
        basePrice: 179,
        hasHalf: false,
      },
      {
        name: 'Strawberry Smoothie',
        basePrice: 179,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Rice',
    slug: 'rice-2',
    imageUrl:
      'https://media.istockphoto.com/id/1091698306/photo/schezwan-paneer-fried-rice-with-szechuan-sauce-and-cottage-cheese-cubes-served-in-a-bowl-or.webp?a=1&b=1&s=612x612&w=0&k=20&c=QqoYPf4CWUOzKzP3K8-QMrlrHmBWUhKkKsd5levQ5Hc=',
    items: [
      {
        name: 'Paneer Fried Rice',
        description: 'Half / Full',
        basePrice: 169,
        halfPrice: 109,
        hasHalf: true,
      },
      {
        name: 'Chicken Fried Rice',
        description: 'Half / Full',
        basePrice: 169,
        halfPrice: 109,
        hasHalf: true,
      },
      {
        name: 'Veg Fried Rice',
        description: 'Half / Full',
        basePrice: 149,
        halfPrice: 89,
        hasHalf: true,
      },
      {
        name: 'Egg Fried Rice',
        description: 'Half / Full',
        basePrice: 159,
        halfPrice: 99,
        hasHalf: true,
      },
    ],
  },
  {
    name: 'Cold Coffee',
    slug: 'cold-coffee',
    imageUrl: 'https://jalojog.com/wp-content/uploads/2024/04/Cold_Coffee.jpg',
    items: [
      {
        name: 'Hazelnut Cold Coffee',
        basePrice: 169,
        hasHalf: false,
      },
      {
        name: 'Iced Latte',
        description: 'Espresso with cold milk',
        basePrice: 150,
        hasHalf: false,
      },
      {
        name: 'Cold Coffee',
        basePrice: 99,
        hasHalf: false,
      },
      {
        name: 'Mocha Iced',
        basePrice: 149,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Milkshake',
    slug: 'milkshake',
    imageUrl:
      'https://png.pngtree.com/png-vector/20240819/ourmid/pngtree-chocolate-banana-milkshake-png-image_13347216.png',
    items: [
      {
        name: 'Oreo Shake',
        description: 'Milkshake with Oreo',
        basePrice: 169,
        hasHalf: false,
      },
      {
        name: 'Kitkat Shake',
        description: 'Milkshake with Kitkat',
        basePrice: 199,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Mocktails',
    slug: 'mocktails',
    imageUrl:
      'https://s7ap1.scene7.com/is/image/itcportalprod/five-best-mocktails-with-lychee-juice?fmt=webp-alpha',
    items: [
      {
        name: 'Cucumber',
        basePrice: 129,
        hasHalf: false,
      },
      {
        name: 'Virgin Mint Mojito',
        basePrice: 119,
        hasHalf: false,
      },
      {
        name: 'Green Apple Refresher',
        basePrice: 119,
        hasHalf: false,
      },
      {
        name: 'Watermelon Refresher',
        basePrice: 119,
        hasHalf: false,
      },
      {
        name: 'Virgin Strawberry',
        basePrice: 119,
        hasHalf: false,
      },
      {
        name: 'Peach Passion',
        basePrice: 119,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Chai',
    slug: 'chai',
    imageUrl:
      'https://imgs.etvbharat.com/etvbharat/prod-images/768-512-17212133-411-17212133-1671088316048.jpg',
    items: [
      {
        name: 'Adrak Tea',
        basePrice: 25,
        hasHalf: false,
      },
      {
        name: 'Kulhad Adrak Tea',
        basePrice: 35,
        hasHalf: false,
      },
      {
        name: 'Lemon Tea',
        basePrice: 50,
        hasHalf: false,
      },
      {
        name: 'Masala Chai',
        description: 'Spiced tea',
        basePrice: 30,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Ice-Tea',
    slug: 'ice-tea',
    imageUrl: 'https://buytea.com/cdn/shop/articles/Summer-Explore-Iced-Tea.jpg?v=1682577131',
    items: [
      {
        name: 'Lemon Ice Tea',
        basePrice: 99,
        hasHalf: false,
      },
      {
        name: 'Peach Ice Tea',
        basePrice: 119,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Hot Coffee',
    slug: 'hot-coffee',
    imageUrl:
      'https://t3.ftcdn.net/jpg/05/34/82/24/360_F_534822425_9Ok2L60rSndeunIM6sELPKvuDqzhopX7.jpg',
    items: [],
  },
  {
    name: 'Pasta',
    slug: 'pasta',
    imageUrl: 'https://s.lightorangebean.com/media/20240914160809/Spicy-Penne-Pasta_-done.png',
    items: [
      {
        name: 'White Sauce Pasta',
        basePrice: 179,
        hasHalf: false,
      },
      {
        name: 'Red Sauce Pasta',
        basePrice: 179,
        hasHalf: false,
      },
      {
        name: 'Mix Sauce Pasta',
        basePrice: 189,
        hasHalf: false,
      },
      {
        name: 'Chicken Pasta',
        basePrice: 249,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Sandwich',
    slug: 'sandwich',
    imageUrl:
      'https://img.freepik.com/free-photo/side-view-club-sandwich-with-salted-cucumbers-lemon-olives-round-white-plate_176474-3049.jpg',
    items: [
      {
        name: 'Veg Grilled Sandwich',
        basePrice: 99,
        hasHalf: false,
      },
      {
        name: 'Cheese Corn Sandwich',
        basePrice: 139,
        hasHalf: false,
      },
      {
        name: 'Paneer Tikka Sandwich',
        basePrice: 179,
        hasHalf: false,
      },
      {
        name: 'Chicken Tikka Sandwich',
        basePrice: 179,
        hasHalf: false,
      },
      {
        name: 'Smoked Chicken Sandwich',
        basePrice: 179,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Pizza',
    slug: 'pizza',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591',
    items: [
      {
        name: 'Margherita',
        description: '6" / 9"',
        basePrice: 179,
        halfPrice: 99,
        hasHalf: true,
      },
      {
        name: 'Corn Pizza',
        description: '6" / 9"',
        basePrice: 189,
        halfPrice: 109,
        hasHalf: true,
      },
      {
        name: 'Farmhouse',
        description: '6" / 9"',
        basePrice: 229,
        halfPrice: 149,
        hasHalf: true,
      },
      {
        name: 'Paneer Tikka',
        description: '6" / 9"',
        basePrice: 299,
        halfPrice: 179,
        hasHalf: true,
      },
      {
        name: 'Chicken Tikka',
        description: '6" / 9"',
        basePrice: 299,
        halfPrice: 179,
        hasHalf: true,
      },
      {
        name: 'Smoked Chicken',
        description: '6" / 9"',
        basePrice: 299,
        halfPrice: 179,
        hasHalf: true,
      },
      {
        name: 'Margherita Pizza',
        description: 'Classic tomato and cheese',
        basePrice: 249,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Maggi',
    slug: 'maggi',
    imageUrl: 'https://nfcihospitality.com/wp-content/uploads/2024/09/types-of-Maggi-Noodles.jpg',
    items: [
      {
        name: 'Vegetable Maggi',
        basePrice: 79,
        hasHalf: false,
      },
      {
        name: 'Chilli Garlic Maggi',
        basePrice: 99,
        hasHalf: false,
      },
      {
        name: 'Egg Maggi',
        basePrice: 99,
        hasHalf: false,
      },
      {
        name: 'Extra Masala',
        basePrice: 20,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Fries',
    slug: 'fries',
    imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f390859f',
    items: [
      {
        name: 'Salted Fries',
        basePrice: 99,
        hasHalf: false,
      },
      {
        name: 'Peri-Peri Fries',
        basePrice: 129,
        hasHalf: false,
      },
      {
        name: 'Cheesy Fries',
        basePrice: 149,
        hasHalf: false,
      },
      {
        name: 'Cheesy Dip',
        basePrice: 30,
        hasHalf: false,
      },
      {
        name: 'Jalapeno Dip',
        basePrice: 30,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Slush',
    slug: 'slush',
    imageUrl:
      'https://static.vecteezy.com/system/resources/thumbnails/074/380/819/small/refreshing-slushies-on-ice-a-colorful-and-delicious-treat-photo.jpg',
    items: [
      {
        name: 'Orange Slush',
        basePrice: 149,
        hasHalf: false,
      },
      {
        name: 'Mango Slush',
        basePrice: 149,
        hasHalf: false,
      },
      {
        name: 'Strawberry Slush',
        basePrice: 149,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Garlic Bread',
    slug: 'garlic-bread',
    imageUrl:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTB5dLVCgT8j8evpL38IluG6wt4GJzXjDLzUA',
    items: [
      {
        name: 'Cheese Garlic Bread',
        basePrice: 99,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Noodles',
    slug: 'noodles',
    imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246',
    items: [
      {
        name: 'Veg Noodles',
        description: 'Half / Full',
        basePrice: 149,
        halfPrice: 89,
        hasHalf: true,
      },
      {
        name: 'Hakka Noodles',
        description: 'Half / Full',
        basePrice: 159,
        halfPrice: 89,
        hasHalf: true,
      },
      {
        name: 'Egg Noodles',
        description: 'Half / Full',
        basePrice: 159,
        halfPrice: 109,
        hasHalf: true,
      },
      {
        name: 'Paneer Noodles',
        description: 'Half / Full',
        basePrice: 169,
        halfPrice: 119,
        hasHalf: true,
      },
      {
        name: 'Chicken Noodles',
        description: 'Half / Full',
        basePrice: 169,
        halfPrice: 119,
        hasHalf: true,
      },
    ],
  },
  {
    name: 'Burger',
    slug: 'burger',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd',
    items: [
      {
        name: 'Crunchy Burger',
        basePrice: 119,
        hasHalf: false,
      },
      {
        name: 'Crunchy Chicken Burger',
        basePrice: 179,
        hasHalf: false,
      },
      {
        name: 'Aloo Tikki Burger',
        basePrice: 49,
        hasHalf: false,
      },
      {
        name: 'Veg Burger',
        basePrice: 89,
        hasHalf: false,
      },
      {
        name: 'Veg Cheese Burger',
        basePrice: 109,
        hasHalf: false,
      },
      {
        name: 'Chicken Burger',
        basePrice: 169,
        hasHalf: false,
      },
      {
        name: 'Extra Cheese',
        basePrice: 30,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Rice Bowl (Lunch/Dinner)',
    slug: 'rice',
    imageUrl:
      'https://eatmoreart.org/wp-content/uploads/2020/05/Rajma-Chawal-Indian-Curried-Kidney-Beans-Rice-IMG_1801-500x500.jpg',
    items: [
      {
        name: 'Paneer Butter Masala',
        description: 'Rich and creamy paneer curry',
        basePrice: 260,
        halfPrice: 150,
        hasHalf: true,
      },
      {
        name: 'Dal Tadka',
        description: 'Yellow dal tempered with spices',
        basePrice: 180,
        halfPrice: 110,
        hasHalf: true,
      },
    ],
  },
  {
    name: 'Soup',
    slug: 'soup',
    imageUrl:
      'https://www.suburbansimplicity.com/wp-content/uploads/2021/07/Homemade-Chicken-Soup-from-scratch.jpg',
    items: [
      {
        name: 'Chicken Soup',
        basePrice: 149,
        hasHalf: false,
      },
      {
        name: 'Tomato Soup',
        basePrice: 119,
        hasHalf: false,
      },
      {
        name: 'Sweet Corn Soup',
        basePrice: 119,
        hasHalf: false,
      },
      {
        name: 'Manchow Soup',
        basePrice: 119,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Milkshakes',
    slug: 'milkshakes',
    imageUrl:
      'https://static.vecteezy.com/system/resources/thumbnails/027/470/971/small/cookies-and-cream-milkshake-in-a-takeaway-cup-isolated-on-dark-background-ai-generated-photo.jpg',
    items: [
      {
        name: 'Strawberry',
        basePrice: 149,
        hasHalf: false,
      },
      {
        name: 'Vanilla',
        basePrice: 149,
        hasHalf: false,
      },
      {
        name: 'Butterscotch',
        basePrice: 149,
        hasHalf: false,
      },
      {
        name: 'Cold Chocolate Shake',
        basePrice: 149,
        hasHalf: false,
      },
      {
        name: 'Oreo Shake',
        basePrice: 169,
        hasHalf: false,
      },
      {
        name: 'KitKat Shake',
        basePrice: 199,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Momos',
    slug: 'momos',
    imageUrl:
      'https://plus.unsplash.com/premium_photo-1661600624202-5d2988ebb7b3?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NDB8fG1vbW9zfGVufDB8fDB8fHww',
    items: [
      {
        name: 'Veg Steam (5pc / 8pc)',
        description: '5pcs / 8pcs',
        basePrice: 89,
        halfPrice: 59,
        hasHalf: true,
      },
      {
        name: 'Paneer Steam (5pc / 8pc)',
        description: '5pcs / 8pcs',
        basePrice: 99,
        halfPrice: 69,
        hasHalf: true,
      },
      {
        name: 'Chicken Steam (5pc / 8pc)',
        description: '5pcs / 8pcs',
        basePrice: 99,
        halfPrice: 69,
        hasHalf: true,
      },
      {
        name: 'Veg Fried (5pc / 8pc)',
        description: '5pcs / 8pcs',
        basePrice: 119,
        halfPrice: 79,
        hasHalf: true,
      },
      {
        name: 'Paneer Fried (5pc / 8pc)',
        description: '5pcs / 8pcs',
        basePrice: 119,
        halfPrice: 89,
        hasHalf: true,
      },
      {
        name: 'Chicken Fried (5pc / 8pc)',
        description: '5pcs / 8pcs',
        basePrice: 119,
        halfPrice: 89,
        hasHalf: true,
      },
      {
        name: 'Veg Kurkure (5pc / 8pc)',
        description: '5pcs / 8pcs',
        basePrice: 129,
        halfPrice: 99,
        hasHalf: true,
      },
      {
        name: 'Paneer Kurkure (5pc / 8pc)',
        description: '5pcs / 8pcs',
        basePrice: 129,
        halfPrice: 99,
        hasHalf: true,
      },
      {
        name: 'Chicken Kurkure (5pc / 8pc)',
        description: '5pcs / 8pcs',
        basePrice: 129,
        halfPrice: 99,
        hasHalf: true,
      },
    ],
  },
  {
    name: 'Sweet Corn',
    slug: 'sweet-corn',
    imageUrl: 'https://i.pinimg.com/736x/a1/1a/0f/a11a0fa47f8af26b673e46dbd0541204.jpg',
    items: [
      {
        name: 'Steamed Salted',
        basePrice: 99,
        hasHalf: false,
      },
      {
        name: 'Steamed Peri-Peri',
        basePrice: 129,
        hasHalf: false,
      },
      {
        name: 'Crispy Corn',
        basePrice: 149,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Rolls / Wraps',
    slug: 'rolls-wraps',
    imageUrl:
      'https://img.freepik.com/premium-photo/chicken-wrap-with-vegetables-black-background_846334-741.jpg',
    items: [
      {
        name: 'Egg Roll',
        basePrice: 89,
        hasHalf: false,
      },
      {
        name: 'Paneer Roll',
        basePrice: 129,
        hasHalf: false,
      },
      {
        name: 'Chicken Roll',
        basePrice: 129,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Rice Bowl (Lunch/Dinner)',
    slug: 'rice-bowl-lunchdinner',
    imageUrl:
      'https://eatmoreart.org/wp-content/uploads/2020/05/Rajma-Chawal-Indian-Curried-Kidney-Beans-Rice-IMG_1801-500x500.jpg',
    items: [
      {
        name: 'Rajma Rice',
        basePrice: 79,
        hasHalf: false,
      },
      {
        name: 'Chole Rice',
        basePrice: 79,
        hasHalf: false,
      },
      {
        name: 'Kadhi Rice',
        basePrice: 79,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Hot Beverages',
    slug: 'hot-beverages',
    imageUrl:
      'https://png.pngtree.com/thumb_back/fh260/background/20251009/pngtree-steaming-hot-latte-art-coffee-on-dark-background-image_19820225.webp',
    items: [
      {
        name: 'Black Coffee',
        basePrice: 59,
        hasHalf: false,
      },
      {
        name: 'Hot Coffee',
        basePrice: 79,
        hasHalf: false,
      },
      {
        name: 'Hot Chocolate',
        basePrice: 169,
        hasHalf: false,
      },
      {
        name: 'Hazelnut Hot Coffee',
        basePrice: 149,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Chilli Chicken',
    slug: 'chilli-chicken',
    imageUrl:
      'https://thumbs.dreamstime.com/b/spicy-chilli-chicken-pune-india-white-dish-spicy-chilli-chicken-pune-india-112088232.jpg',
    items: [
      {
        name: 'Chilli Chicken',
        basePrice: 179,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Poha',
    slug: 'poha',
    imageUrl:
      'https://palatesdesire.com/wp-content/uploads/2022/07/Vegetable-diet-poha-recipe@palates-desire.jpg',
    items: [
      {
        name: 'Poha',
        basePrice: 99,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Chicken Popcorn',
    slug: 'chicken-popcorn',
    imageUrl:
      'https://img.pikbest.com/png-images/20250430/popcorn-chicken-pieces-in-a-striped-paper-bucket_11690787.png!sw800',
    items: [
      {
        name: 'Chicken Popcorn ',
        basePrice: 99,
        hasHalf: false,
      },
      {
        name: 'Chicken Popcorn ',
        basePrice: 99,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Dumplings',
    slug: 'dumplings',
    imageUrl:
      'https://img.magnific.com/premium-photo/dim-sum-stuffed-meat-dumplings-pan-with-herbs-black-background-top-view-copy-space_89816-33674.jpg',
    items: [
      {
        name: 'Paneer Dumplings - 8 Pec',
        basePrice: 129,
        hasHalf: false,
      },
      {
        name: 'Chicken Dumplings - 8Pec',
        basePrice: 129,
        hasHalf: false,
      },
    ],
  },
  {
    name: 'Dumplings',
    slug: 'dumplings-2',
    imageUrl:
      'https://img.magnific.com/premium-photo/dim-sum-stuffed-meat-dumplings-pan-with-herbs-black-background-top-view-copy-space_89816-33674.jpg',
    items: [],
  },
  {
    name: 'Chees Balls',
    slug: 'chees-balls',
    imageUrl:
      'https://as2.ftcdn.net/jpg/04/46/60/89/1000_F_446608953_E477hJk86gczC4jAvNJpfR30sN9bTRas.jpg',
    items: [
      {
        name: 'Patato Chees Ball - 6 Pec',
        basePrice: 79,
        hasHalf: false,
      },
      {
        name: 'Patato Chees Ball - 8 Pec',
        basePrice: 99,
        hasHalf: false,
      },
    ],
  },
];

async function seedMenu() {
  console.log('Starting menu seed...');

  // Get the first branch
  const branch = await prisma.branch.findFirst({ orderBy: { id: 'asc' } });

  if (!branch) {
    console.error('No branch found! Please create a branch first.');
    throw new Error('No branch found');
  }

  console.log(`Using branch: ${branch.name} (ID: ${branch.id})`);

  for (const categoryData of menuData) {
    const slug =
      'slug' in categoryData && typeof (categoryData as { slug?: string }).slug === 'string'
        ? (categoryData as { slug: string }).slug
        : null;

    let category = slug
      ? await prisma.menuCategory.findUnique({
          where: { branchId_slug: { branchId: branch.id, slug } },
        })
      : null;
    if (!category) {
      category = await prisma.menuCategory.findFirst({
        where: { name: categoryData.name, branchId: branch.id },
      });
    }

    if (!category) {
      const catPayload: {
        branchId: number;
        name: string;
        imageUrl?: string;
        slug?: string;
      } = { branchId: branch.id, name: categoryData.name };
      if ('imageUrl' in categoryData && categoryData.imageUrl) {
        catPayload.imageUrl = categoryData.imageUrl;
      }
      if (slug) {
        catPayload.slug = slug;
      }
      category = await prisma.menuCategory.create({ data: catPayload });
      console.log(`Created category: ${category.name}`);
    } else {
      console.log(`Category already exists: ${category.name}`);
      if (slug && category.slug !== slug) {
        await prisma.menuCategory.update({
          where: { id: category.id },
          data: {
            slug,
            ...('imageUrl' in categoryData && categoryData.imageUrl
              ? { imageUrl: categoryData.imageUrl }
              : {}),
          },
        });
        console.log(`  - Updated slug -> ${slug}`);
      }
    }

    // Create items for this category
    for (const itemData of categoryData.items) {
      const existingItem = await prisma.menuItem.findFirst({
        where: { name: itemData.name, categoryId: category.id },
      });

      const desc =
        'description' in itemData &&
        typeof (itemData as { description?: string }).description === 'string'
          ? (itemData as { description: string }).description
          : undefined;

      if (!existingItem) {
        await prisma.menuItem.create({
          data: {
            name: itemData.name,
            description: desc ?? null,
            basePrice: itemData.basePrice,
            halfPrice: 'halfPrice' in itemData ? itemData.halfPrice : null,
            hasHalf: itemData.hasHalf,
            categoryId: category.id,
            isActive: true,
          },
        });
        console.log(`  - Created item: ${itemData.name}`);
      } else {
        const nextHalfPrice =
          itemData.hasHalf && 'halfPrice' in itemData ? (itemData.halfPrice ?? null) : null;
        const descChanged = desc != null && existingItem.description !== desc;
        const priceChanged = existingItem.basePrice !== itemData.basePrice;
        const halfToggle = existingItem.hasHalf !== itemData.hasHalf;
        const halfPriceChanged = (existingItem.halfPrice ?? null) !== (nextHalfPrice ?? null);
        if (descChanged || priceChanged || halfToggle || halfPriceChanged) {
          await prisma.menuItem.update({
            where: { id: existingItem.id },
            data: {
              ...(descChanged ? { description: desc } : {}),
              ...(priceChanged ? { basePrice: itemData.basePrice } : {}),
              ...(halfToggle || halfPriceChanged
                ? {
                    hasHalf: itemData.hasHalf,
                    halfPrice: nextHalfPrice,
                  }
                : {}),
            },
          });
          console.log(`  - Updated item: ${itemData.name}`);
        } else {
          console.log(`  - Item already exists: ${itemData.name}`);
        }
      }
    }
  }

  console.log('\nMenu seed completed successfully!');
}

seedMenu()
  .catch(e => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

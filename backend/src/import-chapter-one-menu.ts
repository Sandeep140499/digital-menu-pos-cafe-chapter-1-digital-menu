import 'dotenv/config';
import { prisma } from './config/prisma.js';

type MenuItemSeed = {
  name: string;
  basePrice: number;
  hasHalf?: boolean;
  halfPrice?: number;
  description?: string;
};

type MenuCategorySeed = {
  name: string;
  slug: string;
  imageUrl?: string;
  items: MenuItemSeed[];
};

const BRANCH_ID = Number.parseInt(process.env.MENU_BRANCH_ID || '1', 10);

const menuData: MenuCategorySeed[] = [
  {
    name: 'Cold Coffee',
    slug: 'cold-coffee',
    items: [
      { name: 'Cold Coffee', basePrice: 99 },
      { name: 'Mocha Iced', basePrice: 149 },
      { name: 'Hazelnut Cold Coffee', basePrice: 169 },
    ],
  },
  {
    name: 'Milkshakes',
    slug: 'milkshakes',
    items: [
      { name: 'Strawberry', basePrice: 149 },
      { name: 'Vanilla', basePrice: 149 },
      { name: 'Butterscotch', basePrice: 149 },
      { name: 'Cold Chocolate Shake', basePrice: 149 },
      { name: 'Oreo Shake', basePrice: 169 },
      { name: 'KitKat Shake', basePrice: 199 },
    ],
  },
  {
    name: 'Mocktails',
    slug: 'mocktails',
    items: [
      { name: 'Cucumber', basePrice: 129 },
      { name: 'Virgin Mint Mojito', basePrice: 119 },
      { name: 'Green Apple Refresher', basePrice: 119 },
      { name: 'Watermelon Refresher', basePrice: 119 },
      { name: 'Virgin Strawberry', basePrice: 119 },
      { name: 'Peach Passion', basePrice: 119 },
    ],
  },
  {
    name: 'Ice Tea',
    slug: 'ice-tea',
    items: [
      { name: 'Lemon Ice Tea', basePrice: 99 },
      { name: 'Peach Ice Tea', basePrice: 119 },
    ],
  },
  {
    name: 'Momos',
    slug: 'momos',
    items: [
      {
        name: 'Veg Steam (5pc / 8pc)',
        basePrice: 89,
        hasHalf: true,
        halfPrice: 59,
        description: '5pcs / 8pcs',
      },
      {
        name: 'Paneer Steam (5pc / 8pc)',
        basePrice: 99,
        hasHalf: true,
        halfPrice: 69,
        description: '5pcs / 8pcs',
      },
      {
        name: 'Chicken Steam (5pc / 8pc)',
        basePrice: 99,
        hasHalf: true,
        halfPrice: 69,
        description: '5pcs / 8pcs',
      },
      {
        name: 'Veg Fried (5pc / 8pc)',
        basePrice: 119,
        hasHalf: true,
        halfPrice: 79,
        description: '5pcs / 8pcs',
      },
      {
        name: 'Paneer Fried (5pc / 8pc)',
        basePrice: 119,
        hasHalf: true,
        halfPrice: 89,
        description: '5pcs / 8pcs',
      },
      {
        name: 'Chicken Fried (5pc / 8pc)',
        basePrice: 119,
        hasHalf: true,
        halfPrice: 89,
        description: '5pcs / 8pcs',
      },
      {
        name: 'Veg Kurkure (5pc / 8pc)',
        basePrice: 129,
        hasHalf: true,
        halfPrice: 99,
        description: '5pcs / 8pcs',
      },
      {
        name: 'Paneer Kurkure (5pc / 8pc)',
        basePrice: 129,
        hasHalf: true,
        halfPrice: 99,
        description: '5pcs / 8pcs',
      },
      {
        name: 'Chicken Kurkure (5pc / 8pc)',
        basePrice: 129,
        hasHalf: true,
        halfPrice: 99,
        description: '5pcs / 8pcs',
      },
    ],
  },
  {
    name: 'Pasta',
    slug: 'pasta',
    items: [
      { name: 'White Sauce Pasta', basePrice: 179 },
      { name: 'Red Sauce Pasta', basePrice: 179 },
      { name: 'Mix Sauce Pasta', basePrice: 189 },
      { name: 'Chicken Pasta', basePrice: 249 },
    ],
  },
  {
    name: 'Sandwich',
    slug: 'sandwich',
    items: [
      { name: 'Veg Grilled Sandwich', basePrice: 99 },
      { name: 'Cheese Corn Sandwich', basePrice: 139 },
      { name: 'Paneer Tikka Sandwich', basePrice: 179 },
      { name: 'Chicken Tikka Sandwich', basePrice: 179 },
      { name: 'Smoked Chicken Sandwich', basePrice: 179 },
    ],
  },
  {
    name: 'Pizza',
    slug: 'pizza',
    items: [
      { name: 'Margherita', basePrice: 179, hasHalf: true, halfPrice: 99, description: '6" / 9"' },
      { name: 'Corn Pizza', basePrice: 189, hasHalf: true, halfPrice: 109, description: '6" / 9"' },
      { name: 'Farmhouse', basePrice: 229, hasHalf: true, halfPrice: 149, description: '6" / 9"' },
      {
        name: 'Paneer Tikka',
        basePrice: 299,
        hasHalf: true,
        halfPrice: 179,
        description: '6" / 9"',
      },
      {
        name: 'Chicken Tikka',
        basePrice: 299,
        hasHalf: true,
        halfPrice: 179,
        description: '6" / 9"',
      },
      {
        name: 'Smoked Chicken',
        basePrice: 299,
        hasHalf: true,
        halfPrice: 179,
        description: '6" / 9"',
      },
    ],
  },
  {
    name: 'Maggi',
    slug: 'maggi',
    items: [
      { name: 'Vegetable Maggi', basePrice: 79 },
      { name: 'Chilli Garlic Maggi', basePrice: 99 },
      { name: 'Egg Maggi', basePrice: 99 },
      { name: 'Extra Masala', basePrice: 20 },
    ],
  },
  {
    name: 'Sweet Corn',
    slug: 'sweet-corn',
    items: [
      { name: 'Steamed Salted', basePrice: 99 },
      { name: 'Steamed Peri-Peri', basePrice: 129 },
      { name: 'Crispy Corn', basePrice: 149 },
    ],
  },
  {
    name: 'Fries',
    slug: 'fries',
    items: [
      { name: 'Salted Fries', basePrice: 99 },
      { name: 'Peri-Peri Fries', basePrice: 129 },
      { name: 'Cheesy Fries', basePrice: 149 },
      { name: 'Cheesy Dip', basePrice: 30 },
      { name: 'Jalapeno Dip', basePrice: 30 },
    ],
  },
  {
    name: 'Garlic Bread',
    slug: 'garlic-bread',
    items: [{ name: 'Cheese Garlic Bread', basePrice: 99 }],
  },
  {
    name: 'Burger',
    slug: 'burger',
    items: [
      { name: 'Aloo Tikki Burger', basePrice: 49 },
      { name: 'Veg Burger', basePrice: 89 },
      { name: 'Veg Cheese Burger', basePrice: 109 },
      { name: 'Crunchy Burger', basePrice: 119 },
      { name: 'Chicken Burger', basePrice: 169 },
      { name: 'Crunchy Chicken Burger', basePrice: 179 },
      { name: 'Extra Cheese', basePrice: 30 },
    ],
  },
  {
    name: 'Rolls / Wraps',
    slug: 'rolls-wraps',
    items: [
      { name: 'Egg Roll', basePrice: 89 },
      { name: 'Paneer Roll', basePrice: 129 },
      { name: 'Chicken Roll', basePrice: 129 },
    ],
  },
  {
    name: 'Rice Bowl',
    slug: 'rice-bowl',
    items: [
      { name: 'Rajma Rice', basePrice: 79 },
      { name: 'Chole Rice', basePrice: 79 },
      { name: 'Kadhi Rice', basePrice: 79 },
    ],
  },
  {
    name: 'Noodles',
    slug: 'noodles',
    items: [
      {
        name: 'Veg Noodles',
        basePrice: 149,
        hasHalf: true,
        halfPrice: 89,
        description: 'Half / Full',
      },
      {
        name: 'Hakka Noodles',
        basePrice: 159,
        hasHalf: true,
        halfPrice: 89,
        description: 'Half / Full',
      },
      {
        name: 'Egg Noodles',
        basePrice: 159,
        hasHalf: true,
        halfPrice: 109,
        description: 'Half / Full',
      },
      {
        name: 'Paneer Noodles',
        basePrice: 169,
        hasHalf: true,
        halfPrice: 119,
        description: 'Half / Full',
      },
      {
        name: 'Chicken Noodles',
        basePrice: 169,
        hasHalf: true,
        halfPrice: 119,
        description: 'Half / Full',
      },
    ],
  },
  {
    name: 'Fried Rice',
    slug: 'fried-rice',
    items: [
      {
        name: 'Veg Fried Rice',
        basePrice: 149,
        hasHalf: true,
        halfPrice: 89,
        description: 'Half / Full',
      },
      {
        name: 'Egg Fried Rice',
        basePrice: 159,
        hasHalf: true,
        halfPrice: 99,
        description: 'Half / Full',
      },
      {
        name: 'Paneer Fried Rice',
        basePrice: 169,
        hasHalf: true,
        halfPrice: 109,
        description: 'Half / Full',
      },
      {
        name: 'Chicken Fried Rice',
        basePrice: 169,
        hasHalf: true,
        halfPrice: 109,
        description: 'Half / Full',
      },
    ],
  },
  {
    name: 'Hot Beverages',
    slug: 'hot-beverages',
    items: [
      { name: 'Black Coffee', basePrice: 59 },
      { name: 'Hot Coffee', basePrice: 79 },
      { name: 'Hot Chocolate', basePrice: 169 },
      { name: 'Hazelnut Hot Coffee', basePrice: 149 },
    ],
  },
  {
    name: 'Chai',
    slug: 'chai',
    items: [
      { name: 'Adrak Tea', basePrice: 25 },
      { name: 'Kulhad Adrak Tea', basePrice: 35 },
      { name: 'Lemon Tea', basePrice: 50 },
    ],
  },
  {
    name: 'Soup',
    slug: 'soup',
    items: [
      { name: 'Tomato Soup', basePrice: 119 },
      { name: 'Sweet Corn Soup', basePrice: 119 },
      { name: 'Manchow Soup', basePrice: 119 },
      { name: 'Chicken Soup', basePrice: 149 },
    ],
  },
  {
    name: 'Slush',
    slug: 'slush',
    items: [
      { name: 'Orange Slush', basePrice: 149 },
      { name: 'Mango Slush', basePrice: 149 },
      { name: 'Strawberry Slush', basePrice: 149 },
    ],
  },
  {
    name: 'Chinese Special',
    slug: 'chinese-special',
    items: [{ name: 'Chilli Chicken', basePrice: 179 }],
  },
  {
    name: 'Fresh Smoothies',
    slug: 'fresh-smoothies',
    items: [{ name: 'Strawberry Smoothie', basePrice: 179 }],
  },
  {
    name: 'Quick Bite',
    slug: 'quick-bite',
    items: [{ name: 'Poha', basePrice: 99 }],
  },
];

async function main() {
  if (!Number.isFinite(BRANCH_ID) || BRANCH_ID < 1) {
    throw new Error('MENU_BRANCH_ID must be a positive integer');
  }

  const branch = await prisma.branch.findUnique({ where: { id: BRANCH_ID } });
  if (!branch) {
    throw new Error(`Branch not found: id=${BRANCH_ID}`);
  }

  let createdCategories = 0;
  let updatedCategories = 0;
  let createdItems = 0;
  let updatedItems = 0;
  let hiddenCategories = 0;
  let deactivatedItems = 0;
  const managedCategorySlugs = new Set(menuData.map(category => category.slug));

  for (const category of menuData) {
    const existingCategory = await prisma.menuCategory.findUnique({
      where: {
        branchId_slug: {
          branchId: BRANCH_ID,
          slug: category.slug,
        },
      },
    });

    const savedCategory = await prisma.menuCategory.upsert({
      where: {
        branchId_slug: {
          branchId: BRANCH_ID,
          slug: category.slug,
        },
      },
      update: {
        name: category.name,
        imageUrl: category.imageUrl ?? null,
        showOnMenu: true,
      },
      create: {
        branchId: BRANCH_ID,
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl ?? null,
        showOnMenu: true,
      },
    });

    if (existingCategory) updatedCategories += 1;
    else createdCategories += 1;

    const managedItemNames = new Set(category.items.map(item => item.name));

    for (const item of category.items) {
      const existingItem = await prisma.menuItem.findFirst({
        where: {
          categoryId: savedCategory.id,
          name: item.name,
        },
      });

      if (existingItem) {
        await prisma.menuItem.update({
          where: { id: existingItem.id },
          data: {
            name: item.name,
            description: item.description ?? null,
            basePrice: item.basePrice,
            hasHalf: item.hasHalf ?? false,
            halfPrice: item.hasHalf ? (item.halfPrice ?? null) : null,
            isActive: true,
            categoryId: savedCategory.id,
          },
        });
        updatedItems += 1;
      } else {
        await prisma.menuItem.create({
          data: {
            name: item.name,
            description: item.description ?? null,
            basePrice: item.basePrice,
            hasHalf: item.hasHalf ?? false,
            halfPrice: item.hasHalf ? (item.halfPrice ?? null) : null,
            isActive: true,
            categoryId: savedCategory.id,
          },
        });
        createdItems += 1;
      }
    }

    const staleItems = await prisma.menuItem.findMany({
      where: {
        categoryId: savedCategory.id,
        name: { notIn: Array.from(managedItemNames) },
        isActive: true,
      },
      select: { id: true },
    });

    if (staleItems.length > 0) {
      await prisma.menuItem.updateMany({
        where: { id: { in: staleItems.map(item => item.id) } },
        data: { isActive: false },
      });
      deactivatedItems += staleItems.length;
    }
  }

  const staleCategories = await prisma.menuCategory.findMany({
    where: {
      branchId: BRANCH_ID,
      slug: { notIn: Array.from(managedCategorySlugs) },
      showOnMenu: true,
    },
    select: { id: true },
  });

  if (staleCategories.length > 0) {
    await prisma.menuCategory.updateMany({
      where: { id: { in: staleCategories.map(category => category.id) } },
      data: { showOnMenu: false },
    });

    const staleCategoryIds = staleCategories.map(category => category.id);
    const activeItemsInStaleCategories = await prisma.menuItem.findMany({
      where: {
        categoryId: { in: staleCategoryIds },
        isActive: true,
      },
      select: { id: true },
    });

    if (activeItemsInStaleCategories.length > 0) {
      await prisma.menuItem.updateMany({
        where: { id: { in: activeItemsInStaleCategories.map(item => item.id) } },
        data: { isActive: false },
      });
      deactivatedItems += activeItemsInStaleCategories.length;
    }

    hiddenCategories += staleCategories.length;
  }

  console.log(
    `Chapter 1 menu import complete for branch ${BRANCH_ID}. Categories created: ${createdCategories}, updated: ${updatedCategories}, hidden: ${hiddenCategories}. Items created: ${createdItems}, updated: ${updatedItems}, deactivated: ${deactivatedItems}.`
  );
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

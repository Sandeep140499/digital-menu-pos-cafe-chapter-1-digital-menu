import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const menuData = [
  {
    name: "Cold Coffee",
    imageUrl: "https://jalojog.com/wp-content/uploads/2024/04/Cold_Coffee.jpg",
    items: [
      { name: "Cold Coffee", basePrice: 99, hasHalf: false },
      { name: "Mocha Iced", basePrice: 149, hasHalf: false },
      { name: "Hazelnut Cold Coffee", basePrice: 169, hasHalf: false },
    ],
  },
  {
    name: "Fresh Smoothies",
    slug: "fresh-smoothies",
    imageUrl:
      "https://images.unsplash.com/photo-1553530666-d3408ec28ec0?auto=format&fit=crop&w=1200&q=80",
    items: [
      {
        name: "Strawberries",
        basePrice: 179,
        hasHalf: false,
        description:
          "Fresh strawberry smoothie — pure fruit flavour, naturally refreshing. Light, uplifting, and a delicious better-for-you choice.",
      },
    ],
  },
  {
    name: "Milkshake",
    imageUrl: "https://png.pngtree.com/png-vector/20240819/ourmid/pngtree-chocolate-banana-milkshake-png-image_13347216.png",
    items: [
      { name: "Strawberry", basePrice: 149, hasHalf: false },
      { name: "Vanilla", basePrice: 149, hasHalf: false },
      { name: "Butterscotch", basePrice: 149, hasHalf: false },
      { name: "Cold Chocolate Shake", basePrice: 149, hasHalf: false },
      { name: "Oreo Shake", basePrice: 169, hasHalf: false },
      { name: "Kitkat Shake", basePrice: 199, hasHalf: false },
    ],
  },
  {
    name: "Mocktails",
    imageUrl: "https://s7ap1.scene7.com/is/image/itcportalprod/five-best-mocktails-with-lychee-juice?fmt=webp-alpha",
    items: [
      { name: "Virgin Mint Mojito", basePrice: 119, hasHalf: false },
      { name: "Green Apple Refresher", basePrice: 119, hasHalf: false },
      { name: "Watermelon Refresher", basePrice: 119, hasHalf: false },
      { name: "Virgin Strawberry", basePrice: 119, hasHalf: false },
      { name: "Peach Passion", basePrice: 119, hasHalf: false },
    ],
  },
  {
    name: "Chai",
    imageUrl: "https://imgs.etvbharat.com/etvbharat/prod-images/768-512-17212133-411-17212133-1671088316048.jpg",
    items: [
      { name: "Adrak Tea", basePrice: 25, hasHalf: false },
      { name: "Kulhad Chai", basePrice: 35, hasHalf: false },
      { name: "Lemon Tea", basePrice: 50, hasHalf: false },
    ],
  },
  {
    name: "Ice-Tea",
    imageUrl: "https://buytea.com/cdn/shop/articles/Summer-Explore-Iced-Tea.jpg?v=1682577131",
    items: [
      { name: "Lemon Ice Tea", basePrice: 99, hasHalf: false },
      { name: "Peach Passion", basePrice: 119, hasHalf: false },
    ],
  },
  {
    name: "Hot Coffee",
    imageUrl: "https://t3.ftcdn.net/jpg/05/34/82/24/360_F_534822425_9Ok2L60rSndeunIM6sELPKvuDqzhopX7.jpg",
    items: [
      { name: "Black Coffee", basePrice: 59, hasHalf: false },
      { name: "Hot Coffee", basePrice: 79, hasHalf: false },
      { name: "Hazelnut Hot Coffee", basePrice: 149, hasHalf: false },
      { name: "Hot Chocolate", basePrice: 169, hasHalf: false },
    ],
  },
  {
    name: "Momos - Steam",
    imageUrl: "https://www.thespruceeats.com/thmb/UnVh_-znw7ikMUciZIx5sNqBtTU=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/steamed-momos-wontons-1957616-hero-01-1c59e22bad0347daa8f0dfe12894bc3c.jpg",
    items: [
      { name: "Veg Steam Momos (5pc / 8pc)", basePrice: 89, halfPrice: 59, hasHalf: true },
      { name: "Paneer Steam Momos (5pc / 8pc)", basePrice: 99, halfPrice: 69, hasHalf: true },
      { name: "Chicken Steam Momos (5pc / 8pc)", basePrice: 99, halfPrice: 69, hasHalf: true },
    ],
  },
  {
    name: "Momos - Fried",
    imageUrl: "https://cdn.dotpe.in/longtail/store-items/8635073/KAqPycAS.webp",
    items: [
      { name: "Veg Fried Momos (5pc / 8pc)", basePrice: 119, halfPrice: 79, hasHalf: true },
      { name: "Paneer Fried Momos (5pc / 8pc)", basePrice: 119, halfPrice: 89, hasHalf: true },
      { name: "Chicken Fried Momos (5pc / 8pc)", basePrice: 119, halfPrice: 89, hasHalf: true },
    ],
  },
  {
    name: "Momos - Kurkure",
    imageUrl: "https://c.ndtvimg.com/2022-10/57qe3h68_kurkure-momo_625x300_28_October_22.png?im=FeatureCrop,algorithm=dnn,width=620,height=350?im=FaceCrop,algorithm=dnn,width=1200,height=886",
    items: [
      { name: "Veg Kurkure (5pc / 8pc)", basePrice: 129, halfPrice: 99, hasHalf: true },
      { name: "Paneer Kurkure (5pc / 8pc)", basePrice: 129, halfPrice: 99, hasHalf: true },
      { name: "Chicken Kurkure (5pc / 8pc)", basePrice: 129, halfPrice: 99, hasHalf: true },
    ],
  },
  {
    name: "Pasta",
    imageUrl: "https://s.lightorangebean.com/media/20240914160809/Spicy-Penne-Pasta_-done.png",
    items: [
      { name: "White Sauce Pasta", basePrice: 179, hasHalf: false },
      { name: "Red Sauce Pasta", basePrice: 179, hasHalf: false },
      { name: "Mix Sauce Pasta", basePrice: 189, hasHalf: false },
      { name: "Chicken Pasta (Red/White/Mix)", basePrice: 249, hasHalf: false },
    ],
  },
  {
    name: "Sandwich",
    imageUrl: "https://img.freepik.com/free-photo/side-view-club-sandwich-with-salted-cucumbers-lemon-olives-round-white-plate_176474-3049.jpg",
    items: [
      { name: "Veg Grilled Sandwich", basePrice: 99, hasHalf: false },
      { name: "Cheese Corn Sandwich", basePrice: 139, hasHalf: false },
      { name: "Paneer Tikka Sandwich", basePrice: 179, hasHalf: false },
      { name: "Chicken Tikka Sandwich", basePrice: 179, hasHalf: false },
      { name: "Smoked Chicken Sandwich", basePrice: 179, hasHalf: false },
    ],
  },
  {
    name: "Pizza (6\" / 9\")",
    imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591",
    items: [
      { name: "Margaritta", basePrice: 179, halfPrice: 99, hasHalf: true },
      { name: "Corn Pizza", basePrice: 189, halfPrice: 109, hasHalf: true },
      { name: "Farmhouse", basePrice: 229, halfPrice: 149, hasHalf: true },
      { name: "Paneer Tikka", basePrice: 299, halfPrice: 179, hasHalf: true },
      { name: "Chicken Tikka", basePrice: 299, halfPrice: 179, hasHalf: true },
      { name: "Smoked Chicken", basePrice: 299, halfPrice: 179, hasHalf: true },
    ],
  },
  {
    name: "Maggi",
    imageUrl: "https://nfcihospitality.com/wp-content/uploads/2024/09/types-of-Maggi-Noodles.jpg",
    items: [
      { name: "Vegetable Maggi", basePrice: 79, hasHalf: false },
      { name: "Chilli Garlic Maggi", basePrice: 99, hasHalf: false },
      { name: "Egg Maggi", basePrice: 99, hasHalf: false },
      { name: "Add-on: Extra Masala", basePrice: 20, hasHalf: false },
    ],
  },
  {
    name: "Sweetcorn",
    imageUrl: "https://rakskitchen.net/wp-content/uploads/2022/01/crispy-corn-recipe.jpg",
    items: [
      { name: "Steamed Salted", basePrice: 99, hasHalf: false },
      { name: "Steamed Peri Peri", basePrice: 129, hasHalf: false },
      { name: "Crispy Corn", basePrice: 149, hasHalf: false },
    ],
  },
  {
    name: "Fries",
    imageUrl: "https://images.unsplash.com/photo-1576107232684-1279f390859f",
    items: [
      { name: "Salted Fries", basePrice: 99, hasHalf: false },
      { name: "Peri-Peri Fries", basePrice: 129, hasHalf: false },
      { name: "Cheesy Fries", basePrice: 149, hasHalf: false },
      { name: "Add-on: Cheesy Dip", basePrice: 30, hasHalf: false },
      { name: "Add-on: Jalapeño Dip", basePrice: 30, hasHalf: false },
    ],
  },
  {
    name: "Slush",
    imageUrl: "https://static.vecteezy.com/system/resources/thumbnails/074/380/819/small/refreshing-slushies-on-ice-a-colorful-and-delicious-treat-photo.jpg",
    items: [
      { name: "Orange Slush", basePrice: 149, hasHalf: false },
      { name: "Mango Slush", basePrice: 149, hasHalf: false },
      { name: "Strawberry Slush", basePrice: 149, hasHalf: false },
    ],
  },
  {
    name: "Garlic Bread",
    imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTB5dLVCgT8j8evpL38IluG6wt4GJzXjDLzUA",
    items: [
      { name: "Cheese Garlic Bread", basePrice: 99, hasHalf: false },
    ],
  },
  {
    name: "Noodles",
    imageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246",
    items: [
      { name: "Veg Noodles (Half / Full)", basePrice: 149, halfPrice: 89, hasHalf: true },
      { name: "Hakka Noodles (Half / Full)", basePrice: 159, halfPrice: 89, hasHalf: true },
      { name: "Egg Noodles (Half / Full)", basePrice: 159, halfPrice: 109, hasHalf: true },
      { name: "Paneer Noodles (Half / Full)", basePrice: 169, halfPrice: 119, hasHalf: true },
      { name: "Chicken Noodles (Half / Full)", basePrice: 169, halfPrice: 119, hasHalf: true },
    ],
  },
  {
    name: "Rice",
    slug: "fried-rice",
    imageUrl: "https://i.ibb.co/6Pjw8H4/rice.jpg",
    items: [
      { name: "Chicken Fried Rice", basePrice: 169, halfPrice: 109, hasHalf: true },
      { name: "Paneer Fried Rice", basePrice: 159, halfPrice: 109, hasHalf: true },
      { name: "Egg Fried Rice", basePrice: 159, halfPrice: 99, hasHalf: true },
      { name: "Veg Fried Rice", basePrice: 149, halfPrice: 89, hasHalf: true },
    ],
  },
  {
    name: "Burger",
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd",
    items: [
      { name: "Aloo Tikki Burger", basePrice: 49, hasHalf: false },
      { name: "Veg Burger", basePrice: 89, hasHalf: false },
      { name: "Veg Cheese Burger", basePrice: 109, hasHalf: false },
      { name: "Crunchy Burger", basePrice: 119, hasHalf: false },
      { name: "Chicken Burger", basePrice: 169, hasHalf: false },
      { name: "Crunchy Chicken Burger", basePrice: 179, hasHalf: false },
      { name: "Add-on: Extra Cheese", basePrice: 30, hasHalf: false },
    ],
  },
  {
    name: "Chapter Roll / Wrap",
    imageUrl: "https://manjulaskitchen.com/wp-content/uploads/vegetable_kathi_roll.jpg",
    items: [
      { name: "Egg Roll", basePrice: 89, hasHalf: false },
      { name: "Paneer Roll", basePrice: 129, hasHalf: false },
      { name: "Chicken Roll", basePrice: 129, hasHalf: false },
    ],
  },
  {
    name: "Poha",
    imageUrl: "https://palatesdesire.com/wp-content/uploads/2022/07/Vegetable-diet-poha-recipe@palates-desire.jpg",
    items: [
      { name: "Poha", basePrice: 99, hasHalf: false },
    ],
  },
  {
    name: "Rice Bowl (Lunch/Dinner)",
    imageUrl: "https://eatmoreart.org/wp-content/uploads/2020/05/Rajma-Chawal-Indian-Curried-Kidney-Beans-Rice-IMG_1801-500x500.jpg",
    items: [
      { name: "Rajma Rice", basePrice: 79, hasHalf: false },
      { name: "Chole Rice", basePrice: 79, hasHalf: false },
      { name: "Kadhi Rice", basePrice: 79, hasHalf: false },
    ],
  },
  {
    name: "Soup",
    imageUrl: "https://www.suburbansimplicity.com/wp-content/uploads/2021/07/Homemade-Chicken-Soup-from-scratch.jpg",
    items: [
      { name: "Tomato Soup", basePrice: 119, hasHalf: false },
      { name: "Sweetcorn Soup", basePrice: 119, hasHalf: false },
      { name: "Manchow Soup", basePrice: 119, hasHalf: false },
      { name: "Chicken Soup", basePrice: 149, hasHalf: false },
    ],
  },
];

async function seedMenu() {
  console.log("Starting menu seed...");
  
  // Get the first branch
  const branch = await prisma.branch.findFirst();
  
  if (!branch) {
    console.error("No branch found! Please create a branch first.");
    throw new Error("No branch found");
  }

  console.log(`Using branch: ${branch.name} (ID: ${branch.id})`);

  for (const categoryData of menuData) {
    const slug =
      "slug" in categoryData && typeof (categoryData as { slug?: string }).slug === "string"
        ? (categoryData as { slug: string }).slug
        : null;

    let category = slug
      ? await prisma.menuCategory.findUnique({ where: { slug } })
      : null;
    if (!category) {
      category = await prisma.menuCategory.findFirst({
        where: { name: categoryData.name },
      });
    }

    if (!category) {
      const catPayload: {
        name: string;
        imageUrl?: string;
        slug?: string;
      } = { name: categoryData.name };
      if ("imageUrl" in categoryData && categoryData.imageUrl) {
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
            ...("imageUrl" in categoryData && categoryData.imageUrl
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
        "description" in itemData && typeof (itemData as { description?: string }).description === "string"
          ? (itemData as { description: string }).description
          : undefined;

      if (!existingItem) {
        await prisma.menuItem.create({
          data: {
            name: itemData.name,
            description: desc ?? null,
            basePrice: itemData.basePrice,
            halfPrice: "halfPrice" in itemData ? itemData.halfPrice : null,
            hasHalf: itemData.hasHalf,
            categoryId: category.id,
            isActive: true,
          },
        });
        console.log(`  - Created item: ${itemData.name}`);
      } else {
        const nextHalfPrice =
          itemData.hasHalf && "halfPrice" in itemData ? itemData.halfPrice ?? null : null;
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

  console.log("\nMenu seed completed successfully!");
}

seedMenu()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

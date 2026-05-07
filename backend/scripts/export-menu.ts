import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

async function exportMenu() {
  const branch = await prisma.branch.findFirst({ orderBy: { id: "asc" } });
  if (!branch) throw new Error("No branch found");

  const categories = await prisma.menuCategory.findMany({
    where: { branchId: branch.id },
    include: {
      items: true,
    },
    orderBy: {
      id: "asc"
    }
  });

  const menuData = categories.map(cat => {
    return {
      name: cat.name,
      slug: cat.slug,
      imageUrl: cat.imageUrl || undefined,
      items: cat.items.map(item => ({
        name: item.name,
        description: item.description || undefined,
        basePrice: item.basePrice,
        halfPrice: item.halfPrice || undefined,
        hasHalf: item.hasHalf
      }))
    };
  });

  const tsContent = `import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const menuData = ${JSON.stringify(menuData, null, 2)};

async function seedMenu() {
  console.log("Starting menu seed...");
  
  // Get the first branch
  const branch = await prisma.branch.findFirst({ orderBy: { id: "asc" } });
  
  if (!branch) {
    console.error("No branch found! Please create a branch first.");
    throw new Error("No branch found");
  }

  console.log(\`Using branch: \${branch.name} (ID: \${branch.id})\`);

  for (const categoryData of menuData) {
    const slug =
      "slug" in categoryData && typeof (categoryData as { slug?: string }).slug === "string"
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
      if ("imageUrl" in categoryData && categoryData.imageUrl) {
        catPayload.imageUrl = categoryData.imageUrl;
      }
      if (slug) {
        catPayload.slug = slug;
      }
      category = await prisma.menuCategory.create({ data: catPayload });
      console.log(\`Created category: \${category.name}\`);
    } else {
      console.log(\`Category already exists: \${category.name}\`);
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
        console.log(\`  - Updated slug -> \${slug}\`);
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
        console.log(\`  - Created item: \${itemData.name}\`);
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
          console.log(\`  - Updated item: \${itemData.name}\`);
        } else {
          console.log(\`  - Item already exists: \${itemData.name}\`);
        }
      }
    }
  }

  console.log("\\nMenu seed completed successfully!");
}

seedMenu()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
`;

  fs.writeFileSync("prisma/seed-menu-exported.ts", tsContent, "utf8");
  console.log("Exported to prisma/seed-menu-exported.ts");
}

exportMenu()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

export type PricingType = 'single' | 'half_full' | 'size' | 'quantity' | 'custom';

export interface PricingConfig {
  type: PricingType;
  options?: string[]; // For size/quantity: ["6 inch", "9 inch"] or ["5 pcs", "8 pcs"]
  labels?: string[]; // Display labels
}

export interface MenuItemData {
  id: number;
  name: string;
  prices?: {
    single?: number;
    half?: number;
    full?: number;
    option1?: number;
    option2?: number;
  };
  price?: number;
  halfPrice?: number;
  isNewLaunch?: boolean;
  isBestSeller?: boolean;
}

export interface MenuCategoryData {
  id: number;
  name: string;
  image: string;
  isNewLaunch?: boolean;
  isBestSeller?: boolean;
  pricingType?: PricingType;
  pricingConfig?: PricingConfig;
  hasHalfFull?: boolean;
  halfFullLabel?: string;
  items: MenuItemData[];
}

let _id = 1;
const nid = () => _id++;

export const MENU_CATEGORIES: MenuCategoryData[] = [
  {
    id: 1,
    name: 'Cold Coffee',
    image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=80',
    isNewLaunch: true,
    items: [
      { id: nid(), name: 'Cold Coffee', price: 99 },
      { id: nid(), name: 'Mocha Iced', price: 149 },
      { id: nid(), name: 'Hazelnut Cold Coffee', price: 169 },
    ],
  },
  {
    id: 2,
    name: 'Milkshakes',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80',
    isBestSeller: true,
    items: [
      { id: nid(), name: 'Strawberry', price: 149 },
      { id: nid(), name: 'Vanilla', price: 149 },
      { id: nid(), name: 'Butterscotch', price: 149 },
      { id: nid(), name: 'Cold Chocolate Shake', price: 149 },
      { id: nid(), name: 'Oreo Shake', price: 169, isBestSeller: true },
      { id: nid(), name: 'KitKat Shake', price: 199, isBestSeller: true },
    ],
  },
  {
    id: 3,
    name: 'Mocktails',
    image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&q=80',
    isNewLaunch: true,
    items: [
      { id: nid(), name: 'Cucumber', price: 129 },
      { id: nid(), name: 'Virgin Mint Mojito', price: 119 },
      { id: nid(), name: 'Green Apple Refresher', price: 119 },
      { id: nid(), name: 'Watermelon Refresher', price: 119 },
      { id: nid(), name: 'Virgin Strawberry', price: 119 },
      { id: nid(), name: 'Peach Passion', price: 119 },
    ],
  },
  {
    id: 4,
    name: 'Ice Tea',
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',
    items: [
      { id: nid(), name: 'Lemon Ice Tea', price: 99 },
      { id: nid(), name: 'Peach Ice Tea', price: 119 },
    ],
  },
  {
    id: 5,
    name: 'Momos',
    image: 'https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=400&q=80',
    hasHalfFull: true,
    halfFullLabel: '5pcs / 8pcs',
    isBestSeller: true,
    items: [
      { id: nid(), name: 'Veg Steam', price: 89, halfPrice: 59, isBestSeller: true },
      { id: nid(), name: 'Paneer Steam', price: 99, halfPrice: 69 },
      { id: nid(), name: 'Chicken Steam', price: 99, halfPrice: 69 },
      { id: nid(), name: 'Veg Fried', price: 119, halfPrice: 79 },
      { id: nid(), name: 'Paneer Fried', price: 119, halfPrice: 89 },
      { id: nid(), name: 'Chicken Fried', price: 119, halfPrice: 89 },
      { id: nid(), name: 'Veg Kurkure', price: 129, halfPrice: 99 },
      { id: nid(), name: 'Paneer Kurkure', price: 129, halfPrice: 99 },
      { id: nid(), name: 'Chicken Kurkure', price: 129, halfPrice: 99 },
    ],
  },
  {
    id: 6,
    name: 'Pasta',
    image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&q=80',
    items: [
      { id: nid(), name: 'White Sauce Pasta', price: 179 },
      { id: nid(), name: 'Red Sauce Pasta', price: 179 },
      { id: nid(), name: 'Mix Sauce Pasta', price: 189 },
      { id: nid(), name: 'Chicken Pasta', price: 249 },
    ],
  },
  {
    id: 7,
    name: 'Sandwich',
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80',
    items: [
      { id: nid(), name: 'Veg Grilled Sandwich', price: 99 },
      { id: nid(), name: 'Cheese Corn Sandwich', price: 139 },
      { id: nid(), name: 'Paneer Tikka Sandwich', price: 179 },
      { id: nid(), name: 'Chicken Tikka Sandwich', price: 179 },
      { id: nid(), name: 'Smoked Chicken Sandwich', price: 179 },
    ],
  },
  {
    id: 8,
    name: 'Pizza',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80',
    hasHalfFull: true,
    halfFullLabel: '6" / 9"',
    isBestSeller: true,
    items: [
      { id: nid(), name: 'Margherita', price: 179, halfPrice: 99, isBestSeller: true },
      { id: nid(), name: 'Corn Pizza', price: 189, halfPrice: 109 },
      { id: nid(), name: 'Farmhouse', price: 229, halfPrice: 149 },
      { id: nid(), name: 'Paneer Tikka', price: 299, halfPrice: 179 },
      { id: nid(), name: 'Chicken Tikka', price: 299, halfPrice: 179 },
      { id: nid(), name: 'Smoked Chicken', price: 299, halfPrice: 179 },
    ],
  },
  {
    id: 9,
    name: 'Maggi',
    image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400&q=80',
    items: [
      { id: nid(), name: 'Vegetable Maggi', price: 79 },
      { id: nid(), name: 'Chilli Garlic Maggi', price: 99 },
      { id: nid(), name: 'Egg Maggi', price: 99 },
      { id: nid(), name: 'Extra Masala', price: 20 },
    ],
  },
  {
    id: 10,
    name: 'Sweet Corn',
    image: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400&q=80',
    items: [
      { id: nid(), name: 'Steamed Salted', price: 99 },
      { id: nid(), name: 'Steamed Peri-Peri', price: 129 },
      { id: nid(), name: 'Crispy Corn', price: 149 },
    ],
  },
  {
    id: 11,
    name: 'Fries',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80',
    items: [
      { id: nid(), name: 'Salted Fries', price: 99 },
      { id: nid(), name: 'Peri-Peri Fries', price: 129 },
      { id: nid(), name: 'Cheesy Fries', price: 149 },
      { id: nid(), name: 'Cheesy Dip', price: 30 },
      { id: nid(), name: 'Jalapeño Dip', price: 30 },
    ],
  },
  {
    id: 12,
    name: 'Garlic Bread',
    image: 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=400&q=80',
    items: [{ id: nid(), name: 'Cheese Garlic Bread', price: 99 }],
  },
  {
    id: 13,
    name: 'Burger',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
    isBestSeller: true,
    items: [
      { id: nid(), name: 'Aloo Tikki Burger', price: 49 },
      { id: nid(), name: 'Veg Burger', price: 89 },
      { id: nid(), name: 'Veg Cheese Burger', price: 109 },
      { id: nid(), name: 'Crunchy Burger', price: 119 },
      { id: nid(), name: 'Chicken Burger', price: 169, isBestSeller: true },
      { id: nid(), name: 'Crunchy Chicken Burger', price: 179, isBestSeller: true },
      { id: nid(), name: 'Extra Cheese', price: 30 },
    ],
  },
  {
    id: 14,
    name: 'Rolls / Wraps',
    image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80',
    items: [
      { id: nid(), name: 'Egg Roll', price: 89 },
      { id: nid(), name: 'Paneer Roll', price: 129 },
      { id: nid(), name: 'Chicken Roll', price: 129 },
    ],
  },
  {
    id: 15,
    name: 'Rice Bowl',
    image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&q=80',
    items: [
      { id: nid(), name: 'Rajma Rice', price: 79 },
      { id: nid(), name: 'Chole Rice', price: 79 },
      { id: nid(), name: 'Kadhi Rice', price: 79 },
    ],
  },
  {
    id: 16,
    name: 'Noodles',
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80',
    hasHalfFull: true,
    halfFullLabel: 'Half / Full',
    items: [
      { id: nid(), name: 'Veg Noodles', price: 149, halfPrice: 89 },
      { id: nid(), name: 'Hakka Noodles', price: 159, halfPrice: 89 },
      { id: nid(), name: 'Egg Noodles', price: 159, halfPrice: 109 },
      { id: nid(), name: 'Paneer Noodles', price: 169, halfPrice: 119 },
      { id: nid(), name: 'Chicken Noodles', price: 169, halfPrice: 119 },
    ],
  },
  {
    id: 17,
    name: 'Fried Rice',
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&q=80',
    hasHalfFull: true,
    halfFullLabel: 'Half / Full',
    items: [
      { id: nid(), name: 'Veg Fried Rice', price: 149, halfPrice: 89 },
      { id: nid(), name: 'Egg Fried Rice', price: 159, halfPrice: 99 },
      { id: nid(), name: 'Paneer Fried Rice', price: 169, halfPrice: 109 },
      { id: nid(), name: 'Chicken Fried Rice', price: 169, halfPrice: 109 },
    ],
  },
  {
    id: 18,
    name: 'Hot Beverages',
    image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400&q=80',
    items: [
      { id: nid(), name: 'Black Coffee', price: 59 },
      { id: nid(), name: 'Hot Coffee', price: 79 },
      { id: nid(), name: 'Hot Chocolate', price: 169 },
      { id: nid(), name: 'Hazelnut Hot Coffee', price: 149 },
    ],
  },
  {
    id: 19,
    name: 'Chai',
    image: 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&q=80',
    items: [
      { id: nid(), name: 'Adrak Tea', price: 25 },
      { id: nid(), name: 'Kulhad Adrak Tea', price: 35 },
      { id: nid(), name: 'Lemon Tea', price: 50 },
    ],
  },
  {
    id: 20,
    name: 'Soup',
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80',
    items: [
      { id: nid(), name: 'Tomato Soup', price: 119 },
      { id: nid(), name: 'Sweet Corn Soup', price: 119 },
      { id: nid(), name: 'Manchow Soup', price: 119 },
      { id: nid(), name: 'Chicken Soup', price: 149 },
    ],
  },
  {
    id: 21,
    name: 'Slush',
    image: 'https://images.unsplash.com/photo-1570831739435-6601aa3fa4fb?w=400&q=80',
    isNewLaunch: true,
    items: [
      { id: nid(), name: 'Orange Slush', price: 149 },
      { id: nid(), name: 'Mango Slush', price: 149 },
      { id: nid(), name: 'Strawberry Slush', price: 149 },
    ],
  },
  {
    id: 22,
    name: 'Chilli Chicken',
    image: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=400&q=80',
    items: [{ id: nid(), name: 'Chilli Chicken', price: 179 }],
  },
  {
    id: 23,
    name: 'Fresh Smoothies',
    image: 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400&q=80',
    isNewLaunch: true,
    items: [{ id: nid(), name: 'Strawberry Smoothie', price: 179 }],
  },
  {
    id: 24,
    name: 'Poha',
    image: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=400&q=80',
    items: [{ id: nid(), name: 'Poha', price: 99 }],
  },
];

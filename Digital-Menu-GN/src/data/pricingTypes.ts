const STORAGE_KEY = 'cc1_pricing_types';

export interface PricingTypeOption {
  id: string;
  label: string;
  value: string;
}

export interface CustomPricingType {
  id: string;
  name: string;
  description?: string;
  options: PricingTypeOption[];
  isBuiltIn: boolean;
  isActive: boolean;
  createdAt: string;
}

const DEFAULT_PRICING_TYPES: CustomPricingType[] = [
  {
    id: 'single',
    name: 'Single Price',
    description: 'Only one price per item',
    options: [],
    isBuiltIn: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'half_full',
    name: 'Half / Full',
    description: 'Two portion sizes - Half and Full',
    options: [
      { id: 'half', label: 'Half', value: 'half' },
      { id: 'full', label: 'Full', value: 'full' },
    ],
    isBuiltIn: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'size',
    name: 'Size (6" / 9")',
    description: 'Pizza sizes - 6 inch and 9 inch',
    options: [
      { id: '6_inch', label: '6 inch', value: 'option1' },
      { id: '9_inch', label: '9 inch', value: 'option2' },
    ],
    isBuiltIn: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'quantity',
    name: 'Quantity (5 pcs / 8 pcs)',
    description: 'Momos quantity - 5 pieces and 8 pieces',
    options: [
      { id: '5_pcs', label: '5 pcs', value: 'option1' },
      { id: '8_pcs', label: '8 pcs', value: 'option2' },
    ],
    isBuiltIn: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export function getPricingTypes(): CustomPricingType[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CustomPricingType[];
      const customTypes = parsed.filter(p => !p.isBuiltIn);
      return [...DEFAULT_PRICING_TYPES, ...customTypes];
    }
  } catch {
    console.error('Error loading pricing types');
  }
  return [...DEFAULT_PRICING_TYPES];
}

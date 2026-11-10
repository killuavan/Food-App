import { mapOpenFoodFactsNutrition, type NutritionProfile } from '../utils/usdaNutrition';
import type { FoodCategory, MeasurementUnit } from '../utils/foodInventory';

export interface ScannedFoodProduct {
  barcode: string;
  name: string;
  brand: string;
  imageUrl: string;
  packageDescription: string;
  servingSize: string;
  categories: string;
  ingredients: string;
  category: FoodCategory;
  packageAmount: number | null;
  packageUnit: MeasurementUnit | null;
  nutritionProfile: NutritionProfile | null;
}

interface OpenFoodFactsResponse {
  status?: number;
  status_verbose?: string;
  product?: {
    code?: string;
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    image_front_url?: string;
    image_url?: string;
    quantity?: string;
    serving_size?: string;
    categories?: string;
    ingredients_text?: string;
    nutriments?: Record<string, unknown>;
  };
}

const productCache = new Map<string, { expiresAt: number; product: ScannedFoodProduct | null }>();
const pendingRequests = new Map<string, Promise<ScannedFoodProduct | null>>();
const cacheDurationMs = 10 * 60 * 1000;
const allowedBarcode = /^(?:\d{8}|\d{12,13})$/;

export function normalizeFoodBarcode(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

export function isSupportedFoodBarcode(value: string): boolean {
  return allowedBarcode.test(normalizeFoodBarcode(value));
}

function mapCategory(categories: string): FoodCategory {
  const normalized = categories.toLocaleLowerCase();
  if (/\bfruit|fruits\b/.test(normalized)) return 'Fruits';
  if (/\bvegetable|vegetables\b/.test(normalized)) return 'Vegetables';
  if (/\bmeat|poultry\b/.test(normalized)) return 'Meat';
  if (/\bfish|seafood\b/.test(normalized)) return 'Seafood';
  if (/\bdairy|milk|yogurt|cheese\b/.test(normalized)) return 'Dairy';
  if (/\bcereal|grain|bread|rice|pasta\b/.test(normalized)) return 'Grains';
  if (/\bbeverage|drink|juice\b/.test(normalized)) return 'Beverages';
  if (/\bcanned\b/.test(normalized)) return 'Canned Goods';
  if (/\bsnack|chips\b/.test(normalized)) return 'Snacks';
  return 'Others';
}

function parsePackageAmount(value: string): { amount: number; unit: MeasurementUnit } | null {
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i);
  if (!match) return null;
  const amount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2].toLocaleLowerCase();
  if (unit === 'kg') return { amount, unit: 'kg' };
  if (unit === 'g') return { amount, unit: 'g' };
  if (unit === 'ml') return { amount, unit: 'mL' };
  return { amount, unit: 'L' };
}

function mapProduct(barcode: string, raw: OpenFoodFactsResponse): ScannedFoodProduct | null {
  const product = raw.product;
  const name = product?.product_name?.trim() || product?.product_name_en?.trim() || '';
  if (raw.status !== 1 || !product || !name) return null;
  const categories = product.categories ?? '';
  const packageDescription = product.quantity?.trim() ?? '';
  const nutritionProfile: NutritionProfile | null = product.nutriments
    ? mapOpenFoodFactsNutrition({ ...product, code: product.code || barcode })
    : null;
  const parsedPackageAmount = parsePackageAmount(packageDescription);
  return {
    barcode,
    name,
    brand: product.brands?.trim() ?? '',
    imageUrl: product.image_front_url || product.image_url || '',
    packageDescription,
    servingSize: product.serving_size?.trim() ?? '',
    categories,
    ingredients: product.ingredients_text?.trim() ?? '',
    category: mapCategory(categories),
    packageAmount: parsedPackageAmount?.amount ?? null,
    packageUnit: parsedPackageAmount?.unit ?? null,
    nutritionProfile,
  };
}

export async function getOpenFoodFactsProduct(barcodeValue: string): Promise<ScannedFoodProduct | null> {
  const barcode = normalizeFoodBarcode(barcodeValue);
  if (!isSupportedFoodBarcode(barcode)) {
    throw new Error('Enter a valid EAN-8, EAN-13, UPC-A, or UPC-E barcode.');
  }

  const cached = productCache.get(barcode);
  if (cached && cached.expiresAt > Date.now()) return cached.product;
  const pending = pendingRequests.get(barcode);
  if (pending) return pending;

  const request = (async (): Promise<ScannedFoodProduct | null> => {
    let response: Response;
    try {
      response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,product_name_en,brands,image_front_url,image_url,quantity,serving_size,categories,ingredients_text,nutriments`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'PersonalFoodInventory/1.0 (Ionic Vue; Capacitor)',
          },
        },
      );
    } catch (error) {
      throw new Error(
        error instanceof Error && error.name === 'TypeError'
          ? 'Unable to reach Open Food Facts. Check your internet connection and try again.'
          : `Unable to retrieve product details: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (response.status === 429) {
      throw new Error('Open Food Facts rate limit reached. Wait briefly before trying again.');
    }
    if (!response.ok) {
      throw new Error(`Open Food Facts request failed (HTTP ${response.status}). Try again later.`);
    }

    let data: OpenFoodFactsResponse;
    try {
      data = await response.json() as OpenFoodFactsResponse;
    } catch {
      throw new Error('Open Food Facts returned an unreadable response.');
    }
    const product = mapProduct(barcode, data);
    productCache.set(barcode, { expiresAt: Date.now() + cacheDurationMs, product });
    return product;
  })();
  pendingRequests.set(barcode, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(barcode);
  }
}

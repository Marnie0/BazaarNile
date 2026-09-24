import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
const currency = new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 });
export const money = (value: string | number) => currency.format(Number(value));
export const FREE_SHIPPING_THRESHOLD = 1500;
export const SHIPPING_FEE = 75;
export const shippingFor = (subtotal: number) => subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
export const discountPercent = (price: string | number, compareAt?: string | number | null) => {
  const current = Number(price); const original = Number(compareAt);
  return compareAt && original > current ? Math.round((1 - current / original) * 100) : 0;
};
export const formatDate = (value: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) => new Date(value).toLocaleString('en-EG', options);

// Shoppers see a red "Only N left" nudge at or below URGENT_STOCK; admins are warned earlier.
export const URGENT_STOCK = 3;
export const LOW_STOCK = 5;
export type StockLevel = 'out' | 'urgent' | 'low' | 'ok';
export const stockLevel = (inventory: number): StockLevel =>
  inventory <= 0 ? 'out' : inventory <= URGENT_STOCK ? 'urgent' : inventory <= LOW_STOCK ? 'low' : 'ok';

export const priceLabel = (min: string, max: string) =>
  min && max ? `${money(min)} – ${money(max)}` : min ? `${money(min)} & above` : max ? `Under ${money(max)}` : '';

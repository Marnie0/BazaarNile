export const API_URL = import.meta.env.VITE_API_URL ?? '/api';

let accessToken: string | null = localStorage.getItem('bn_access_token');
export const hasAccessToken = () => Boolean(accessToken);
export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) localStorage.setItem('bn_access_token', token);
  else localStorage.removeItem('bn_access_token');
};

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(path: string, init: RequestInit, canRefresh: boolean): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  if (response.status === 401 && canRefresh && !path.startsWith('/auth/')) {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (refreshed.ok) {
      const session = await refreshed.json() as { accessToken: string };
      setAccessToken(session.accessToken);
      return request<T>(path, init, false);
    }
    setAccessToken(null);
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(error.message ?? 'Request failed', response.status);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, true);
}

export type User = { id?: string; email?: string; username: string; displayName: string; avatarUrl?: string; bio?: string; role: string; createdAt: string };
export type Category = { id: string; name: string; slug: string; description?: string; imageUrl?: string; _count?: { products: number } };
export type Product = { id: string; name: string; slug: string; description: string; price: string; compareAt?: string; imageUrl: string; images: string[]; inventory: number; featured: boolean; category: Category; seller: Pick<User, 'username' | 'displayName' | 'avatarUrl' | 'bio'> };
export type CartItem = { id: string; quantity: number; product: Product };
export type Cart = { id: string; items: CartItem[]; updatedAt: string };
export type WishlistItem = { id: string; product: Product; createdAt: string };
export type OrderItem = { id: string; productId?: string; productName: string; productSlug: string; imageUrl: string; unitPrice: string; quantity: number; lineTotal: string };
export type Order = {
  id: string; orderNumber: string; status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  paymentMethod: 'CASH_ON_DELIVERY'; paymentStatus: string; subtotal: string; shippingFee: string; total: string;
  shippingName: string; shippingPhone: string; shippingAddress: string; shippingCity: string; shippingRegion: string;
  notes?: string; items: OrderItem[]; createdAt: string; updatedAt: string;
};

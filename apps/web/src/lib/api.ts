// Production is served by the same Vercel project as the API. Never allow a
// developer's local VITE_API_URL to be baked into a production storefront.
export const API_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? '/api');

let accessToken: string | null = localStorage.getItem('bn_access_token');
let refreshPromise: Promise<string | null> | null = null;
const accessTokenListeners = new Set<() => void>();
export const hasAccessToken = () => Boolean(accessToken);
export const subscribeToAccessToken = (listener: () => void) => {
  accessTokenListeners.add(listener);
  return () => accessTokenListeners.delete(listener);
};
export const setAccessToken = (token: string | null) => {
  const changed = accessToken !== token;
  accessToken = token;
  if (token) localStorage.setItem('bn_access_token', token);
  else localStorage.removeItem('bn_access_token');
  if (changed) accessTokenListeners.forEach((listener) => listener());
};

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return null;
        const session = await response.json() as { accessToken: string };
        setAccessToken(session.accessToken);
        return session.accessToken;
      })
      .catch(() => null)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit, canRefresh: boolean): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  } catch {
    throw new ApiError('Unable to reach BazaarNile. Check your connection and try again.', 0);
  }
  const refreshable = !['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].includes(path);
  if (response.status === 401 && canRefresh && refreshable) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, init, false);
    }
    setAccessToken(null);
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' })) as { message?: string; issues?: { message?: string }[] };
    throw new ApiError(error.issues?.[0]?.message ?? error.message ?? 'Request failed', response.status);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, true);
}

export type User = { id?: string; email?: string; username: string; displayName: string; avatarUrl?: string; bio?: string; role: 'CUSTOMER' | 'SELLER' | 'ADMIN'; status?: 'ACTIVE' | 'SUSPENDED'; createdAt: string };
export type Category = { id: string; name: string; slug: string; description?: string; imageUrl?: string; _count?: { products: number } };
export type Product = { id: string; name: string; slug: string; description: string; price: string; compareAt?: string; imageUrl: string; images: string[]; inventory: number; featured: boolean; status?: ProductStatus; category: Category; seller: Pick<User, 'username' | 'displayName' | 'avatarUrl' | 'bio'> };
export type Recommendations = { products: Product[]; personalized: boolean; reason: string };
export type CartItem = { id: string; quantity: number; product: Product };
export type Cart = { id: string; items: CartItem[]; updatedAt: string };
export type WishlistItem = { id: string; product: Product; createdAt: string };
export type OrderItem = { id: string; productId?: string; productName: string; productSlug: string; imageUrl: string; unitPrice: string; quantity: number; lineTotal: string };
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type Order = {
  id: string; orderNumber: string; status: OrderStatus;
  paymentMethod: 'CASH_ON_DELIVERY'; paymentStatus: string; subtotal: string; shippingFee: string; total: string;
  shippingName: string; shippingPhone: string; shippingAddress: string; shippingCity: string; shippingRegion: string;
  notes?: string; items: OrderItem[]; createdAt: string; updatedAt: string;
};
export type ProductStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'REJECTED' | 'ARCHIVED';
export type SellerProduct = Product & { status: ProductStatus; updatedAt: string; _count: { orderItems: number } };
export type SellerOverview = {
  metrics: { revenue: string; grossSales: string; unitsSold: number; totalProducts: number; activeProducts: number; lowStock: number; outOfStock: number };
  chart: { date: string; revenue: string }[];
  recentSales: (OrderItem & { order: { orderNumber: string; status: Order['status']; shippingName: string; createdAt: string } })[];
  topProducts: { productName: string; units: number; revenue: string }[];
};
export type AdminUser = User & { id: string; email: string; status: 'ACTIVE' | 'SUSPENDED'; updatedAt: string; _count: { products: number; orders: number } };
export type AdminProduct = SellerProduct & { seller: Pick<AdminUser, 'id' | 'username' | 'displayName' | 'avatarUrl'> };
export type AdminOrder = Order & { user: Pick<AdminUser, 'id' | 'username' | 'displayName' | 'email'> };
export type AdminOverview = {
  metrics: { totalUsers: number; newUsers: number; sellers: number; suspendedUsers: number; totalProducts: number; activeProducts: number; pendingProducts: number; totalOrders: number; openOrders: number; grossMerchandiseValue: string; averageOrderValue: string };
  chart: { date: string; revenue: string; orders: number }[];
  topSellers: { id: string; displayName: string; username: string; avatarUrl?: string; revenue: string; orders: number }[];
  recentUsers: AdminUser[];
};

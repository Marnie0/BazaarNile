export const API_URL = import.meta.env.VITE_API_URL ?? '/api';

let accessToken: string | null = localStorage.getItem('bn_access_token');
export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) localStorage.setItem('bn_access_token', token);
  else localStorage.removeItem('bn_access_token');
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message ?? 'Request failed');
  }
  return response.status === 204 ? undefined as T : response.json();
}

export type User = { id?: string; email?: string; username: string; displayName: string; avatarUrl?: string; bio?: string; role: string; createdAt: string };
export type Category = { id: string; name: string; slug: string; description?: string; imageUrl?: string; _count?: { products: number } };
export type Product = { id: string; name: string; slug: string; description: string; price: string; compareAt?: string; imageUrl: string; images: string[]; inventory: number; featured: boolean; category: Category; seller: Pick<User, 'username' | 'displayName' | 'avatarUrl' | 'bio'> };

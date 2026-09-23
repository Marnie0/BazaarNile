import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast, toastError } from '../lib/toast';
import { api, type Product, type WishlistItem } from '../lib/api';
import { useIsAuthenticated } from './useSession';

type WishlistData = { items: WishlistItem[] };

export function useWishlist(product: Product | undefined) {
  const queryClient = useQueryClient();
  const authenticated = useIsAuthenticated();
  const wishlist = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => api<WishlistData>('/wishlist'),
    enabled: authenticated,
    retry: false,
  });
  const saved = Boolean(product && wishlist.data?.items.some((item) => item.product.id === product.id));
  const toggle = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error('Product not found');
      if (saved) {
        await api<void>(`/wishlist/${product.id}`, { method: 'DELETE' });
        return { saved: false as const };
      }
      const result = await api<{ item: WishlistItem }>(`/wishlist/${product.id}`, { method: 'POST' });
      return { saved: true as const, item: result.item };
    },
    onSuccess: (result) => {
      queryClient.setQueryData<WishlistData>(['wishlist'], (current) => {
        if (!current) return result.saved && 'item' in result ? { items: [result.item] } : { items: [] };
        if (!result.saved) return { items: current.items.filter((item) => item.product.id !== product?.id) };
        if (current.items.some((item) => item.product.id === product?.id)) return current;
        return { items: [result.item, ...current.items] };
      });
      toast(result.saved ? 'Saved to your wishlist' : 'Removed from your wishlist', result.saved ? { action: { label: 'View', to: '/wishlist' } } : {});
    },
    onError: (error) => toastError(error, 'Could not update your wishlist'),
  });
  return { saved: toggle.isPending ? !saved : saved, toggle: toggle.mutate, isPending: toggle.isPending, error: toggle.error };
}

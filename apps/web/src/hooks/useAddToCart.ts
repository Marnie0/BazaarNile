import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast, toastError } from '../lib/toast';
import { api, type Cart, type Product, type Variant } from '../lib/api';
import { t } from '../lib/i18n';

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ product, quantity, variant }: { product: Pick<Product, 'id' | 'name'>; quantity: number; variant?: Variant }) =>
      api<{ cart: Cart }>('/cart/items', { method: 'POST', body: JSON.stringify({ productId: product.id, variantId: variant?.id, quantity }) }),
    onSuccess: (result, { product, quantity, variant }) => {
      queryClient.setQueryData(['cart'], result);
      const item = `${product.name}${variant ? ` (${variant.options.join(' / ')})` : ''}`;
      toast(quantity > 1 ? t('{count} × {item} added to your cart', { count: quantity, item }) : t('{item} added to your cart', { item }), { action: { label: t('View cart'), to: '/cart' } });
    },
    onError: (error) => toastError(error, t('Could not add this item to your cart')),
  });
}

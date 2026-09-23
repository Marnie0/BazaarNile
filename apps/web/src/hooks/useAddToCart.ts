import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast, toastError } from '../lib/toast';
import { api, type Cart, type Product } from '../lib/api';

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ product, quantity }: { product: Pick<Product, 'id' | 'name'>; quantity: number }) =>
      api<{ cart: Cart }>('/cart/items', { method: 'POST', body: JSON.stringify({ productId: product.id, quantity }) }),
    onSuccess: (result, { product, quantity }) => {
      queryClient.setQueryData(['cart'], result);
      toast(`${quantity > 1 ? `${quantity} × ` : ''}${product.name} added to your cart`, { action: { label: 'View cart', to: '/cart' } });
    },
    onError: (error) => toastError(error, 'Could not add this item to your cart'),
  });
}

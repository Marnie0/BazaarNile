import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { EmptyState, PageIntro } from '../components/PageState';
import { ProductCard } from '../components/ProductCard';
import { ProductSkeleton } from '../components/Skeleton';
import { Button } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, ApiError, type WishlistItem } from '../lib/api';

export function WishlistPage() {
  useDocumentTitle('Wishlist');
  const { data, isLoading, error } = useQuery({ queryKey: ['wishlist'], queryFn: () => api<{ items: WishlistItem[] }>('/wishlist'), retry: false });
  if (error instanceof ApiError && error.status === 401) return <AuthRequired title="Save your favorite finds"/>;
  const items = data?.items ?? [];
  return <main className="container-shell py-10 sm:py-14">
    <PageIntro eyebrow="Saved for later" title="Your wishlist">{items.length > 0 && `${items.length} saved item${items.length === 1 ? '' : 's'}. Tap the heart to remove one.`}</PageIntro>
    {isLoading ? <div className="product-grid mt-8">{Array.from({ length: 4 }, (_, index) => <ProductSkeleton key={index}/>)}</div>
      : !items.length ? <EmptyState icon={Heart} title="Nothing saved yet" action={<Button asChild><Link to="/shop">Explore the bazaar</Link></Button>}>Tap the heart on any product to keep it here for later.</EmptyState>
      : <div className="product-grid mt-8">{items.map(({ product }) => <ProductCard key={product.id} product={product}/>)}</div>}
  </main>;
}

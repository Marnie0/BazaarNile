import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { api, type Product, type User } from '../lib/api';

export function ProfilePage() {
  const { username } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['profile', username], queryFn: () => api<{ user: User & { products: Product[] } }>(`/profiles/${username}`) });
  if (isLoading) return <main className="container-shell py-20">Loading profile…</main>;
  if (!data) return <main className="container-shell py-20">Profile not found.</main>;
  const user = data.user;
  return <main className="container-shell py-14"><section className="rounded-[2rem] bg-sand p-8 md:flex md:items-center md:gap-6 md:p-12"><div className="grid size-24 shrink-0 place-items-center rounded-full bg-nile font-display text-4xl font-bold text-white">{user.displayName[0]}</div><div><p className="mt-4 text-sm font-bold uppercase tracking-widest text-nile md:mt-0">{user.role}</p><h1 className="mt-1 font-display text-4xl font-bold">{user.displayName}</h1><p className="mt-1 text-ink/45">@{user.username}</p><p className="mt-3 max-w-xl text-ink/65">{user.bio ?? 'A member of the BazaarNile community.'}</p></div></section><h2 className="mt-14 font-display text-3xl font-bold">Products</h2><div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">{user.products.map((p) => <ProductCard product={{ ...p, seller: user }} key={p.id}/>)}</div></main>;
}


import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Image as ImageIcon, PackageX, Save, Store } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { EmptyState, PageIntro, PageLoader } from '../components/PageState';
import { toast } from '../lib/toast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { api, ApiError, type Category, type SellerProduct, type User } from '../lib/api';
import { money } from '../lib/utils';

export function SellerProductFormPage() {
  const { id } = useParams(); const editing = Boolean(id); const navigate = useNavigate(); const queryClient = useQueryClient();
  useDocumentTitle(editing ? 'Edit listing' : 'New product');
  const [preview, setPreview] = useState({ name: '', price: '', imageUrl: '' }); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User }>('/auth/me'), retry: false });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<{ categories: Category[] }>('/categories') });
  const product = useQuery({ queryKey: ['seller-product', id], queryFn: () => api<{ product: SellerProduct }>(`/seller/products/${id}`), enabled: editing, retry: false });
  useEffect(() => { const saved = product.data?.product; if (saved) setPreview({ name: saved.name, price: saved.price, imageUrl: saved.imageUrl }); }, [product.data]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const extraImages = String(form.extraImages ?? '').split(/\s+/).map((url) => url.trim()).filter(Boolean);
    const { extraImages: _omit, ...fields } = form; void _omit;
    const payload = { ...fields, price: Number(form.price), compareAt: form.compareAt ? Number(form.compareAt) : null, inventory: Number(form.inventory), images: [...new Set([String(form.imageUrl), ...extraImages])].slice(0, 8) };
    try {
      await api(`/seller/products${editing ? `/${id}` : ''}`, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      await Promise.all(['seller-products', 'seller-overview', 'seller-product', 'products', 'product'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      toast(editing ? 'Listing saved' : form.status === 'DRAFT' ? 'Draft saved' : 'Product submitted for review');
      navigate('/seller');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this product'); window.scrollTo({ top: 0, behavior: 'smooth' }); } finally { setBusy(false); }
  };
  if (me.error instanceof ApiError && me.error.status === 401) return <AuthRequired title="Sign in to manage products"/>;
  if (me.isLoading || categories.isLoading || (editing && product.isLoading)) return <PageLoader label="Preparing product editor…"/>;
  if (me.data?.user.role !== 'SELLER' && me.data?.user.role !== 'ADMIN') return <main className="container-shell"><EmptyState icon={Store} title="Activate your seller account first" action={<Button asChild><Link to="/seller">Go to Seller Center</Link></Button>}>Seller tools let you publish products and manage inventory.</EmptyState></main>;
  if (editing && !product.data) return <main className="container-shell"><EmptyState icon={PackageX} title="Product not found" action={<Button asChild><Link to="/seller">Back to Seller Center</Link></Button>}>It may have been deleted.</EmptyState></main>;
  const saved = product.data?.product;
  const extraImages = saved?.images.filter((url) => url !== saved.imageUrl).join('\n');
  return <main className="container-shell py-10 sm:py-12"><Link to="/seller" className="inline-flex items-center gap-2 text-sm font-semibold text-ink/60 hover:text-nile"><ArrowLeft size={16}/>Seller Center</Link>
    <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_340px]"><section><PageIntro eyebrow="Product catalog" title={editing ? 'Edit listing' : 'New product'}>{saved?.status === 'ACTIVE' ? 'Changes to a live listing are published immediately.' : 'New and resubmitted listings are reviewed by our team before they appear in the shop.'}</PageIntro>
      {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <form id="product-form" onSubmit={submit} className="surface mt-7 grid gap-6 p-6 sm:p-8">
        <Field label="Product name"><Input name="name" required minLength={3} maxLength={120} defaultValue={saved?.name} onChange={(event) => setPreview((value) => ({ ...value, name: event.target.value }))} placeholder="e.g. Handwoven cotton throw"/></Field>
        <Field label="Description" hint="At least 20 characters. Materials, size, and care instructions help shoppers decide."><Textarea className="min-h-36 resize-y" name="description" required minLength={20} maxLength={3000} defaultValue={saved?.description} placeholder="Tell shoppers what makes this product special…"/></Field>
        <div className="grid gap-5 sm:grid-cols-2"><Field label="Price (EGP)"><Input name="price" type="number" inputMode="decimal" min="1" step="0.01" required defaultValue={saved?.price} onChange={(event) => setPreview((value) => ({ ...value, price: event.target.value }))}/></Field><Field label="Compare-at price" hint="Optional — the original price, shown struck through"><Input name="compareAt" type="number" inputMode="decimal" min="1" step="0.01" defaultValue={saved?.compareAt}/></Field></div>
        <div className="grid gap-5 sm:grid-cols-2"><Field label="Category"><Select name="categoryId" required defaultValue={saved?.category.id ?? ''}><option value="" disabled>Choose a category</option>{categories.data?.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</Select></Field><Field label="Inventory"><Input name="inventory" type="number" inputMode="numeric" min="0" step="1" required defaultValue={saved?.inventory ?? 0}/></Field></div>
        <Field label="Main image URL" hint="An https:// link to a square, high-resolution photo"><Input name="imageUrl" type="url" pattern="https?://.+" required value={preview.imageUrl} onChange={(event) => setPreview((value) => ({ ...value, imageUrl: event.target.value }))} placeholder="https://…"/></Field>
        <Field label="More images" hint="Optional — up to 7 more https:// links, one per line"><Textarea className="min-h-24 resize-y font-mono text-xs" name="extraImages" defaultValue={extraImages} placeholder="https://…"/></Field>
        <Field label="Listing status"><Select name="status" defaultValue={saved?.status ?? 'PENDING'}>{saved?.status === 'ACTIVE' && <option value="ACTIVE">Active — visible in the shop</option>}{saved?.status === 'REJECTED' && <option value="REJECTED">Rejected — edit and resubmit</option>}<option value="PENDING">Submit for admin review</option><option value="DRAFT">Draft — only visible to you</option><option value="ARCHIVED">Archived — no longer for sale</option></Select></Field>
        <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" asChild><Link to="/seller">Cancel</Link></Button><Button disabled={busy}><Save size={17}/>{busy ? 'Saving…' : editing ? 'Save changes' : 'Submit product'}</Button></div>
      </form></section>
      <aside className="lg:sticky lg:top-24 lg:pt-24"><div className="rounded-2xl bg-sand p-5"><p className="eyebrow">Live preview</p><div className="mt-4 aspect-[4/5] overflow-hidden rounded-2xl bg-white">{preview.imageUrl ? <img key={preview.imageUrl} src={preview.imageUrl} alt="Product preview" className="size-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }}/> : <div className="grid size-full place-items-center text-ink/25"><ImageIcon size={38}/></div>}</div><h2 className="mt-4 line-clamp-2 font-semibold">{preview.name || 'Your product'}</h2><p className="mt-1 font-bold">{Number(preview.price) > 0 ? money(preview.price) : 'EGP —'}</p><p className="mt-3 text-xs leading-5 text-ink/55">This is how your listing will appear in the shop grid.</p></div></aside>
    </div>
  </main>;
}

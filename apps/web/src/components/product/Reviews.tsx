import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, MessageSquareText, PenLine, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMe } from '../../hooks/useSession';
import { api, type MyReview, type Product, type Review, type ReviewPage } from '../../lib/api';
import { confirmAction } from '../../lib/confirm';
import { toast, toastError } from '../../lib/toast';
import { formatDate } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Field';
import { Stars, StarInput } from '../ui/Stars';

type Sort = 'recent' | 'highest' | 'lowest';

export function Reviews({ product }: { product: Pick<Product, 'id' | 'slug' | 'name'> }) {
  const queryClient = useQueryClient(); const location = useLocation();
  const { authenticated, user } = useMe();
  const [sort, setSort] = useState<Sort>('recent');
  const [rating, setRating] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const reviews = useInfiniteQuery({
    queryKey: ['reviews', product.id, sort, rating], initialPageParam: 1,
    queryFn: ({ pageParam }) => api<ReviewPage>(`/products/${product.id}/reviews?sort=${sort}&page=${pageParam}${rating ? `&rating=${rating}` : ''}`),
    getNextPageParam: (last) => last.pagination.page < last.pagination.pages ? last.pagination.page + 1 : undefined,
  });
  const mine = useQuery({ queryKey: ['my-review', product.id], queryFn: () => api<MyReview>(`/products/${product.id}/reviews/mine`), enabled: authenticated });
  const refresh = () => Promise.all([['reviews', product.id], ['my-review', product.id], ['product', product.slug]].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  const remove = useMutation({
    mutationFn: (review: Review) => review.user.username === user?.username
      ? api<void>(`/products/${product.id}/reviews/mine`, { method: 'DELETE' }) : api<void>(`/admin/reviews/${review.id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast('Review removed'); setEditing(false); await refresh(); },
    onError: (error) => toastError(error, 'Could not remove the review'),
  });

  const first = reviews.data?.pages[0];
  const summary = first?.summary;
  const list = reviews.data?.pages.flatMap((page) => page.reviews) ?? [];
  const own = mine.data?.review;
  const confirmRemove = async (review: Review) => {
    const yours = review.user.username === user?.username;
    if (await confirmAction({ title: yours ? 'Delete your review?' : `Remove ${review.user.displayName}’s review?`, message: yours ? 'Your rating will no longer count toward this product.' : 'The review is removed for everyone and the rating is recalculated.', confirmLabel: yours ? 'Delete review' : 'Remove review', tone: 'danger' })) remove.mutate(review);
  };

  return <section id="reviews" className="mt-20 scroll-mt-24 border-t border-ink/10 pt-12" aria-labelledby="reviews-title">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow">What shoppers say</p><h2 id="reviews-title" className="mt-2 font-display text-3xl font-semibold">Ratings &amp; reviews</h2></div>
      {!authenticated ? <Button variant="outline" asChild><Link to="/login" state={{ from: `${location.pathname}#reviews` }}><PenLine size={16}/>Sign in to write a review</Link></Button>
        : mine.data?.canReview && !own && !editing && <Button variant="outline" onClick={() => setEditing(true)}><PenLine size={16}/>Write a review</Button>}
    </div>

    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[300px_1fr] lg:gap-12">
      <aside className="surface p-6 lg:sticky lg:top-24">
        {summary ? <>
          <div className="flex items-end gap-3"><p className="font-display text-5xl font-semibold leading-none">{summary.count ? summary.average.toFixed(1) : '–'}</p><div className="pb-1"><Stars value={summary.average} size={17}/><p className="mt-1 text-xs text-ink/55">{summary.count ? `${summary.count} review${summary.count === 1 ? '' : 's'}` : 'No reviews yet'}</p></div></div>
          <div className="mt-5 grid gap-1.5">{([5, 4, 3, 2, 1] as const).map((stars) => {
            const count = summary.distribution[stars]; const share = summary.count ? (count / summary.count) * 100 : 0; const active = rating === stars;
            return <button key={stars} type="button" disabled={!count} onClick={() => setRating(active ? null : stars)} aria-pressed={active} aria-label={`${stars} star reviews: ${count}${active ? ', filtering' : ''}`}
              className={`grid grid-cols-[2.2rem_1fr_2rem] items-center gap-2 rounded-lg px-1.5 py-1 text-xs transition disabled:cursor-default disabled:opacity-50 ${active ? 'bg-nile-light/70 font-semibold' : 'enabled:hover:bg-sand'}`}>
              <span className="text-left">{stars} ★</span>
              <span className="h-2 overflow-hidden rounded-full bg-ink/8"><span className="block h-full rounded-full bg-gold" style={{ width: `${share}%` }}/></span>
              <span className="text-right text-ink/55">{count}</span>
            </button>;
          })}</div>
        </> : <div className="h-40 animate-pulse rounded-xl bg-ink/6"/>}
      </aside>

      <div className="min-w-0">
        {authenticated && mine.data && !mine.data.canReview && mine.data.reason && <p className="mb-5 rounded-xl bg-sand/70 p-3.5 text-sm text-ink/65">{mine.data.reason}.</p>}
        {editing && <ReviewForm productId={product.id} existing={own ?? undefined} verified={mine.data?.verifiedPurchase ?? false} onDone={async (review) => {
          // Show the saved review straight away; the list and rating summary refresh behind it.
          queryClient.setQueryData<MyReview>(['my-review', product.id], (current) => current && { ...current, review });
          setEditing(false); await refresh();
        }} onCancel={() => setEditing(false)}/>}
        {own && !editing && <div className="mb-6 rounded-2xl border border-nile/20 bg-nile-light/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-nile">Your review</p><div className="flex gap-1"><Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={() => setEditing(true)}><PenLine size={15}/>Edit</Button><Button variant="ghost" className="px-3 py-1.5 text-sm text-red-700 hover:bg-red-50" disabled={remove.isPending} onClick={() => confirmRemove(own)}><Trash2 size={15}/>Delete</Button></div></div>
          <ReviewBody review={own}/>
        </div>}

        {(summary?.count ?? 0) > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 pb-4">
          <p className="text-sm text-ink/60" aria-live="polite">{rating ? <>Showing {first?.pagination.total} {rating}-star review{first?.pagination.total === 1 ? '' : 's'} · <button type="button" className="font-semibold text-nile hover:underline" onClick={() => setRating(null)}>Show all</button></> : `${summary!.count} review${summary!.count === 1 ? '' : 's'}`}</p>
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-ink/60">Sort by<select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="field select-field rounded-full py-2 pr-8 text-sm text-ink"><option value="recent">Most recent</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option></select></label>
        </div>}

        {reviews.isLoading ? <div className="mt-4 grid gap-4">{[0, 1, 2].map((index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-ink/6"/>)}</div>
          : summary && !summary.count ? <div className="grid place-items-center rounded-2xl border border-dashed border-ink/15 px-6 py-12 text-center"><MessageSquareText size={28} className="text-ink/30"/><p className="mt-3 font-semibold">No reviews yet</p><p className="mt-1 max-w-sm text-sm text-ink/55">Bought {product.name}? Share what you think to help other shoppers decide.</p></div>
          : <ul className="divide-y divide-ink/8">{list.map((review) => <li key={review.id} className="py-6">
            <div className="flex items-start gap-3">
              {review.user.avatarUrl ? <img src={review.user.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover"/> : <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sand font-semibold text-ink/70" aria-hidden="true">{review.user.displayName.charAt(0)}</span>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><p className="font-semibold">{review.user.displayName}</p><time className="text-xs text-ink/50" dateTime={review.createdAt}>{formatDate(review.createdAt)}</time></div>
                {review.verified && <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-emerald-700"><BadgeCheck size={14}/>Verified purchase</p>}
                <ReviewBody review={review}/>
                {user?.role === 'ADMIN' && review.user.username !== user.username && <button type="button" onClick={() => confirmRemove(review)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:underline"><Trash2 size={13}/>Remove review</button>}
              </div>
            </div>
          </li>)}</ul>}
        {reviews.hasNextPage && <Button variant="outline" className="mt-4 w-full sm:w-auto" disabled={reviews.isFetchingNextPage} onClick={() => reviews.fetchNextPage()}>{reviews.isFetchingNextPage ? 'Loading…' : 'Show more reviews'}</Button>}
      </div>
    </div>
  </section>;
}

function ReviewBody({ review }: { review: Review }) {
  return <div className="mt-2">
    <div className="flex flex-wrap items-center gap-2"><Stars value={review.rating} size={15}/>{review.title && <p className="font-semibold">{review.title}</p>}</div>
    <p className="mt-2 whitespace-pre-line text-[0.95rem] leading-7 text-ink/75">{review.body}</p>
  </div>;
}

function ReviewForm({ productId, existing, verified, onDone, onCancel }: { productId: string; existing?: Review; verified: boolean; onDone: (review: Review) => void; onCancel: () => void }) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? '');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: (data: { rating: number; title?: string; body: string }) => api<{ review: Review }>(`/products/${productId}/reviews/mine`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: ({ review }) => { toast(existing ? 'Your review was updated' : 'Thanks! Your review is live'); onDone(review); },
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Could not save your review'),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    // Checked here rather than by the browser so the rating, the most important part, is flagged first.
    if (!rating) { setError('Choose a star rating'); return; }
    if (body.trim().length < 10) { setError('Tell other shoppers a little more — at least 10 characters'); return; }
    const title = String(new FormData(event.currentTarget).get('title') ?? '').trim();
    save.mutate({ rating, title: title || undefined, body: body.trim() });
  };
  return <form onSubmit={submit} noValidate className="surface mb-6 grid gap-4 p-5 sm:p-6" aria-label={existing ? 'Edit your review' : 'Write a review'}>
    <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-display text-2xl font-semibold">{existing ? 'Edit your review' : 'Write a review'}</h3>{verified && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700"><BadgeCheck size={14}/>Verified purchase</span>}</div>
    <StarInput value={rating} onChange={(value) => { setRating(value); setError(''); }}/>
    <Field label="Headline" optional><Input name="title" defaultValue={existing?.title ?? ''} maxLength={80} placeholder="Sum it up in a few words"/></Field>
    <Field label="Your review" hint={`${body.trim().length}/2000 · What did you like or dislike? How did you use it?`}><Textarea value={body} onChange={(event) => setBody(event.target.value)} required minLength={10} maxLength={2000} className="min-h-32" placeholder="Share details that would help another shopper"/></Field>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={save.isPending}>{save.isPending ? 'Saving…' : existing ? 'Save changes' : 'Post review'}</Button><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button></div>
  </form>;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Package, Sparkles, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { Button } from '../components/ui/Button';
import { api, ApiError, type Notification } from '../lib/api';

const icons = { ORDER: Package, SELLER: Store, PROMOTION: Sparkles, SYSTEM: Bell };

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ notifications: Notification[]; unreadCount: number }>('/notifications?limit=50'), retry: false, refetchInterval: 30_000 });
  const read = useMutation({ mutationFn: (id: string) => api<void>(`/notifications/${id}/read`, { method: 'PATCH' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
  const readAll = useMutation({ mutationFn: () => api<void>('/notifications/read-all', { method: 'PATCH' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }) });
  if (query.error instanceof ApiError && query.error.status === 401) return <AuthRequired title="Sign in to see notifications"/>;
  if (query.isLoading) return <main className="container-shell py-20">Loading notifications…</main>;
  const notifications = query.data?.notifications ?? [];
  return <main className="container-shell py-14"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-nile">Marketplace updates</p><h1 className="mt-2 font-display text-5xl font-bold">Notifications</h1></div>{Boolean(query.data?.unreadCount) && <Button variant="outline" disabled={readAll.isPending} onClick={() => readAll.mutate()}><CheckCheck size={17}/>Mark all as read</Button>}</div>
    {!notifications.length ? <div className="grid min-h-[50vh] place-items-center text-center"><div><Bell className="mx-auto text-nile" size={42}/><h2 className="mt-5 font-display text-3xl font-bold">You’re all caught up</h2><p className="mt-2 text-ink/50">Order and seller updates will appear here.</p><Button className="mt-6" asChild><Link to="/shop">Continue shopping</Link></Button></div></div> : <div className="mt-9 grid gap-3">{notifications.map((notification) => { const Icon = icons[notification.type]; const content = <><span className={`grid size-11 shrink-0 place-items-center rounded-full ${notification.readAt ? 'bg-sand text-ink/45' : 'bg-nile-light text-nile'}`}><Icon size={19}/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="font-semibold">{notification.title}</h2>{!notification.readAt && <span className="size-2 rounded-full bg-gold"/>}</div><p className="mt-1 text-sm text-ink/55">{notification.message}</p><p className="mt-2 text-xs text-ink/35">{new Date(notification.createdAt).toLocaleString('en-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p></div></>; return notification.link ? <Link key={notification.id} to={notification.link} onClick={() => { if (!notification.readAt) read.mutate(notification.id); }} className={`flex gap-4 rounded-2xl border p-4 transition hover:border-nile/30 ${notification.readAt ? 'border-ink/8 bg-white' : 'border-nile/15 bg-white shadow-sm'}`}>{content}</Link> : <button key={notification.id} onClick={() => { if (!notification.readAt) read.mutate(notification.id); }} className={`flex gap-4 rounded-2xl border p-4 text-left ${notification.readAt ? 'border-ink/8 bg-white' : 'border-nile/15 bg-white shadow-sm'}`}>{content}</button>; })}</div>}
  </main>;
}

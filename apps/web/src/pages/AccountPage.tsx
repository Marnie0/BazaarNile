import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, KeyRound, MapPin, Pencil, Plus, Star, Trash2, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AddressFields } from '../components/AddressFields';
import { AuthRequired } from '../components/AuthRequired';
import { PageIntro, PageLoader } from '../components/PageState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Field, Input, Textarea } from '../components/ui/Field';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api, ApiError, setAccessToken, type Address, type User } from '../lib/api';
import { confirmAction } from '../lib/confirm';
import { toast, toastError } from '../lib/toast';
import { cn } from '../lib/utils';

const tabs = [
  { key: 'profile', label: 'Profile', icon: UserRound },
  { key: 'addresses', label: 'Addresses', icon: MapPin },
  { key: 'security', label: 'Password', icon: KeyRound },
] as const;
type Tab = (typeof tabs)[number]['key'];

export function AccountPage() {
  useDocumentTitle('Account settings');
  const [params, setParams] = useSearchParams();
  const tab: Tab = tabs.some((item) => item.key === params.get('tab')) ? params.get('tab') as Tab : 'profile';
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User }>('/auth/me'), retry: false });
  if (me.error instanceof ApiError && me.error.status === 401) return <AuthRequired title="Sign in to manage your account"/>;
  if (me.isLoading || !me.data) return <PageLoader label="Loading your account…"/>;
  const user = me.data.user;

  return <main className="container-shell py-10 sm:py-14">
    <PageIntro eyebrow="Your account" title="Account settings">Manage how you appear on BazaarNile, where we deliver, and how you sign in.</PageIntro>
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[230px_1fr] lg:gap-10">
      <nav aria-label="Account sections" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:grid lg:gap-1 lg:overflow-visible lg:px-0">
        {tabs.map(({ key, label, icon: Icon }) => <button key={key} type="button" onClick={() => setParams(key === 'profile' ? {} : { tab: key }, { replace: true })} aria-current={tab === key ? 'page' : undefined}
          className={cn('flex shrink-0 items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-semibold transition lg:rounded-xl', tab === key ? 'bg-ink text-white' : 'bg-white text-ink/70 hover:text-ink lg:bg-transparent lg:hover:bg-white')}>
          <Icon size={17}/>{label}
        </button>)}
      </nav>
      <div className="min-w-0">
        {tab === 'profile' && <ProfileSection user={user}/>}
        {tab === 'addresses' && <AddressesSection/>}
        {tab === 'security' && <PasswordSection/>}
      </div>
    </div>
  </main>;
}

const avatarPattern = 'https?://.+';

function ProfileSection({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [avatar, setAvatar] = useState(user.avatarUrl ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const save = useMutation({
    mutationFn: (data: Record<string, unknown>) => api<{ user: User }>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (result) => { queryClient.setQueryData(['me'], result); toast('Profile saved'); },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    save.mutate({ displayName: String(form.get('displayName') ?? '').trim(), bio: bio.trim() || null, avatarUrl: avatar.trim() || null });
  };
  return <form onSubmit={submit} className="surface grid gap-5 p-6 sm:p-8">
    <div><h2 className="font-display text-2xl font-semibold">Profile</h2><p className="mt-1 text-sm text-ink/55">Shown on your reviews and, if you sell, on your shop page.</p></div>
    <div className="flex items-center gap-4">
      {avatar.match(/^https?:\/\/.+/) ? <img src={avatar} alt="" className="size-16 rounded-full object-cover" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} onLoad={(event) => { event.currentTarget.style.visibility = ''; }}/> : <span className="grid size-16 place-items-center rounded-full bg-nile font-display text-2xl font-semibold text-white">{user.displayName.charAt(0)}</span>}
      <div className="min-w-0 text-sm"><p className="truncate font-semibold">@{user.username}</p><p className="truncate text-ink/55">{user.email}</p><Link to={`/profiles/${user.username}`} className="mt-1 inline-block font-semibold text-nile hover:underline">View public profile</Link></div>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Display name"><Input name="displayName" defaultValue={user.displayName} required minLength={2} maxLength={60} autoComplete="name"/></Field>
      <Field label="Photo URL" optional hint="A link to a square image (https://…)"><Input type="url" value={avatar} onChange={(event) => setAvatar(event.target.value)} pattern={avatarPattern} maxLength={1000} placeholder="https://"/></Field>
      <Field label="Bio" optional className="sm:col-span-2" hint={`${bio.length}/280`}><Textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} placeholder="A sentence or two about you or your shop"/></Field>
    </div>
    {save.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{save.error instanceof Error ? save.error.message : 'Could not save your profile'}</p>}
    <div><Button disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save profile'}</Button></div>
  </form>;
}

function AddressForm({ address, onDone }: { address?: Address; onDone: () => void }) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (data: Record<string, unknown>) => address
      ? api<{ address: Address }>(`/account/addresses/${address.id}`, { method: 'PATCH', body: JSON.stringify(data) })
      : api<{ address: Address }>('/account/addresses', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: async () => { toast(address ? 'Address updated' : 'Address saved'); await queryClient.invalidateQueries({ queryKey: ['addresses'] }); onDone(); },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    save.mutate({ ...form, notes: form.notes?.trim() || null, isDefault: form.isDefault === 'on' ? true : undefined });
  };
  return <form onSubmit={submit} className="surface grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
    <h3 className="font-display text-2xl font-semibold sm:col-span-2">{address ? `Edit ${address.label}` : 'New address'}</h3>
    <Field label="Address name" hint="For example Home, Work, or Mum’s place" className="sm:col-span-2"><Input name="label" defaultValue={address?.label} required maxLength={30} placeholder="Home"/></Field>
    <AddressFields initial={address} idPrefix={address?.id ?? 'new-address'}/>
    {!address?.isDefault && <label className="flex items-center gap-2.5 text-sm font-medium sm:col-span-2"><input type="checkbox" name="isDefault" className="size-4 accent-[#244e5a]"/>Use as my default delivery address</label>}
    {save.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{save.error instanceof Error ? save.error.message : 'Could not save the address'}</p>}
    <div className="flex flex-wrap gap-2 sm:col-span-2"><Button disabled={save.isPending}>{save.isPending ? 'Saving…' : address ? 'Save changes' : 'Save address'}</Button><Button type="button" variant="ghost" onClick={onDone}>Cancel</Button></div>
  </form>;
}

function AddressesSection() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => api<{ addresses: Address[] }>('/account/addresses') });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['addresses'] });
  const makeDefault = useMutation({
    mutationFn: (address: Address) => api(`/account/addresses/${address.id}`, { method: 'PATCH', body: JSON.stringify({ isDefault: true }) }),
    onSuccess: async (_, address) => { toast(`${address.label} is now your default address`); await refresh(); },
    onError: (error) => toastError(error, 'Could not update the address'),
  });
  const remove = useMutation({
    mutationFn: (address: Address) => api<void>(`/account/addresses/${address.id}`, { method: 'DELETE' }),
    onSuccess: async (_, address) => { toast(`${address.label} removed`); await refresh(); },
    onError: (error) => toastError(error, 'Could not remove the address'),
  });
  const list = addresses.data?.addresses ?? [];
  if (editing) return <AddressForm address={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)}/>;

  return <section className="grid gap-4" aria-labelledby="addresses-title">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="addresses-title" className="font-display text-2xl font-semibold">Saved addresses</h2><p className="mt-1 text-sm text-ink/55">Pick one at checkout instead of typing it again.</p></div>{list.length > 0 && list.length < 10 && <Button variant="outline" onClick={() => setEditing('new')}><Plus size={16}/>Add address</Button>}</div>
    {addresses.isLoading && <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map((index) => <div key={index} className="surface h-44 animate-pulse"/>)}</div>}
    {!addresses.isLoading && !list.length && <div className="surface grid place-items-center px-6 py-12 text-center"><span className="grid size-14 place-items-center rounded-full bg-nile-light text-nile"><MapPin size={24}/></span><p className="mt-4 font-semibold">No saved addresses yet</p><p className="mt-1 max-w-sm text-sm text-ink/55">Save your home or work address to check out in a couple of taps.</p><Button className="mt-5" onClick={() => setEditing('new')}><Plus size={16}/>Add an address</Button></div>}
    <ul className="grid gap-3 sm:grid-cols-2">{list.map((address) => <li key={address.id} className={cn('surface flex flex-col p-5', address.isDefault && 'ring-2 ring-nile/25')}>
      <div className="flex items-center justify-between gap-2"><p className="font-semibold">{address.label}</p>{address.isDefault && <Badge tone="brand">Default</Badge>}</div>
      <address className="mt-2 flex-1 text-sm not-italic leading-6 text-ink/65">{address.fullName} · {address.phone}<br/>{address.street}<br/>{address.city}, {address.region}{address.notes && <><br/><span className="text-ink/50">{address.notes}</span></>}</address>
      <div className="mt-4 flex flex-wrap gap-1 border-t border-ink/8 pt-3">
        <Button variant="ghost" className="px-3 py-1.5 text-sm" onClick={() => setEditing(address)}><Pencil size={14}/>Edit</Button>
        {!address.isDefault && <Button variant="ghost" className="px-3 py-1.5 text-sm" disabled={makeDefault.isPending} onClick={() => makeDefault.mutate(address)}><Star size={14}/>Set as default</Button>}
        <Button variant="ghost" className="ml-auto px-3 py-1.5 text-sm text-red-700 hover:bg-red-50" disabled={remove.isPending} onClick={async () => { if (await confirmAction({ title: `Remove ${address.label}?`, message: 'Past orders keep the address they were delivered to.', confirmLabel: 'Remove address', tone: 'danger' })) remove.mutate(address); }} aria-label={`Remove ${address.label}`}><Trash2 size={14}/>Remove</Button>
      </div>
    </li>)}</ul>
  </section>;
}

function PasswordSection() {
  const [show, setShow] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const change = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => api<{ accessToken: string }>('/auth/password', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: ({ accessToken }) => { setAccessToken(accessToken); toast('Password changed. Other devices have been signed out'); },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const target = event.currentTarget; const form = new FormData(target);
    const newPassword = String(form.get('newPassword')); if (newPassword !== String(form.get('confirmPassword'))) { setMismatch(true); return; }
    change.mutate({ currentPassword: String(form.get('currentPassword')), newPassword }, { onSuccess: () => target.reset() });
  };
  const type = show ? 'text' : 'password';
  return <form onSubmit={submit} className="surface grid max-w-xl gap-5 p-6 sm:p-8">
    <div><h2 className="font-display text-2xl font-semibold">Change password</h2><p className="mt-1 text-sm text-ink/55">You’ll stay signed in here. Every other device will be signed out.</p></div>
    <Field label="Current password"><Input name="currentPassword" type={type} autoComplete="current-password" required maxLength={72}/></Field>
    <Field label="New password" hint="At least 8 characters"><Input name="newPassword" type={type} autoComplete="new-password" required minLength={8} maxLength={72} onChange={() => setMismatch(false)}/></Field>
    <Field label="Confirm new password" error={mismatch ? 'The passwords don’t match' : undefined}><Input name="confirmPassword" type={type} autoComplete="new-password" required minLength={8} maxLength={72} onChange={() => setMismatch(false)}/></Field>
    <button type="button" onClick={() => setShow((value) => !value)} className="flex w-fit items-center gap-2 text-sm font-semibold text-nile">{show ? <EyeOff size={16}/> : <Eye size={16}/>}{show ? 'Hide passwords' : 'Show passwords'}</button>
    {change.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{change.error instanceof Error ? change.error.message : 'Could not change your password'}</p>}
    <div><Button disabled={change.isPending}>{change.isPending ? 'Updating…' : 'Update password'}</Button></div>
  </form>;
}

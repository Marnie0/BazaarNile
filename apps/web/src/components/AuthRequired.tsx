import { LogIn } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/Button';
import { t } from '../lib/i18n';

export function AuthRequired({ title, description = t('Sign in to keep your selections safe and continue shopping across devices.') }: { title: string; description?: string }) {
  const location = useLocation();
  const from = location.pathname + location.search;
  return <main className="container-shell grid min-h-[60vh] place-items-center py-16 text-center">
    <div className="max-w-md"><div className="mx-auto grid size-16 place-items-center rounded-full bg-nile-light text-nile"><LogIn size={26}/></div>
      <h1 className="mt-5 font-display text-4xl font-semibold">{title}</h1>
      <p className="mx-auto mt-3 leading-7 text-ink/60">{description}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild><Link to="/login" state={{ from }}>{t('Sign in to continue')}</Link></Button>
        <Button variant="outline" asChild><Link to="/register" state={{ from }}>{t('Create an account')}</Link></Button>
      </div>
    </div>
  </main>;
}

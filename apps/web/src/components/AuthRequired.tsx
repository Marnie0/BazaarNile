import { LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './ui/Button';

export function AuthRequired({ title }: { title: string }) {
  return <main className="container-shell grid min-h-[60vh] place-items-center py-16 text-center">
    <div><div className="mx-auto grid size-16 place-items-center rounded-full bg-nile-light text-nile"><LogIn size={26}/></div>
      <h1 className="mt-5 font-display text-4xl font-bold">{title}</h1>
      <p className="mx-auto mt-3 max-w-md text-ink/55">Sign in to keep your selections safe and continue shopping across devices.</p>
      <Button className="mt-7" asChild><Link to="/login">Sign in to continue</Link></Button>
    </div>
  </main>;
}


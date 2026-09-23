import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

const variants = cva('inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nile disabled:pointer-events-none disabled:opacity-50', {
  variants: { variant: {
    primary: 'bg-clay px-5 py-3 text-white hover:bg-[#873624]',
    outline: 'border border-ink/15 bg-white px-5 py-3 hover:border-nile hover:text-nile',
    ghost: 'px-4 py-2 hover:bg-nile-light/60',
    secondary: 'bg-nile px-5 py-3 text-white hover:bg-[#1b3d47]',
    danger: 'border border-red-200 bg-white px-5 py-3 text-red-700 hover:border-red-300 hover:bg-red-50',
    destructive: 'bg-red-700 px-5 py-3 text-white hover:bg-red-800',
  }, size: { default: 'text-sm', lg: 'px-7 py-4 text-base', icon: 'size-10 p-0' } },
  defaultVariants: { variant: 'primary', size: 'default' },
});

export function Button({ className, variant, size, asChild, ...props }: ComponentProps<'button'> & VariantProps<typeof variants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(variants({ variant, size }), className)} {...props} />;
}

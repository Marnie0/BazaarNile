import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const variants = cva('inline-flex items-center justify-center gap-2 rounded-full font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nile disabled:pointer-events-none disabled:opacity-50', {
  variants: { variant: {
    primary: 'bg-clay px-5 py-3 text-white hover:bg-[#873624]',
    outline: 'border border-ink/15 bg-white px-5 py-3 hover:border-nile hover:text-nile',
    ghost: 'px-4 py-2 hover:bg-nile-light/60',
  }, size: { default: 'text-sm', lg: 'px-7 py-4 text-base', icon: 'size-10 p-0' } },
  defaultVariants: { variant: 'primary', size: 'default' },
});

export function Button({ className, variant, size, asChild, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(variants({ variant, size }), className)} {...props} />;
}

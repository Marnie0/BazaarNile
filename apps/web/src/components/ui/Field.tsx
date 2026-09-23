import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

// Label, control, hint, and error in one consistent block. Pass the control as children.
export function Field({ label, hint, error, optional, className, children }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; optional?: boolean; className?: string; children: ReactNode }) {
  return <label className={cn('field-label', className)}>
    <span className="flex items-baseline justify-between gap-2">{label}{optional && <span className="text-xs font-normal text-ink/45">Optional</span>}</span>
    {children}
    {error ? <span className="text-xs font-medium text-red-700" role="alert">{error}</span> : hint && <span className="field-hint">{hint}</span>}
  </label>;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} className={cn('field', className)} {...props}/>);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => <textarea ref={ref} className={cn('field min-h-24 resize-y', className)} {...props}/>);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => <select ref={ref} className={cn('field select-field', className)} {...props}/>);
Select.displayName = 'Select';

import { Star } from 'lucide-react';
import { useState } from 'react';

/** Read-only stars with partial fill, e.g. 4.3 shows four full stars and a third of the fifth. */
export function Stars({ value, size = 14, className = '' }: { value: number; size?: number; className?: string }) {
  return <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
    {[0, 1, 2, 3, 4].map((index) => {
      const fill = Math.max(0, Math.min(1, value - index));
      return <span key={index} className="relative inline-block" style={{ width: size, height: size }}>
        <Star size={size} className="absolute inset-0 text-ink/15" fill="currentColor" strokeWidth={0}/>
        {fill > 0 && <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Star size={size} className="text-gold-deep" fill="currentColor" strokeWidth={0}/></span>}
      </span>;
    })}
  </span>;
}

const labels = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

/** Star picker built on radio inputs, so arrow keys and screen readers work as expected. */
export function StarInput({ value, onChange, name = 'rating' }: { value: number; onChange: (value: number) => void; name?: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return <div className="flex flex-wrap items-center gap-3">
    <div role="radiogroup" aria-label="Your rating" className="flex" onMouseLeave={() => setHover(0)}>
      {labels.map((label, index) => {
        const rating = index + 1;
        return <label key={rating} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(rating)}>
          <input type="radio" name={name} value={rating} checked={value === rating} onChange={() => onChange(rating)} className="peer sr-only" aria-label={`${rating} star${rating === 1 ? '' : 's'}: ${label}`}/>
          <Star size={30} strokeWidth={1.5} className={`rounded transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-nile ${rating <= shown ? 'fill-gold text-gold-deep' : 'fill-transparent text-ink/25'}`}/>
        </label>;
      })}
    </div>
    <span className="min-w-20 text-sm font-semibold text-ink/65" aria-hidden="true">{shown ? labels[shown - 1] : 'Tap to rate'}</span>
  </div>;
}

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';

/** Horizontal scroller that stays usable with a mouse: arrow buttons, edge fades, and wheel-to-sideways scrolling. */
export function ScrollRow({ className = '', frameClassName = '', children, ...props }: ComponentProps<'div'> & { frameClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current; if (!el) return;
    const scrollable = el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible';
    setEdges({ start: scrollable && el.scrollLeft > 2, end: scrollable && el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    measure();
    const observer = new ResizeObserver(measure); observer.observe(el);
    for (const child of el.children) observer.observe(child);
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || el.scrollWidth <= el.clientWidth) return;
      const atStart = el.scrollLeft <= 0 && event.deltaY < 0; const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && event.deltaY > 0;
      if (atStart || atEnd) return;
      event.preventDefault(); el.scrollLeft += event.deltaY;
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); el.removeEventListener('wheel', wheel); };
  }, [measure, children]);

  const nudge = (direction: 1 | -1) => { const el = ref.current; if (el) el.scrollBy({ left: direction * el.clientWidth * 0.75, behavior: 'smooth' }); };
  const arrow = 'absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-ink/10 bg-white text-ink shadow-md transition hover:border-nile/40 hover:text-nile md:grid';

  return <div className={`relative ${frameClassName}`}>
    <div ref={ref} onScroll={measure} className={className} {...props}>{children}</div>
    {edges.start && <><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#fbf8f1] to-transparent"/><button type="button" tabIndex={-1} aria-hidden="true" onClick={() => nudge(-1)} className={`${arrow} left-1`}><ChevronLeft size={18}/></button></>}
    {edges.end && <><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#fbf8f1] to-transparent"/><button type="button" tabIndex={-1} aria-hidden="true" onClick={() => nudge(1)} className={`${arrow} right-1`}><ChevronRight size={18}/></button></>}
  </div>;
}

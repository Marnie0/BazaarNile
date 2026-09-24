import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';

// In right-to-left pages scrollLeft runs from 0 down to negative values, so positions are measured
// as distance travelled from the reading start.
const direction = (el: HTMLElement) => getComputedStyle(el).direction === 'rtl' ? -1 : 1;

/** Horizontal scroller that stays usable with a mouse: arrow buttons, edge fades, and wheel-to-sideways scrolling. */
export function ScrollRow({ className = '', frameClassName = '', children, ...props }: ComponentProps<'div'> & { frameClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current; if (!el) return;
    const scrollable = el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible';
    const travelled = Math.abs(el.scrollLeft);
    setEdges({ start: scrollable && travelled > 2, end: scrollable && travelled + el.clientWidth < el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    measure();
    const observer = new ResizeObserver(measure); observer.observe(el);
    for (const child of el.children) observer.observe(child);
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || el.scrollWidth <= el.clientWidth) return;
      const travelled = Math.abs(el.scrollLeft);
      const atStart = travelled <= 0 && event.deltaY < 0; const atEnd = travelled + el.clientWidth >= el.scrollWidth - 1 && event.deltaY > 0;
      if (atStart || atEnd) return;
      event.preventDefault(); el.scrollLeft += event.deltaY * direction(el);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); el.removeEventListener('wheel', wheel); };
  }, [measure, children]);

  // Positive steps move toward the end of the row in the reading direction.
  const nudge = (step: 1 | -1) => { const el = ref.current; if (el) el.scrollBy({ left: step * direction(el) * el.clientWidth * 0.75, behavior: 'smooth' }); };
  const arrow = 'absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-ink/10 bg-white text-ink shadow-md transition hover:border-nile/40 hover:text-nile md:grid';

  return <div className={`relative ${frameClassName}`}>
    <div ref={ref} onScroll={measure} className={className} {...props}>{children}</div>
    {edges.start && <><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-0 w-12 bg-gradient-to-r from-[#fbf8f1] to-transparent rtl:bg-gradient-to-l"/><button type="button" tabIndex={-1} aria-hidden="true" onClick={() => nudge(-1)} className={`${arrow} start-1`}><ChevronLeft size={18}/></button></>}
    {edges.end && <><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-0 w-12 bg-gradient-to-l from-[#fbf8f1] to-transparent rtl:bg-gradient-to-r"/><button type="button" tabIndex={-1} aria-hidden="true" onClick={() => nudge(1)} className={`${arrow} end-1`}><ChevronRight size={18}/></button></>}
  </div>;
}

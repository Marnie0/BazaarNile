import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Browser-style scroll behaviour for client routing: new pages start at the top, back/forward keeps position.
export function ScrollToTop() {
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, search, navigationType]);
  return null;
}

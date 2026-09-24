import { useSyncExternalStore } from 'react';
import App from './App';
import { getLanguage, subscribeToLanguage } from './lib/i18n';

// Remounting the app on a language switch re-renders every translated string; cached data survives.
export function Root() {
  const lang = useSyncExternalStore(subscribeToLanguage, getLanguage);
  return <App key={lang}/>;
}

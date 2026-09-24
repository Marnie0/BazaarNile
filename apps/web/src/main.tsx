import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from './lib/api';
import { initLanguage } from './lib/i18n';
import { Root } from './Root';
import './index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: {
  staleTime: 30_000,
  refetchOnWindowFocus: false,
  // Client errors (401, 404…) will not fix themselves on retry.
  retry: (failureCount, error) => failureCount < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
} } });

initLanguage().finally(() => createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><Root/></BrowserRouter></QueryClientProvider></StrictMode>));

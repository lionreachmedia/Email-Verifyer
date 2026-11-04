import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" toastOptions={{
        style: { background: '#181c22', color: '#e8eaf0', border: '1px solid rgba(255,255,255,0.08)' },
        success: { iconTheme: { primary: '#2ecc87', secondary: '#fff' } },
        error: { iconTheme: { primary: '#f05252', secondary: '#fff' } },
      }} />
    </QueryClientProvider>
  </React.StrictMode>
);

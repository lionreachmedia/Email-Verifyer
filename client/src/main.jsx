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
        style: { background: '#1A2620', color: '#ECF2EE', border: '1px solid #23312A', borderRadius: 12, fontSize: 14 },
        success: { iconTheme: { primary: '#5CD08A', secondary: '#111A16' } },
        error: { iconTheme: { primary: '#F47C6E', secondary: '#111A16' } },
      }} />
    </QueryClientProvider>
  </React.StrictMode>
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installGlobalReporting } from './lib/report';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// Errors that escape React entirely — a throwing event handler, a rejected
// promise nobody awaited — never reach an ErrorBoundary. Without this they end
// up in the console of a machine you will never see.
installGlobalReporting();

createRoot(container).render(
  <StrictMode>
    {/*
      Last resort only. The boundaries inside App cover the page and the modal,
      so reaching this one means the shell itself failed — Nav, the banner, the
      router. Without it that failure is a blank white document.
    */}
    <ErrorBoundary label="The app">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);

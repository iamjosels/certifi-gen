import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createServices } from './composition-root';
import { App } from './ui/App';
import { ServicesProvider } from './ui/components/ServicesProvider';
import './ui/styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

const services = createServices();

createRoot(container).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <App />
    </ServicesProvider>
  </StrictMode>,
);

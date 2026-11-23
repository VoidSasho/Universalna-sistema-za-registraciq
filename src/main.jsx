import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ConfigReport from './components/ConfigReport.jsx';
import { businesses, configReport } from './config/businesses.js';
import { ReservationsProvider } from './state/ReservationsContext.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {businesses.length === 0 ? (
      // всички бизнеси са с грешки -> показваме само какво да се поправи
      <div className="app">
        <ConfigReport report={configReport} />
      </div>
    ) : (
      <ReservationsProvider>
        <App />
      </ReservationsProvider>
    )}
  </StrictMode>,
);

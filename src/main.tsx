import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/base.css';
import './i18n';
import App from './App';

import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.DEV) {
  Promise.all([import('./db/db'), import('./db/repo')]).then(([d, r]) => { (window as any).__ib = { db: d.db, repo: r, resetDb: d.resetDb }; });
}

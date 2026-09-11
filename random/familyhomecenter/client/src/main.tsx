import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { FamilyMemberProvider } from './state/FamilyMemberContext.js';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FamilyMemberProvider>
      <App />
    </FamilyMemberProvider>
  </React.StrictMode>
);

// Registering this makes the dashboard installable ("Add to Home Screen") on a phone — that's
// how family members get the intercom/music controls without an app store. See sw.js: it's a
// no-op passthrough, not a cache, since this app is all about showing live state.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed:', err));
  });
}

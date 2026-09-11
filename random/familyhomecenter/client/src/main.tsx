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

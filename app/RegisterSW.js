'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .catch((err) => {
            // Fails silently — site still works normally without offline support
            console.warn('FOURNITY service worker registration failed:', err);
          });
      });
    }
  }, []);

  return null;
}

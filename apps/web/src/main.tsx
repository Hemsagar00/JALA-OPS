import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BRAND } from '@jala-ops/constants';
import { createApiClient } from '@jala-ops/api-client';
import './styles.css';

const api = createApiClient(import.meta.env.VITE_API_URL ?? '');
function App() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api
      .health()
      .then(() => {
        if (active) setState('ready');
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <>
      <header>
        <div className="brand">{BRAND.name}</div>
        <p>{BRAND.district}</p>
      </header>
      <main>
        <p className="eyebrow">Pumping & water operations</p>
        <h1>
          Reliable information.
          <br />
          Better water operations.
        </h1>
        <p className="intro">A shared workspace for field teams and district administration.</p>
        <section aria-labelledby="connection-title">
          <h2 id="connection-title">Service connection</h2>
          <p role="status" aria-live="polite" className="status">
            <span aria-hidden="true">
              {state === 'ready' ? '✓' : state === 'error' ? '!' : '◷'}
            </span>{' '}
            {state === 'ready'
              ? 'Connected to JALA-OPS'
              : state === 'error'
                ? 'Unable to connect'
                : 'Checking connection…'}
          </p>
          <p>
            {state === 'error'
              ? 'Check your connection and try again.'
              : 'The field app and dashboard share one operational service.'}
          </p>
          <button
            disabled={state === 'loading'}
            onClick={() => {
              setState('loading');
              setAttempt((value) => value + 1);
            }}
          >
            Check connection
          </button>
        </section>
      </main>
      <footer>Sri Sathya Sai District · JALA-OPS</footer>
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

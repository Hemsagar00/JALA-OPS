import { StrictMode, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BRAND } from '@jala-ops/constants';
import { createApiClient } from '@jala-ops/api-client';
import type { AuthMeResponse } from '@jala-ops/types';
import './styles.css';

const api = createApiClient(import.meta.env.VITE_API_URL ?? '');

function App() {
  const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'authenticated'>(
    'loading',
  );
  const [session, setSession] = useState<AuthMeResponse | null>(null);

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Connection diagnostic
  const [connectionState, setConnectionState] = useState<'ready' | 'loading' | 'error'>('loading');

  useEffect(() => {
    let active = true;

    // Check service connection
    api
      .health()
      .then(() => {
        if (active) setConnectionState('ready');
      })
      .catch(() => {
        if (active) setConnectionState('error');
      });

    // Check existing session
    api
      .me()
      .then((me) => {
        if (active) {
          setSession(me);
          setAuthState('authenticated');
        }
      })
      .catch(() => {
        if (active) setAuthState('unauthenticated');
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed || !password) {
      setLoginError('Please provide both username and password.');
      return;
    }

    setSubmitting(true);
    setLoginError(null);

    try {
      const res = await api.login(trimmed, password);
      api.setToken(res.token);
      const me = await api.me();
      setSession(me);
      setAuthState('authenticated');
      setPassword('');
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      if (error.status === 401) {
        setLoginError('Invalid username or password. Please verify your credentials.');
      } else if (error.status === 403) {
        setLoginError(
          'Your account is currently disabled. Please contact your system administrator.',
        );
      } else {
        setLoginError(
          error.message ||
            'Unable to communicate with the monitoring service. Check your connection.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setSession(null);
      setAuthState('unauthenticated');
    }
  }

  return (
    <>
      <header>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div className="brand">{BRAND.name}</div>
            <p
              style={{
                color: BRAND.orange,
                fontWeight: 700,
                margin: '2px 0 0',
                textTransform: 'uppercase',
                fontSize: '13px',
                letterSpacing: '0.05em',
              }}
            >
              {BRAND.district}
            </p>
          </div>
          {authState === 'authenticated' && session && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 650, fontSize: '15px' }}>{session.user.displayName}</div>
                <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                  <span
                    style={{
                      backgroundColor: '#1e3a8a',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    {session.user.role}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #ffffff',
                  minHeight: '38px',
                  padding: '6px 14px',
                  fontSize: '14px',
                  borderRadius: '6px',
                  color: '#ffffff',
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      <main>
        {authState === 'loading' ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '18px', fontWeight: 600, color: BRAND.navy }}>
              ◷ Verifying JALA-OPS session…
            </p>
          </div>
        ) : authState === 'unauthenticated' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '48px',
              alignItems: 'start',
            }}
          >
            <div>
              <p
                className="eyebrow"
                style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '12px' }}
              >
                Government of Andhra Pradesh
              </p>
              <h1>
                Pumping & Water Operations
                <br />
                Monitoring System
              </h1>
              <p className="intro">
                Single authoritative operational control workspace for Sri Sathya Sai District
                administration, engineers, and field operators.
              </p>

              <div
                style={{
                  marginTop: '36px',
                  padding: '16px 20px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${BRAND.navy}`,
                }}
              >
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: BRAND.navy }}>
                  Operational Security Notice
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#475569' }}>
                  Access is restricted to authorized district officers and field engineers. All
                  sign-in attempts and mutations are recorded in immutable audit logs.
                </p>
              </div>
            </div>

            <section
              aria-labelledby="signin-heading"
              style={{ marginTop: 0, boxShadow: '0 10px 25px -5px rgba(10, 43, 102, 0.08)' }}
            >
              <h2
                id="signin-heading"
                style={{ fontSize: '22px', color: BRAND.navy, marginBottom: '6px' }}
              >
                Sign In
              </h2>
              <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>
                Enter your district username and password to continue.
              </p>

              {loginError && (
                <div
                  role="alert"
                  style={{
                    backgroundColor: '#fef2f2',
                    borderLeft: `4px solid ${BRAND.critical}`,
                    padding: '12px 16px',
                    borderRadius: '4px',
                    marginBottom: '20px',
                    fontSize: '14px',
                    color: BRAND.critical,
                  }}
                >
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} noValidate>
                <div style={{ marginBottom: '18px' }}>
                  <label
                    htmlFor="username"
                    style={{
                      display: 'block',
                      fontWeight: 600,
                      fontSize: '14px',
                      marginBottom: '6px',
                    }}
                  >
                    Username or Officer ID
                  </label>
                  <input
                    id="username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. demo.collector or demo.admin"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '15px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label
                    htmlFor="password"
                    style={{
                      display: 'block',
                      fontWeight: 600,
                      fontSize: '14px',
                      marginBottom: '6px',
                    }}
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: '15px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: '100%',
                    backgroundColor: BRAND.navy,
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '16px',
                    padding: '14px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: submitting ? 'wait' : 'pointer',
                  }}
                >
                  {submitting ? 'Verifying Credentials…' : 'Sign In to Dashboard'}
                </button>
              </form>
            </section>
          </div>
        ) : (
          /* Authenticated Dashboard Shell */
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '32px',
              }}
            >
              <div>
                <p
                  className="eyebrow"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '12px' }}
                >
                  Operations Control Room
                </p>
                <h1 style={{ margin: '4px 0 8px', fontSize: '28px' }}>
                  Welcome, {session?.user.displayName}
                </h1>
                <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>
                  Sri Sathya Sai District Water Network · Authorized Session
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '24px',
              }}
            >
              <section style={{ margin: 0, padding: '24px' }}>
                <h3
                  style={{
                    margin: '0 0 16px',
                    fontSize: '17px',
                    color: BRAND.navy,
                    fontWeight: 700,
                  }}
                >
                  Active Credentials & Role
                </h3>
                <div style={{ lineHeight: '1.8', fontSize: '14px' }}>
                  <div>
                    <strong>ID:</strong> {session?.user.id}
                  </div>
                  <div>
                    <strong>Username:</strong> {session?.user.username}
                  </div>
                  <div>
                    <strong>Designated Role:</strong>{' '}
                    <span
                      style={{
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {session?.user.role}
                    </span>
                  </div>
                  <div>
                    <strong>Access Tier:</strong>{' '}
                    {session?.user.role === 'COLLECTOR' || session?.user.role === 'SYSTEM_ADMIN'
                      ? 'District-wide Administrative Read/Write'
                      : 'Assigned Jurisdiction Only'}
                  </div>
                </div>
              </section>

              <section style={{ margin: 0, padding: '24px' }}>
                <h3
                  style={{
                    margin: '0 0 16px',
                    fontSize: '17px',
                    color: BRAND.navy,
                    fontWeight: 700,
                  }}
                >
                  Assigned Water Stations ({session?.assignedStations.length ?? 0})
                </h3>
                {session?.assignedStations && session.assignedStations.length > 0 ? (
                  <ul
                    style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}
                  >
                    {session.assignedStations.map((stationId) => (
                      <li key={stationId}>
                        <strong>{stationId}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                    {session?.user.role === 'COLLECTOR' || session?.user.role === 'SYSTEM_ADMIN'
                      ? 'All district stations accessible via district-wide privilege.'
                      : 'No specific station assigned yet. Contact your Superintending Engineer.'}
                  </p>
                )}
              </section>

              <section style={{ margin: 0, padding: '24px' }}>
                <h3
                  style={{
                    margin: '0 0 16px',
                    fontSize: '17px',
                    color: BRAND.navy,
                    fontWeight: 700,
                  }}
                >
                  Operational Backend Status
                </h3>
                <p role="status" aria-live="polite" className="status" style={{ margin: 0 }}>
                  <span
                    aria-hidden="true"
                    style={{ color: connectionState === 'ready' ? BRAND.success : BRAND.critical }}
                  >
                    {connectionState === 'ready' ? '✓' : '!'}
                  </span>{' '}
                  {connectionState === 'ready'
                    ? 'Connected to JALA-OPS D1/R2 API'
                    : 'Checking Connection…'}
                </p>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
                  Cloudflare Workers operational environment: {import.meta.env.MODE}
                </p>
              </section>
            </div>
          </div>
        )}
      </main>

      <footer>Sri Sathya Sai District Administration · JALA-OPS Operational Platform</footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import React, { useState } from 'react';
import { ApiError, endpoints } from '../../services/api';

interface SignInScreenProps {
  onSignedIn: () => void;
  onNavigateHome?: () => void;
}

type Mode = 'login' | 'register';

/**
 * Multi-user sign-in / registration screen.
 *
 * Shown only when the backend runs in multi-user mode (the production default)
 * and no session exists. The single-user local-development bootstrap never
 * renders this screen — the server provisions that session automatically.
 * No credentials are stored client-side; the session is an HttpOnly cookie.
 */
export const SignInScreen: React.FC<SignInScreenProps> = ({ onSignedIn, onNavigateHome }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await endpoints.login({ email, password });
        onSignedIn();
      } else {
        const res = await endpoints.register({ email, username, password });
        const conf = (res as unknown as { requires_confirmation?: boolean; message?: string })?.requires_confirmation;
        if (conf) {
          setInfoMessage('Account created! Please check your email inbox to confirm your email before signing in.');
          setMode('login');
        } else {
          onSignedIn();
        }
      }
    } catch (exc) {
      setError(exc instanceof ApiError ? exc.message : 'Cannot reach the HealForge backend.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-default flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary text-on-primary flex items-center justify-center mx-auto shadow-lg">
            <span className="material-symbols-outlined text-[30px]">security</span>
          </div>
          <h1 className="text-2xl font-bold font-headline-md text-text-primary mt-4">HealForge</h1>
          <p className="text-sm text-text-muted mt-1">
            {mode === 'login' ? 'Sign in to your secure workspace' : 'Create your HealForge account'}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-surface-card border border-border-subtle rounded-2xl p-6 space-y-4 shadow-sm"
        >
          <div>
            <label htmlFor="hf-email" className="block text-xs font-semibold text-text-secondary mb-1.5">
              Email
            </label>
            <input
              id="hf-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="you@example.com"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="hf-username" className="block text-xs font-semibold text-text-secondary mb-1.5">
                Username
              </label>
              <input
                id="hf-username"
                type="text"
                required
                minLength={2}
                maxLength={64}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Letters, digits, dot, dash, underscore"
              />
            </div>
          )}

          <div>
            <label htmlFor="hf-password" className="block text-xs font-semibold text-text-secondary mb-1.5">
              Password
            </label>
            <input
              id="hf-password"
              type="password"
              required
              minLength={mode === 'register' ? 10 : 1}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container border border-border-subtle text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder={mode === 'register' ? 'At least 10 characters' : 'Your password'}
            />
          </div>

          {infoMessage && (
            <div
              role="status"
              className="p-3 rounded-lg bg-status-success/10 border border-status-success/20 text-xs text-status-success"
            >
              {infoMessage}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-status-critical/10 border border-status-critical/20 text-xs text-status-critical"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary text-sm font-semibold transition-all shadow-sm"
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          <p className="text-center text-xs text-text-muted">
            {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
                setInfoMessage(null);
              }}
              className="text-primary font-semibold hover:underline"
            >
              {mode === 'login' ? 'Create one' : 'Sign in instead'}
            </button>
          </p>

          {onNavigateHome && (
            <div className="pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={onNavigateHome}
                className="w-full py-2 text-xs text-text-secondary hover:text-text-primary font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Return to Homepage</span>
              </button>
            </div>
          )}
        </form>

        <p className="text-center text-[11px] text-text-muted mt-6 leading-relaxed">
          Sessions use secure HttpOnly cookies. HealForge never stores passwords,
          API keys or recovery codes in the browser.
        </p>
      </div>
    </div>
  );
};

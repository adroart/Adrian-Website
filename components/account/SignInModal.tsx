import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  sendSignInCode,
  verifySignInCode,
  signInWithPassword,
  signUpWithPassword,
  signInWithGoogle,
  safeAuthDestination,
} from '../../lib/account/authClient';

/**
 * Self-owned sign-in modal. Three ways in:
 *   - Continue with Google (shown when configured)
 *   - Email + password (create account / log in)
 *   - Email me a code instead (no password)
 * Styled in the site's paper / wood / bronze system with colors pinned so it
 * reads correctly in dark mode.
 */

// Pinned light surface so the card never inverts in dark mode.
const C = {
  surface: '#f5f4f0',   // paper-50 (light)
  border: '#e0d8cc',    // wood-200
  ink: '#262321',       // wood-900
  sub: '#8f7a5b',       // wood-500
  bronze: '#8a744e',    // bronze-600
  bronzeInk: '#6d5a3c', // bronze-700
  fieldBorder: '#c8bda8', // wood-300
};

type Mode = 'login' | 'signup' | 'code-email' | 'code-verify';
type SignInModalProps = {
  onClose: () => void;
  onSignedIn?: () => void;
  destination?: string;
};

type FocusTarget = { focus: () => void };
type DialogLike = { querySelectorAll: (selector: string) => ArrayLike<FocusTarget> };
type DialogKeyEvent = { key: string; shiftKey?: boolean; preventDefault: () => void };

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function closeAndNavigate(
  onClose: () => void,
  navigate: (destination: string) => void,
  destination: string,
) {
  onClose();
  navigate(destination);
}

export function handleDialogKeyDown(
  event: DialogKeyEvent,
  dialog: DialogLike,
  onClose: () => void,
  activeElement: FocusTarget | null,
) {
  if (event.key === 'Escape') {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key !== 'Tab') return;

  const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR));
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first.focus();
  } else if (!focusable.includes(activeElement as FocusTarget)) {
    event.preventDefault();
    first.focus();
  }
}

export function restoreDialogFocus(target: FocusTarget | null) {
  target?.focus();
}

const SignInModal: React.FC<SignInModalProps> = ({
  onClose,
  onSignedIn,
  destination,
}) => {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const returnTo = safeAuthDestination(
    destination ?? `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/config', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : { google: false })
      .then((config) => setGoogleConfigured(config.google === true))
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setGoogleConfigured(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!dialogRef.current) return;
      handleDialogKeyDown(event, dialogRef.current, onClose, document.activeElement as HTMLElement | null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => () => restoreDialogFocus(previousFocusRef.current), []);

  const done = () => {
    onSignedIn?.();
    closeAndNavigate(onClose, (destination) => navigate(destination, { replace: true }), returnTo);
  };

  const doGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithGoogle(returnTo);
      if (result.error) {
        setBusy(false);
        setError('Could not start Google sign-in. Try another way below.');
      }
    } catch {
      setBusy(false);
      setError('Could not start Google sign-in. Try another way below.');
    }
  };

  const doPassword = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const result = mode === 'signup'
        ? await signUpWithPassword(email.trim(), password, name.trim(), returnTo)
        : await signInWithPassword(email.trim(), password, returnTo);
      setBusy(false);
      if (result.error) {
        setError(
          mode === 'signup'
            ? 'Could not create the account. The email may already be in use, or the password must have at least 8 characters.'
            : 'Email or password did not match. Try again, or create an account.',
        );
        return;
      }
      done();
    } catch {
      setBusy(false);
      setError('Could not reach the sign-in service. Please try again.');
    }
  };

  const sendCode = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await sendSignInCode(email.trim());
      setBusy(false);
      if (result.error) { setError('Could not send the code. Check the email and try again.'); return; }
      setMode('code-verify');
    } catch {
      setBusy(false);
      setError('Could not reach the sign-in service. Please try again.');
    }
  };

  const verify = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await verifySignInCode(email.trim(), code.trim());
      setBusy(false);
      if (result.error) { setError('That code did not match. Try again, or request a new one.'); return; }
      done();
    } catch {
      setBusy(false);
      setError('Could not reach the sign-in service. Please try again.');
    }
  };

  const labelCls = 'block mb-2';
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '0.15em',
    textTransform: 'uppercase', color: C.sub, fontWeight: 600,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', border: `1px solid ${C.fieldBorder}`, background: '#fff',
    padding: '12px 16px', fontFamily: 'var(--font-label)', fontSize: 16, color: C.ink,
  };
  const primaryStyle: React.CSSProperties = {
    width: '100%', background: C.ink, color: C.surface,
    fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '0.2em',
    textTransform: 'uppercase', fontWeight: 600, padding: '12px', cursor: 'pointer', border: 0,
  };
  const linkStyle: React.CSSProperties = {
    background: 'transparent', border: 0, cursor: 'pointer', color: C.bronze,
    fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '0.12em',
    textTransform: 'uppercase', fontWeight: 600, padding: '6px 0',
  };

  const title =
    mode === 'signup' ? 'Create your account'
    : mode === 'code-email' ? 'Sign in with a code'
    : mode === 'code-verify' ? 'Enter your code'
    : 'Sign in';

  const subtitle =
    mode === 'signup' ? 'Save pieces to collections and find your orders.'
    : mode === 'code-email' ? 'We will email you a one-time code. It works even if you forgot your password.'
    : mode === 'code-verify' ? `We sent a code to ${email}.`
    : 'Welcome back.';

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'rgba(38,35,33,0.45)', backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-title"
        style={{
          width: '100%', maxWidth: 384, background: C.surface,
          border: `1px solid ${C.border}`, boxShadow: '0 20px 50px -20px rgba(0,0,0,0.4)',
          padding: 32, color: C.ink,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          autoFocus
          aria-label="Close sign-in dialog"
          onClick={onClose}
          style={{ ...linkStyle, display: 'block', marginLeft: 'auto' }}
        >
          Close
        </button>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ ...labelStyle, color: C.bronze, marginBottom: 8 }}>Adrian Rasmussen Art</p>
          <h2 id="sign-in-title" style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 26, color: C.ink, fontWeight: 500, margin: 0 }}>
            {title}
          </h2>
          <p style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: C.sub, marginTop: 8 }}>
            {subtitle}
          </p>
        </div>

        {error && (
          <div role="alert" aria-live="polite" style={{
            marginBottom: 16, padding: '8px 12px', border: '1px solid #d99',
            background: '#fbeaea', color: '#8a2a2a', fontFamily: 'var(--font-label)', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Password modes (login / signup) */}
        {(mode === 'login' || mode === 'signup') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {googleConfigured && (
              <>
                <button type="button" onClick={doGoogle} disabled={busy} style={{
                  ...inputStyle, cursor: 'pointer', fontWeight: 600, letterSpacing: '0.05em',
                }}>
                  Continue with Google
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.sub }}>
                  <span style={{ flex: 1, height: 1, background: C.border }} />
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em' }}>or</span>
                  <span style={{ flex: 1, height: 1, background: C.border }} />
                </div>
              </>
            )}

            {mode === 'signup' && (
              <div>
                <label htmlFor="sign-in-name" className={labelCls} style={labelStyle}>Name (optional)</label>
                <input id="sign-in-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Your name" />
              </div>
            )}
            <div>
              <label htmlFor="sign-in-email" className={labelCls} style={labelStyle}>Email</label>
              <input id="sign-in-email" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
            </div>
            <div>
              <label htmlFor="sign-in-password" className={labelCls} style={labelStyle}>Password</label>
              <input
                id="sign-in-password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doPassword()}
                style={inputStyle}
                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
              />
            </div>
            <button type="button" onClick={doPassword} disabled={busy || !email.trim() || !password} style={primaryStyle}>
              {busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
            {mode === 'login' && (
              <button
                type="button"
                style={{ ...linkStyle, color: C.sub }}
                onClick={() => closeAndNavigate(
                  onClose,
                  (destination) => navigate(destination),
                  `/account/reset-password?returnTo=${encodeURIComponent(returnTo)}`,
                )}
              >
                Forgot password?
              </button>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <button type="button" style={linkStyle} onClick={() => { setError(null); setMode(mode === 'signup' ? 'login' : 'signup'); }}>
                {mode === 'signup' ? 'Have an account? Sign in' : 'Create an account'}
              </button>
              <button type="button" style={{ ...linkStyle, color: C.sub }} onClick={() => { setError(null); setMode('code-email'); }}>
                Email me a code
              </button>
            </div>
          </div>
        )}

        {/* Code request */}
        {mode === 'code-email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="code-email" className={labelCls} style={labelStyle}>Email</label>
              <input id="code-email" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendCode()} style={inputStyle} placeholder="you@example.com" />
            </div>
            <button type="button" onClick={sendCode} disabled={busy || !email.trim()} style={primaryStyle}>
              {busy ? 'Sending...' : 'Send code'}
            </button>
            <button type="button" style={linkStyle} onClick={() => { setError(null); setMode('login'); }}>
              Back to sign in
            </button>
          </div>
        )}

        {/* Code verify */}
        {mode === 'code-verify' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="sign-in-code" className={labelCls} style={labelStyle}>6-digit code</label>
              <input
                id="sign-in-code"
                type="text"
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && verify()}
                style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.3em' }}
                placeholder="123456"
              />
            </div>
            <button type="button" onClick={verify} disabled={busy || code.length < 6} style={primaryStyle}>
              {busy ? 'Verifying...' : 'Sign in'}
            </button>
            <button type="button" style={linkStyle} onClick={() => { setError(null); setCode(''); setMode('code-email'); }}>
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default SignInModal;

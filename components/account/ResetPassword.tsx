import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  requestPasswordReset,
  resetPasswordWithCode,
  safeAuthDestination,
} from '../../lib/account/authClient';

type Step = 'request' | 'reset' | 'complete';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const returnTo = safeAuthDestination(searchParams.get('returnTo'));

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await requestPasswordReset(email.trim());
      if (result.error) {
        setError('Could not send the reset code. Check the email and try again.');
      } else {
        setStep('reset');
      }
    } catch {
      setError('Could not reach the password reset service. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const replacePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (otp.length !== 6 || password.length < 8) return;
    setBusy(true);
    setError('');
    try {
      const result = await resetPasswordWithCode(email.trim(), otp, password);
      if (result.error) {
        setError('That code could not be verified. Request a new code and try again.');
      } else {
        setPassword('');
        setOtp('');
        setStep('complete');
      }
    } catch {
      setError('Could not reach the password reset service. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="relative mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-6 py-24">
      <div className="w-full border border-wood-200 bg-paper-50 p-8 text-wood-900 shadow-xl sm:p-12">
        <p className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-bronze-600">
          Adrian Rasmussen Art
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium">Reset your password</h1>

        {step === 'request' && (
          <>
            <p className="mt-4 font-body text-wood-600">
              Enter your account email and we will send a six-digit reset code.
            </p>
            <form className="mt-8 space-y-6" onSubmit={requestCode}>
              <div>
                <label htmlFor="reset-email" className="mb-2 block font-label text-[11px] font-semibold uppercase tracking-[0.15em] text-wood-500">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full border border-wood-300 bg-white px-4 py-3 font-sans text-base text-wood-900"
                />
              </div>
              <button type="submit" disabled={busy || !email.trim()} className="w-full bg-wood-900 px-4 py-3 font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-50 disabled:opacity-50">
                {busy ? 'Sending...' : 'Send reset code'}
              </button>
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <p className="mt-4 font-body text-wood-600">
              Enter the code sent to {email}, then choose a new password. Resetting it signs out existing sessions.
            </p>
            <form className="mt-8 space-y-6" onSubmit={replacePassword}>
              <div>
                <label htmlFor="reset-code" className="mb-2 block font-label text-[11px] font-semibold uppercase tracking-[0.15em] text-wood-500">
                  Six-digit code
                </label>
                <input
                  id="reset-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  pattern="[0-9]{6}"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full border border-wood-300 bg-white px-4 py-3 text-center font-sans text-base tracking-[0.3em] text-wood-900"
                />
              </div>
              <div>
                <label htmlFor="reset-password" className="mb-2 block font-label text-[11px] font-semibold uppercase tracking-[0.15em] text-wood-500">
                  New password
                </label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full border border-wood-300 bg-white px-4 py-3 font-sans text-base text-wood-900"
                />
                <p className="mt-2 font-sans text-xs text-wood-500">At least 8 characters.</p>
              </div>
              <button type="submit" disabled={busy || otp.length !== 6 || password.length < 8} className="w-full bg-wood-900 px-4 py-3 font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-50 disabled:opacity-50">
                {busy ? 'Resetting...' : 'Set new password'}
              </button>
              <button type="button" onClick={() => setStep('request')} className="w-full bg-transparent py-2 font-label text-[11px] font-semibold uppercase tracking-[0.15em] text-bronze-600">
                Request a new code
              </button>
            </form>
          </>
        )}

        {step === 'complete' && (
          <div aria-live="polite">
            <p className="mt-4 font-body text-wood-600">
              Your password has been reset. You can return and sign in with the new password.
            </p>
            <Link to={returnTo} className="mt-8 block w-full bg-wood-900 px-4 py-3 text-center font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-50">
              Return to the site
            </Link>
          </div>
        )}

        {error && (
          <p role="alert" aria-live="assertive" className="mt-6 border border-red-300 bg-red-50 px-4 py-3 font-sans text-sm text-red-800">
            {error}
          </p>
        )}

        {step !== 'complete' && (
          <Link to={returnTo} className="mt-8 block text-center font-label text-[11px] font-semibold uppercase tracking-[0.15em] text-bronze-600">
            Cancel
          </Link>
        )}
      </div>
    </section>
  );
};

export default ResetPassword;

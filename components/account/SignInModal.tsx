import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { sendSignInCode, verifySignInCode } from '../../lib/account/authClient';

/**
 * Self-owned sign-in modal: enter email, receive a 6-digit code, enter it,
 * you're in. No passwords. Styled in the site's paper / wood / bronze system.
 * Replaces Clerk's hosted modal.
 */
const SignInModal: React.FC<{ onClose: () => void; onSignedIn?: () => void }> = ({
  onClose,
  onSignedIn,
}) => {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    const addr = email.trim();
    if (!addr) return;
    setBusy(true);
    setError(null);
    const { error } = await sendSignInCode(addr);
    setBusy(false);
    if (error) {
      setError('Could not send the code. Check the email and try again.');
      return;
    }
    setStep('code');
  };

  const verify = async () => {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setError(null);
    const { error } = await verifySignInCode(email.trim(), c);
    setBusy(false);
    if (error) {
      setError('That code did not match. Try again, or request a new one.');
      return;
    }
    onSignedIn?.();
    onClose();
  };

  const label = 'font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold block mb-2';
  const input =
    'w-full border border-wood-300 bg-paper-50 px-4 py-3 font-sans text-base text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-400';
  const primary =
    'w-full bg-wood-900 text-paper-50 font-label text-[11px] uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-wood-900/40 backdrop-blur-sm px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-paper-50 border border-wood-200 shadow-xl p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <p className="font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 font-semibold mb-2">
            Adrian Rasmussen Art
          </p>
          <h2 className="font-serif text-2xl text-wood-900 font-medium">
            {step === 'email' ? 'Sign in' : 'Enter your code'}
          </h2>
          <p className="font-sans text-sm text-wood-500 mt-2 leading-relaxed">
            {step === 'email'
              ? 'We will email you a sign-in code. No password needed.'
              : `We sent a code to ${email}.`}
          </p>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 border border-red-300 bg-red-50 text-red-800 font-sans text-sm">
            {error}
          </div>
        )}

        {step === 'email' ? (
          <div className="space-y-4">
            <div>
              <label className={label}>Email</label>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                placeholder="you@example.com"
                className={input}
              />
            </div>
            <button onClick={sendCode} disabled={busy || !email.trim()} className={primary}>
              {busy ? 'Sending...' : 'Send code'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className={label}>6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && verify()}
                placeholder="123456"
                className={`${input} tracking-[0.3em] text-center`}
              />
            </div>
            <button onClick={verify} disabled={busy || code.length < 6} className={primary}>
              {busy ? 'Verifying...' : 'Sign in'}
            </button>
            <button
              onClick={() => { setStep('email'); setCode(''); setError(null); }}
              className="w-full font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 hover:text-wood-700 font-semibold py-1"
            >
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

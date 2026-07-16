import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import SignInModal from './account/SignInModal';

export function safeAdminDestination(value: unknown): string {
  if (typeof value !== 'string') return '/admin';
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return '/admin';
  try {
    const parsed = new URL(value, 'https://internal.invalid');
    if (parsed.origin !== 'https://internal.invalid') return '/admin';
    if (parsed.pathname !== '/admin' && !parsed.pathname.startsWith('/admin/')) return '/admin';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/admin';
  }
}

const AdminLogin: React.FC = () => {
  const location = useLocation();
  const [modalOpen, setModalOpen] = useState(true);
  const destination = safeAdminDestination((location.state as { from?: unknown } | null)?.from);

  return (
    <section className="min-h-screen bg-paper-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold text-center mb-3">Admin</p>
        <h1 className="font-serif text-3xl text-wood-900 font-medium mb-10 text-center">Sign in</h1>
        <p className="font-serif text-center text-wood-600">Use your verified administrator account.</p>
        {!modalOpen && (
          <button type="button" onClick={() => setModalOpen(true)} className="mt-6 w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3">
            Open sign in
          </button>
        )}
      </div>
      {modalOpen && <SignInModal destination={destination} onClose={() => setModalOpen(false)} />}
    </section>
  );
};

export default AdminLogin;

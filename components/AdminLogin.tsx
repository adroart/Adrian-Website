import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AdminLogin: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || '/admin';

  const submit = async () => {
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        navigate(from, { replace: true });
      } else {
        setError('Incorrect password.');
      }
    } catch {
      setError('Could not connect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen bg-paper-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold text-center mb-3">Admin</p>
        <h1 className="font-serif text-3xl text-wood-900 font-medium mb-10 text-center">Sign in</h1>
        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Password"
            autoFocus
            className="w-full border border-wood-300 bg-white px-4 py-3 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-400"
          />
          {error && <p className="font-sans text-sm text-red-600">{error}</p>}
          <button
            onClick={submit}
            disabled={!password || loading}
            className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
          >
            {loading ? 'Signing in...' : 'Enter'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default AdminLogin;

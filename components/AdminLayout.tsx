import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { signOut } from '../lib/account/authClient';

type AdminIdentity = { id: string; email: string };

export function adminReturnDestination(location: {
  pathname: string;
  search: string;
  hash: string;
}): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetch('/api/admin/verify', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) {
          navigate('/admin/login', {
            state: { from: adminReturnDestination(location) },
            replace: true,
          });
          return;
        }
        if (response.status === 403) {
          setForbidden(true);
          return;
        }
        if (!response.ok) throw new Error('admin verification failed');
        const data = await response.json();
        if (data.ok && data.admin) setAdmin(data.admin);
      })
      .catch(() => navigate('/admin/login', { replace: true }))
      .finally(() => setChecking(false));
  }, []);

  const logout = async () => {
    await fetch('/api/admin/registry-unlock', { method: 'DELETE' }).catch(() => undefined);
    await signOut();
    navigate('/admin/login', { replace: true });
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-paper-50 flex items-center justify-center">
        <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-400 font-semibold">Checking session...</span>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen bg-paper-50 flex items-center justify-center px-6">
        <div className="max-w-lg border border-wood-200 bg-white p-8 text-center">
          <h1 className="font-serif text-2xl text-wood-900">Administrator access required</h1>
          <p className="font-sans text-sm text-wood-600 mt-3">You are signed in, but this verified email is not on the server administrator allowlist.</p>
          <button type="button" onClick={logout} className="mt-6 font-label text-xs uppercase tracking-[0.15em] text-bronze-700">Sign out</button>
        </div>
      </div>
    );
  }

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="border-b border-wood-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link to="/admin" className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-800 transition-colors font-semibold flex items-center gap-1.5">
            ← Admin
          </Link>
          <span className="text-wood-200">|</span>
          <Link to="/admin/files" className="font-sans text-sm text-wood-500 hover:text-wood-900 transition-colors">Files</Link>
          <Link to="/admin/invoices" className="font-sans text-sm text-wood-500 hover:text-wood-900 transition-colors">Invoices</Link>
          <Link to="/admin/book" className="font-sans text-sm text-wood-500 hover:text-wood-900 transition-colors">Book</Link>
          <Link to="/admin/pricing" className="font-sans text-sm text-wood-500 hover:text-wood-900 transition-colors">Pricing</Link>
          <Link to="/keystatic" className="font-sans text-sm text-wood-500 hover:text-wood-900 transition-colors">Content</Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-sans text-xs text-wood-500">{admin.email}</span>
          <button onClick={logout} className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-400 hover:text-wood-900 transition-colors font-semibold">Log out</button>
        </div>
      </div>
      {children}
    </div>
  );
};

export default AdminLayout;

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetch('/api/admin/verify')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setAuthed(true);
        } else {
          navigate('/admin/login', { state: { from: location.pathname }, replace: true });
        }
      })
      .catch(() => navigate('/admin/login', { replace: true }))
      .finally(() => setChecking(false));
  }, []);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    navigate('/admin/login', { replace: true });
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-paper-50 flex items-center justify-center">
        <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-400 font-semibold">Checking session...</span>
      </div>
    );
  }

  if (!authed) return null;

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
          <Link to="/keystatic" className="font-sans text-sm text-wood-500 hover:text-wood-900 transition-colors">Content</Link>
        </div>
        <button
          onClick={logout}
          className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-400 hover:text-wood-900 transition-colors font-semibold"
        >
          Log out
        </button>
      </div>
      {children}
    </div>
  );
};

export default AdminLayout;

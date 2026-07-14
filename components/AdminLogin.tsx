import React from 'react';
import { useNavigate } from 'react-router-dom';
import SignInModal from './account/SignInModal';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="min-h-screen bg-paper-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold text-center mb-3">Admin</p>
        <h1 className="font-serif text-3xl text-wood-900 font-medium mb-10 text-center">Sign in</h1>
        <p className="font-serif text-center text-wood-600">Use your verified administrator account.</p>
      </div>
      <SignInModal
        destination="/admin"
        onClose={() => navigate('/', { replace: true })}
        onSignedIn={() => navigate('/admin', { replace: true })}
      />
    </section>
  );
};

export default AdminLogin;

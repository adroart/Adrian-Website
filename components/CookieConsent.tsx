
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'cookie-consent';

const CookieConsent: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-wood-900 text-paper-50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
      <p className="font-sans text-sm text-wood-200">
        This site uses cookies for analytics and to remember your preferences.{' '}
        <Link
          to="/privacy"
          className="underline text-wood-300 hover:text-paper-50 transition-colors"
        >
          Privacy Policy
        </Link>
      </p>
      <button
        onClick={handleAccept}
        className="shrink-0 font-label text-xs uppercase tracking-[0.2em] font-semibold px-6 py-2.5 bg-bronze-600 text-paper-50 hover:bg-bronze-500 transition-colors whitespace-nowrap"
      >
        Accept
      </button>
    </div>
  );
};

export default CookieConsent;

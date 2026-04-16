
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUp, CheckCircle, Instagram, Mail } from 'lucide-react';
import { useDarkMode } from '../DarkModeContext';
import { LAUNCH_FLAGS } from '../launchFlags';

// Kit (ConvertKit) newsletter integration
// Set VITE_KIT_FORM_ID and VITE_KIT_PUBLIC_API_KEY in .env.local

const NewsletterForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [focused, setFocused] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || status === 'loading') return;
        setStatus('loading');

        try {
            const KIT_FORM_ID = import.meta.env.VITE_KIT_FORM_ID;
            const KIT_API_KEY = import.meta.env.VITE_KIT_PUBLIC_API_KEY;

            // Try the proxy route first (avoids ad-blocker interference),
            // then fall back to the direct Kit API.
            let data: any;
            let useProxy = true;
            try {
                const proxyRes = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                });
                data = await proxyRes.json();
                if (!data.subscription) useProxy = false;
            } catch {
                useProxy = false;
            }

            // Fallback: call Kit directly if proxy failed or returned no subscription
            if (!useProxy) {
                const res = await fetch(
                    `https://api.convertkit.com/v3/forms/${KIT_FORM_ID}/subscribe`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json; charset=utf-8' },
                        body: JSON.stringify({ api_key: KIT_API_KEY, email }),
                    }
                );
                data = await res.json();
            }

            if (data.subscription) {
                setStatus('success');
                setEmail('');
            } else {
                throw new Error(data.message || 'Subscription failed');
            }
        } catch (err) {
            console.error(err);
            setStatus('error');
        }
    };

    if (status === 'success') {
        return (
            <div className="flex items-center gap-2 py-2">
                <CheckCircle size={14} className="text-bronze-400 shrink-0" />
                <span className="font-sans text-base text-wood-300">You're on the list.</span>
            </div>
        );
    }

    const isActive = focused || email.length > 0;

    return (
        <div className="w-full md:w-80">
        <form
            className={`flex border-b ${status === 'error' ? 'border-red-400' : 'border-wood-500'} focus-within:border-bronze-400 transition-colors pb-1 w-full group relative`}
            onSubmit={handleSubmit}
        >
            {/* #10 Floating label */}
            <label
                className={`absolute left-0 font-serif transition-all duration-300 pointer-events-none ${
                    isActive
                        ? '-top-5 text-xs text-bronze-400'
                        : 'top-0 text-lg text-wood-300'
                }`}
            >
                Email address
            </label>
            <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                required
                className="bg-transparent w-full outline-none text-wood-200 font-sans text-lg"
            />
            <button
                type="submit"
                disabled={status === 'loading'}
                className="text-wood-500 group-hover:text-bronze-400 transition-colors disabled:opacity-40"
            >
                <ArrowRight size={18} />
            </button>
        </form>
        {status === 'error' && (
            <p className="font-sans text-xs text-red-400 mt-1">Something went wrong. Please try again.</p>
        )}
        </div>
    );
};

/* #11 Scroll-to-top button */
const ScrollToTop: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > 600);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollUp = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    return (
        <button
            onClick={scrollUp}
            aria-label="Back to top"
            className={`w-10 h-10 rounded-full border border-wood-500 flex items-center justify-center text-wood-400 hover:text-bronze-400 hover:border-bronze-400 transition-all duration-300 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
        >
            <ArrowUp size={16} />
        </button>
    );
};

const Footer: React.FC = () => {
    const { isDarkMode, toggleDarkMode } = useDarkMode();

    return (
        <footer className="dark-preserve bg-wood-800 text-wood-300 pt-0 pb-8 px-6 relative overflow-hidden print:hidden">
            {/* Warm gradient top edge */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-bronze-400 to-transparent opacity-60"></div>

            {/* Subtle background noise texture */}
            <div className="footer-noise absolute inset-0 pointer-events-none"></div>

            <div className="max-w-[1400px] mx-auto relative z-10 pt-16">

                {/* #1 Asymmetric hero layout + #3 Newsletter stacks first on mobile */}
                <div className="flex flex-col md:flex-row md:items-start gap-12 mb-16">

                    {/* Brand — 60% on desktop */}
                    <div className="md:w-[60%]">
                        <h2 className="font-display text-3xl md:text-4xl text-wood-100 mb-4 tracking-normal font-normal">Adrian Rasmussen</h2>
                        <p className="font-sans text-wood-300 text-sm leading-[1.7] max-w-lg">
                            Multidimensional art between Bali and California. <br />
                            Mandala series, sacred geometry, and layered wood.
                        </p>
                        {/* #13 "Currently" status line */}
                        <div className="mt-6 flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-bronze-400 animate-pulse-slow"></span>
                            <span className="font-label text-[11px] uppercase tracking-[0.2em] font-semibold text-wood-200">
                                Currently, taking commissions for Spring 2026
                            </span>
                        </div>
                    </div>

                    {/* Newsletter — 40% on desktop, appears first on mobile */}
                    <div className="w-full md:w-[40%] order-first md:order-last">
                        <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-200 block mb-1 font-semibold">
                            Join the Inner Circle
                        </span>
                        <span className="font-sans text-sm text-wood-200 block mb-5">
                            Studio updates, new work, and writings. Delivered when something wants to be shared.
                        </span>
                        <NewsletterForm />
                    </div>
                </div>

                {/* Gradient divider */}
                <div className="h-px w-full bg-gradient-to-r from-transparent via-wood-500 to-transparent mb-10"></div>

                {/* Nav links — single row */}
                <nav className="flex flex-wrap gap-x-7 gap-y-3 mb-10">
                    <Link to="/creations" className="footer-link font-sans text-base text-wood-300 hover:text-bronze-400 transition-colors">Creations</Link>
                    <Link to="/writings" className="footer-link font-sans text-base text-wood-300 hover:text-bronze-400 transition-colors">Writings</Link>
                    {LAUNCH_FLAGS.shopEnabled && <Link to="/shop" className="footer-link font-sans text-base text-wood-300 hover:text-bronze-400 transition-colors">Shop</Link>}
                    <Link to="/about" className="footer-link font-sans text-base text-wood-300 hover:text-bronze-400 transition-colors">About</Link>
                    <Link to="/inquire" className="footer-link font-sans text-base text-wood-300 hover:text-bronze-400 transition-colors">Commissions</Link>
                    <a href="https://teajia.com" target="_blank" rel="noopener noreferrer" className="footer-link font-sans text-base text-wood-300 hover:text-bronze-400 transition-colors">Teajia</a>
                </nav>

                {/* Gradient divider */}
                <div className="h-px w-full bg-gradient-to-r from-transparent via-wood-500 to-transparent"></div>

                {/* Bottom bar */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-label uppercase tracking-[0.2em] font-semibold text-wood-300 pt-6">
                    <div className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2">
                        <span>© {new Date().getFullYear()} Adrian Rasmussen</span>
                        <Link to="/privacy" className="hover:text-wood-300 transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-wood-300 transition-colors">Terms</Link>
                        <button onClick={toggleDarkMode} className="hover:text-bronze-400 transition-colors">
                            {isDarkMode ? 'Day Mode' : 'Night Mode'}
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <a href="https://www.instagram.com/technicianofthesacred" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 rounded-full border border-wood-600 flex items-center justify-center text-wood-300 hover:text-bronze-400 hover:border-bronze-400 hover:scale-110 transition-all duration-300">
                            <Instagram size={16} />
                        </a>
                        <a href="mailto:hello@adrianrasmussen.com" aria-label="Email" className="w-9 h-9 rounded-full border border-wood-600 flex items-center justify-center text-wood-300 hover:text-bronze-400 hover:border-bronze-400 hover:scale-110 transition-all duration-300">
                            <Mail size={16} />
                        </a>
                        <ScrollToTop />
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

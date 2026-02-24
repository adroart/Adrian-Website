
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUp, CheckCircle, Instagram, Mail } from 'lucide-react';

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

            const res = await fetch(
                `https://api.convertkit.com/v3/forms/${KIT_FORM_ID}/subscribe`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    body: JSON.stringify({
                        api_key: KIT_API_KEY,
                        email,
                    }),
                }
            );

            const data = await res.json();

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
                <span className="font-serif text-base text-wood-300">You're on the list.</span>
            </div>
        );
    }

    const isActive = focused || email.length > 0;

    return (
        <div className="w-full md:w-80">
        <form
            className={`flex border-b ${status === 'error' ? 'border-red-400' : 'border-wood-600'} focus-within:border-bronze-400 transition-colors pb-1 w-full group relative`}
            onSubmit={handleSubmit}
        >
            {/* #10 Floating label */}
            <label
                className={`absolute left-0 font-serif transition-all duration-300 pointer-events-none ${
                    isActive
                        ? '-top-5 text-xs text-bronze-400'
                        : 'top-0 text-lg text-wood-500'
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
                className="bg-transparent w-full outline-none text-wood-200 font-serif text-lg"
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
            <p className="font-serif text-xs text-red-400 mt-1">Something went wrong. Please try again.</p>
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
            className={`w-10 h-10 rounded-full border border-wood-600 flex items-center justify-center text-wood-400 hover:text-bronze-400 hover:border-bronze-400 transition-all duration-300 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
        >
            <ArrowUp size={16} />
        </button>
    );
};

const Footer: React.FC = () => {
    return (
        <footer className="dark-preserve bg-wood-900 text-wood-300 pt-0 pb-8 px-6 relative overflow-hidden print:hidden">
            {/* #8 Warm gradient top edge */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-bronze-400 to-transparent opacity-60"></div>

            {/* #15 Subtle background noise texture */}
            <div className="footer-noise absolute inset-0 pointer-events-none"></div>

            {/* #4 Large display name watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap pointer-events-none select-none">
                <span className="font-serif text-[clamp(80px,12vw,180px)] font-light tracking-tight text-wood-800 opacity-40">
                    Adrian Rasmussen
                </span>
            </div>

            <div className="max-w-[1400px] mx-auto relative z-10 pt-16">

                {/* #1 Asymmetric hero layout + #3 Newsletter stacks first on mobile */}
                <div className="flex flex-col md:flex-row md:items-start gap-12 mb-16">

                    {/* Brand — 60% on desktop */}
                    <div className="md:w-[60%]">
                        <h2 className="font-serif text-3xl md:text-4xl text-wood-100 mb-4 tracking-tight font-medium">Adrian Rasmussen</h2>
                        <p className="font-sans text-wood-400 text-sm leading-[1.7] max-w-lg">
                            Resonant artifacts for the modern sanctuary. <br />
                            Exploring the intersection of digital precision and organic imperfection.
                        </p>
                        {/* #13 "Currently" status line */}
                        <div className="mt-6 flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-bronze-400 animate-pulse-slow"></span>
                            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-wood-500">
                                Currently — Taking commissions for Spring 2026
                            </span>
                        </div>
                    </div>

                    {/* Newsletter — 40% on desktop, appears first on mobile */}
                    <div className="w-full md:w-[40%] order-first md:order-last">
                        <span className="font-mono text-xs uppercase tracking-[0.2em] text-wood-500 block mb-1 font-semibold">
                            Join the Inner Circle
                        </span>
                        <span className="font-serif text-sm text-wood-500 italic block mb-5">
                            When something wants to be shared, it arrives here first.
                        </span>
                        <NewsletterForm />
                    </div>
                </div>

                {/* #2 Gradient divider */}
                <div className="h-px w-full bg-gradient-to-r from-transparent via-wood-600 to-transparent mb-12"></div>

                {/* Navigation grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10 mb-16">

                    {/* Column 1: Index */}
                    <div className="flex flex-col gap-3.5">
                        {/* #5 Decorative line before column header */}
                        <div className="flex items-center gap-3 mb-2">
                            <span className="w-6 h-px bg-bronze-400/50"></span>
                            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-wood-500 font-semibold">Index</span>
                        </div>
                        <Link to="/creations" className="footer-link font-serif text-base text-wood-400 hover:text-bronze-400 transition-colors w-fit">Creations</Link>
                        <Link to="/writings" className="footer-link font-serif text-base text-wood-400 hover:text-bronze-400 transition-colors w-fit">Writings</Link>
                        <Link to="/shop" className="footer-link font-serif text-base text-wood-400 hover:text-bronze-400 transition-colors w-fit">Shop</Link>
                        <a href="https://teajia.com" target="_blank" rel="noopener noreferrer" className="footer-link font-serif text-base text-wood-400 hover:text-bronze-400 transition-colors w-fit">
                            <span>Teajia</span>
                            <span className="block font-serif text-xs text-wood-600 font-light mt-0.5">Global tea culture. Ceremony and treasures.</span>
                        </a>
                    </div>

                    {/* Column 2: Studio */}
                    <div className="flex flex-col gap-3.5">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="w-6 h-px bg-bronze-400/50"></span>
                            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-wood-500 font-semibold">Studio</span>
                        </div>
                        <Link to="/about" className="footer-link font-serif text-base text-wood-400 hover:text-bronze-400 transition-colors w-fit">About</Link>
                        <Link to="/inquire" className="footer-link font-serif text-base text-wood-400 hover:text-bronze-400 transition-colors w-fit">Commissions</Link>
                        <Link to="/inquire" className="footer-link font-serif text-base text-wood-400 hover:text-bronze-400 transition-colors w-fit">Contact</Link>
                    </div>

                    {/* Column 3: Info */}
                    <div className="flex flex-col gap-3.5">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="w-6 h-px bg-bronze-400/50"></span>
                            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-wood-500 font-semibold">Information</span>
                        </div>
                        <button className="footer-link text-left font-serif text-base text-wood-400 hover:text-bronze-400 transition-colors w-fit">Shipping & Returns</button>
                        <button className="footer-link text-left font-serif text-base text-wood-400 hover:text-bronze-400 transition-colors w-fit">Care Guide</button>
                        <button className="footer-link text-left font-serif text-base text-wood-400 hover:text-bronze-400 transition-colors w-fit">Authenticity</button>
                    </div>

                    {/* Column 4: Connect — #12 Icon buttons with scale hover */}
                    <div className="flex flex-col gap-3.5">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="w-6 h-px bg-bronze-400/50"></span>
                            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-wood-500 font-semibold">Connect</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <a href="#" aria-label="Instagram" className="w-10 h-10 rounded-full border border-wood-700 flex items-center justify-center text-wood-400 hover:text-bronze-400 hover:border-bronze-400 hover:scale-110 transition-all duration-300">
                                <Instagram size={18} />
                            </a>
                            <a href="mailto:hello@adrianrasmussen.art" aria-label="Email" className="w-10 h-10 rounded-full border border-wood-700 flex items-center justify-center text-wood-400 hover:text-bronze-400 hover:border-bronze-400 hover:scale-110 transition-all duration-300">
                                <Mail size={18} />
                            </a>
                        </div>
                    </div>
                </div>

                {/* #2 Gradient divider */}
                <div className="h-px w-full bg-gradient-to-r from-transparent via-wood-600 to-transparent"></div>

                {/* Bottom Bar — "Designed in Ubud, Bali" removed */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-mono uppercase tracking-[0.2em] text-wood-600 pt-8">
                    <div className="flex gap-6">
                        <span>© {new Date().getFullYear()} Adrian Rasmussen</span>
                        <Link to="/privacy" className="hover:text-wood-300 transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-wood-300 transition-colors">Terms</Link>
                    </div>
                    {/* #11 Scroll-to-top */}
                    <ScrollToTop />
                </div>
            </div>
        </footer>
    );
};

export default Footer;

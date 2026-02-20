
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, CheckCircle } from 'lucide-react';

// Set VITE_FORMSPREE_NEWSLETTER_ID in .env.local to enable newsletter submissions.
// e.g. VITE_FORMSPREE_NEWSLETTER_ID=xpwzgjkl
const NEWSLETTER_FORMSPREE_ID = import.meta.env.VITE_FORMSPREE_NEWSLETTER_ID as string | undefined;

const NewsletterForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!email || submitting) return;
        setSubmitting(true);
        setError(false);

        if (NEWSLETTER_FORMSPREE_ID) {
            try {
                const res = await fetch(`https://formspree.io/f/${NEWSLETTER_FORMSPREE_ID}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({ email }),
                });
                if (res.ok) {
                    setSubmitted(true);
                } else {
                    setError(true);
                }
            } catch {
                setError(true);
            }
        } else {
            // No Formspree configured — show success optimistically in development
            setSubmitted(true);
        }
        setSubmitting(false);
    };

    if (submitted) {
        return (
            <div className="flex items-center gap-2 py-2">
                <CheckCircle size={14} className="text-bronze-500 shrink-0" />
                <span className="font-serif text-base text-wood-600">You're on the list.</span>
            </div>
        );
    }

    return (
        <div className="w-full md:w-80">
        <form
            className={`flex border-b ${error ? 'border-red-400' : 'border-wood-400'} focus-within:border-bronze-600 transition-colors pb-1 w-full group`}
            onSubmit={handleSubmit}
        >
            <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(false); }}
                required
                className="bg-transparent w-full outline-none text-wood-900 placeholder-wood-400 font-serif text-lg"
            />
            <button
                type="submit"
                disabled={submitting}
                className="text-wood-400 group-hover:text-bronze-600 transition-colors disabled:opacity-40"
            >
                <ArrowRight size={18} />
            </button>
        </form>
        {error && (
            <p className="font-serif text-xs text-red-500 mt-1">Something went wrong. Please try again.</p>
        )}
        </div>
    );
};

const Footer: React.FC = () => {
    return (
        <footer className="bg-wood-100 text-wood-900 pt-16 pb-8 px-6 relative overflow-hidden border-t border-wood-200 print:hidden">
            {/* 8. The Studio Mark (Visual Anchor - Subtle) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-wood-200 rounded-full opacity-40 pointer-events-none"></div>

            <div className="max-w-[1400px] mx-auto relative z-10">

                {/* Top Section: Brand & Newsletter (Horizontal Split) */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-12 mb-16">

                    {/* 3. Refined Branding */}
                    <div className="max-w-md">
                        <h2 className="font-serif text-2xl md:text-3xl text-wood-900 mb-4 tracking-tight font-medium">Adrian Rasmussen</h2>
                        <p className="font-sans text-wood-600 text-sm leading-[1.7]">
                            Resonant artifacts for the modern sanctuary. <br />
                            Exploring the intersection of digital precision and organic imperfection.
                        </p>
                    </div>

                    {/* 4. Minimalist Newsletter */}
                    <div className="w-full md:w-auto">
                        <span className="font-mono text-xs uppercase tracking-widest text-wood-500 block mb-1 font-bold">
                            Join the Inner Circle
                        </span>
                        <span className="font-serif text-sm text-wood-500 italic block mb-3">
                            When something wants to be shared, it arrives here first.
                        </span>
                        <NewsletterForm />
                    </div>
                </div>

                {/* Middle Section: Navigation (2. Horizontal Architecture, 5. Curated Nav) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16 border-t border-wood-200 pt-12">

                    {/* Column 1: Main */}
                    <div className="flex flex-col gap-3.5">
                        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-wood-500 font-bold mb-2">Index</span>
                        <Link to="/creations" className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Creations</Link>
                        <Link to="/writings" className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Writings</Link>
                        <Link to="/shop" className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Shop</Link>
                        <a href="https://teajia.com" target="_blank" rel="noopener noreferrer" className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit group">
                            <span>Teajia</span>
                            <span className="block font-serif text-xs text-wood-500 font-light mt-0.5">Global tea culture. Ceremony and treasures.</span>
                        </a>
                    </div>

                    {/* Column 2: Studio */}
                    <div className="flex flex-col gap-3.5">
                        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-wood-500 font-bold mb-2">Studio</span>
                        <Link to="/about" className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">About</Link>
                        <Link to="/inquire" className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Commissions</Link>
                        <Link to="/inquire" className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Contact</Link>
                    </div>

                    {/* Column 3: Info */}
                    <div className="flex flex-col gap-3.5">
                        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-wood-500 font-bold mb-2">Information</span>
                        <button className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Shipping & Returns</button>
                        <button className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Care Guide</button>
                        <button className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Authenticity</button>
                    </div>

                    {/* Column 4: Social */}
                    <div className="flex flex-col gap-3.5">
                        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-wood-500 font-bold mb-2">Connect</span>
                        <a href="#" className="flex items-center gap-2 font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit group">
                            Instagram <ArrowUpRight size={14} className="text-wood-400 group-hover:text-bronze-600" />
                        </a>
                        <a href="mailto:hello@adrianrasmussen.art" className="flex items-center gap-2 font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit group">
                            Email <ArrowUpRight size={14} className="text-wood-400 group-hover:text-bronze-600" />
                        </a>
                    </div>
                </div>

                {/* Bottom Bar: 8. Meta-Data & 1. Light Theme */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-mono uppercase tracking-[0.15em] text-wood-500 pt-8 border-t border-wood-200">
                    <div className="flex gap-6">
                        <span>© {new Date().getFullYear()} Adrian Rasmussen</span>
                        <Link to="/privacy" className="hover:text-wood-800 transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-wood-800 transition-colors">Terms</Link>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-bronze-400"></span>
                        <span>Designed in Ubud, Bali</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

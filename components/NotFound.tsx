
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const NotFound: React.FC = () => {
    return (
        <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6 flex items-center justify-center">
            <div className="max-w-xl text-center">
                <span className="font-mono text-xs uppercase tracking-[0.3em] text-bronze-600 block mb-6 font-bold">404</span>
                <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-6 font-medium">
                    Page Not Found
                </h1>
                <p className="font-serif text-xl text-wood-600 mb-12 leading-relaxed font-light">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-3 px-8 py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-bronze-600 transition-colors"
                    >
                        Go Home <ArrowRight size={14} />
                    </Link>
                    <Link
                        to="/creations"
                        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-900 hover:text-bronze-600 font-bold border-b border-wood-900 pb-1"
                    >
                        Browse Creations
                    </Link>
                </div>
            </div>
        </section>
    );
};

export default NotFound;

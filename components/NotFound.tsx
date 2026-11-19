
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const NotFound: React.FC = () => {
    const navigate = useNavigate();

    return (
        <section className="bg-surface-page min-h-screen pt-32 pb-32 px-6 flex items-center justify-center">
            <div className="max-w-xl text-center">
                <span className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 block mb-6 font-semibold">404</span>
                <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-6 font-medium">
                    Page Not Found
                </h1>
                <p className="font-serif text-xl text-wood-600 mb-12 leading-prose font-light">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <Link
                        to="/"
                        className="btn btn-primary"
                    >
                        Go Home <ArrowRight size={14} />
                    </Link>
                    <Link
                        to="/creations"
                        className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 pb-1"
                    >
                        Browse Creations
                    </Link>
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-600 hover:text-bronze-600 font-semibold border-b border-wood-300 pb-1"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        </section>
    );
};

export default NotFound;


import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

const BackToTop: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handler = () => setVisible(window.scrollY > 600);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    return (
        <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
            className={`fixed bottom-8 right-8 w-10 h-10 rounded-full bg-paper-50 border border-wood-200 shadow-md flex items-center justify-center text-wood-500 hover:text-wood-900 hover:border-bronze-300 transition-all duration-300 z-40 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
        >
            <ArrowUp size={16} aria-hidden="true" />
        </button>
    );
};

export default BackToTop;


import { useState, useEffect } from 'react';

/** Tracks scroll progress (0–100) for a reading progress bar. */
export function useScrollProgress(): number {
    const [pct, setPct] = useState(0);
    useEffect(() => {
        const onScroll = () => {
            const top = window.scrollY;
            const total = document.documentElement.scrollHeight - window.innerHeight;
            setPct(total > 0 ? (top / total) * 100 : 0);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    return pct;
}

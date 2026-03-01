
import { useRef, useEffect } from 'react';

/** Applies a CSS translateY parallax offset based on scroll position. */
export function useParallax(speed = 0.18) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const tick = () => {
            const el = ref.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * speed;
            el.style.transform = `translateY(${offset}px)`;
        };
        window.addEventListener('scroll', tick, { passive: true });
        tick();
        return () => window.removeEventListener('scroll', tick);
    }, [speed]);
    return ref;
}

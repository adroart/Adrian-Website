import { useRef, useEffect } from 'react';

/**
 * Adds `is-visible` when the element scrolls into view. Fires once.
 *
 * Reveal blocks start at `opacity: 0`, so anything that stops this hook from firing
 * leaves content permanently invisible rather than merely un-animated. Three things
 * could do that, and all three are handled here:
 *
 *   1. Reduced motion. Someone who has asked their system for less movement was still
 *      getting content that began invisible and slid into place. They now get it
 *      immediately, with no transition at all (the CSS half of this is in index.css).
 *
 *   2. Already in view on mount. IntersectionObserver does fire for elements that are
 *      visible at observation time, but only after a frame, and on a route change with
 *      restored scroll it can miss. Checked directly instead.
 *
 *   3. The observer never firing. A tall block whose 10% threshold is never met, a
 *      container that never scrolls, an observer starved on a slow device. The
 *      fallback timer guarantees content appears regardless. This is why the About
 *      page measured 7,172px tall with ten text blocks sitting at opacity 0.
 */
export function useReveal() {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const show = () => el.classList.add('is-visible');

        // Reduced motion: no reveal, no wait.
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            show();
            return;
        }

        // Already on screen when we mounted.
        const box = el.getBoundingClientRect();
        if (box.top < window.innerHeight && box.bottom > 0) {
            show();
            return;
        }

        if (typeof IntersectionObserver === 'undefined') {
            show();
            return;
        }

        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    show();
                    obs.disconnect();
                }
            },
            // A small bottom margin starts the reveal just before the block is reached,
            // so it has finished by the time it is actually being read.
            { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
        );
        obs.observe(el);

        // Safety net. If nothing has revealed this within eight seconds, the observer
        // is not going to. Better a block that appears unanimated than one that is
        // never readable.
        const failsafe = window.setTimeout(show, 8000);

        return () => {
            obs.disconnect();
            window.clearTimeout(failsafe);
        };
    }, []);

    return ref;
}

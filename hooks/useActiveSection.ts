
import { useState, useEffect } from 'react';

interface Section {
    id: string;
    label: string;
}

/** Tracks which section is currently in the viewport using IntersectionObserver. */
export function useActiveSection(sections: Section[]): string {
    const [active, setActive] = useState(sections[0]?.id ?? '');
    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
            },
            { threshold: 0.35 }
        );
        sections.forEach(({ id }) => {
            const el = document.getElementById(id);
            if (el) obs.observe(el);
        });
        return () => obs.disconnect();
    }, [sections]);
    return active;
}

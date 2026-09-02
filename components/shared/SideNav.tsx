
import React from 'react';
import { useActiveSection } from '../../hooks/useActiveSection';

interface Section {
    id: string;
    label: string;
}

interface SideNavProps {
    sections: Section[];
}

/** Sticky dot navigation on the right side of the page (desktop only). */
const SideNav: React.FC<SideNavProps> = ({ sections }) => {
    const active = useActiveSection(sections);
    const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    return (
        <nav className="fixed right-5 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-end gap-[14px]" aria-label="Page sections">
            {sections.map(({ id, label }) => {
                const isActive = active === id;
                return (
                    <button key={id} onClick={() => go(id)} className="group flex items-center gap-2.5 cursor-pointer" aria-label={`Jump to ${label}`}>
                        <span className={`font-label text-[11px] uppercase tracking-[0.2em] transition-all duration-300 ${isActive ? 'opacity-100 text-bronze-600' : 'opacity-0 text-wood-700 translate-x-2 group-hover:opacity-60 group-hover:translate-x-0'}`}>
                            {label}
                        </span>
                        <span className={`block rounded-full transition-all duration-300 ${isActive ? 'w-2.5 h-2.5 bg-bronze-500 shadow-[0_0_0_2px_rgba(196,170,124,0.25)]' : 'w-1.5 h-1.5 bg-wood-300 group-hover:bg-bronze-400'}`} />
                    </button>
                );
            })}
        </nav>
    );
};

export default SideNav;

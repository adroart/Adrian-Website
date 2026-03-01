
import React from 'react';
import { useReveal } from '../../hooks/useReveal';

export type RevealDir = 'up' | 'left' | 'right' | 'scale' | 'fade';

interface RevealProps {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    dir?: RevealDir;
}

const Reveal: React.FC<RevealProps> = ({ children, className = '', delay = 0, dir = 'up' }) => {
    const ref = useReveal();
    return (
        <div ref={ref} className={`reveal-block reveal-${dir} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
            {children}
        </div>
    );
};

export default Reveal;

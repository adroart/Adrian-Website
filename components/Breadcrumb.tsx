
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

export interface Crumb {
    label: string;
    to?: string; // if omitted, it's the current page (no link)
}

interface BreadcrumbProps {
    crumbs: Crumb[];
    className?: string;
}

function injectBreadcrumbSchema(crumbs: Crumb[]): void {
    const itemListElement = crumbs.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: crumb.label,
        ...(crumb.to ? { item: `https://adrianrasmussen.com${crumb.to}` } : {}),
    }));

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement,
    };

    const id = 'breadcrumb-schema';
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
        el = document.createElement('script');
        el.type = 'application/ld+json';
        el.id = id;
        document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(schema)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ crumbs, className = '' }) => {
    useEffect(() => {
        injectBreadcrumbSchema(crumbs);
        return () => {
            const el = document.getElementById('breadcrumb-schema');
            if (el) el.remove();
        };
    }, [crumbs]);

    return (
        <nav
            aria-label="Breadcrumb"
            className={`flex items-center gap-1.5 font-label text-[11px] uppercase tracking-[0.15em] text-wood-700 ${className}`}
        >
            {crumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                    {i > 0 && (
                        <span className="text-wood-700" aria-hidden="true">·</span>
                    )}
                    {crumb.to ? (
                        <Link to={crumb.to} className="hover:text-bronze-600 transition-colors">
                            {crumb.label}
                        </Link>
                    ) : (
                        <span className="text-wood-700" aria-current="page">{crumb.label}</span>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
};

export default Breadcrumb;

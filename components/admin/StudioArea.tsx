import React from 'react';
import { Link } from 'react-router-dom';
import { STUDIO_AREAS } from './AdminNavigation';
import { AdminPage, AdminPageHeader, AdminSection } from './AdminPage';

const StudioArea: React.FC<{ area: keyof typeof STUDIO_AREAS }> = ({ area }) => {
  const { title, sections } = STUDIO_AREAS[area];

  return (
    <AdminPage width="narrow">
      <AdminPageHeader title={title} />
      {sections.map(section => (
        <AdminSection key={section.title} title={section.title}>
          <ul className="divide-y divide-wood-200">
            {section.items.map(({ label, href, description }) => (
              <li key={href}>
                <Link
                  className="grid min-h-[var(--control-h)] items-center gap-1 py-2 text-wood-800 hover:text-bronze-700 sm:grid-cols-[minmax(8rem,1fr)_2fr] sm:gap-4"
                  to={href}
                  aria-label={label}
                >
                  <strong className="font-body text-base font-semibold">{label}</strong>
                  {description && <span className="font-body text-sm text-wood-600">{description}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </AdminSection>
      ))}
    </AdminPage>
  );
};

export default StudioArea;

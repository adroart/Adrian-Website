import React from 'react';
import espresso from '../ceremony/tokens';
import { createCeremonyUI } from '../ceremony/ui';

/**
 * The one ceremony UI the admin desk draws with. The label floor is raised on
 * purpose: the kit's default quiet ink fails AA on this ground in daylight,
 * and its 9.5px uppercase eyebrow is below the site's own written floor. The
 * desk reads at 11px in a lifted quiet ink instead.
 */
export const adminUI = createCeremonyUI(espresso, {
  label: { size: 11, tone: '#a39b90' },
});

const { Head, Body } = adminUI;

export const AdminPage: React.FC<React.PropsWithChildren<{ width?: 'narrow' | 'medium' | 'wide' }>> = ({
  width = 'medium',
  children,
}) => <div className={`admin-page admin-page-${width} collector-root`}>{children}</div>;

export const AdminPageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, description, actions }) => (
  <header className="admin-page-header">
    <div>
      {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
      <Head as="h1" size="clamp(32px, 4vw, 46px)">{title}</Head>
      {description && (
        <div style={{ maxWidth: '42rem' }}>
          <Body size={14} top={12}>{description}</Body>
        </div>
      )}
    </div>
    {actions && <div className="admin-page-actions">{actions}</div>}
  </header>
);

export const AdminSection: React.FC<React.PropsWithChildren<{ title: string; description?: string }>> = ({
  title,
  description,
  children,
}) => (
  <section className="admin-section">
    <header>
      <Head as="h2" size={23}>{title}</Head>
      {description && <Body size={13} top={7} tone="#a39b90">{description}</Body>}
    </header>
    {children}
  </section>
);

export const AdminAlert: React.FC<React.PropsWithChildren<{
  tone: 'info' | 'success' | 'warning' | 'error';
  live?: boolean;
}>> = ({ tone, live, children }) => (
  <div
    className={`admin-alert admin-alert-${tone}`}
    role={tone === 'error' ? 'alert' : 'status'}
    aria-live={live ? 'polite' : undefined}
  >
    <span className="admin-alert-label">{tone}</span>
    <div>{children}</div>
  </div>
);

export const AdminEmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="admin-empty-state">
    <Head as="h3" size={21}>{title}</Head>
    <div style={{ maxWidth: '32rem', margin: '0 auto' }}>
      <Body size={13.5} top={9} tone="#a39b90">{description}</Body>
    </div>
    {action}
  </div>
);

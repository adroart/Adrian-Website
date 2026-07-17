import React from 'react';

export const AdminPage: React.FC<React.PropsWithChildren<{ width?: 'narrow' | 'medium' | 'wide' }>> = ({
  width = 'medium',
  children,
}) => <div className={`admin-page admin-page-${width}`}>{children}</div>;

export const AdminPageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, description, actions }) => (
  <header className="admin-page-header">
    <div>
      {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
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
      <h2>{title}</h2>
      {description && <p>{description}</p>}
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
    <h3>{title}</h3>
    <p>{description}</p>
    {action}
  </div>
);

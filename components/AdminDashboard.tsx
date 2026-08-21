import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AdminAlert,
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminSection,
} from './admin/AdminPage';

type WorkItem = {
  domain: string;
  title: string;
  state: string;
  signal: string;
  actionLabel: string;
  href: string;
};

type RecentItem = { title: string; signal: string; href: string };

type AdminOverview = {
  queue: { complete: true; items: WorkItem[] };
  recentArtworks: RecentItem[];
  recentCollectors: RecentItem[];
};

// Registration comes first because it is the act that creates the artwork's
// permanent identity. The plate is optional and can only be made for a work
// that already has one, so it follows rather than leads.
const START_NEW = [
  { label: 'Register an artwork', description: 'Give a work its permanent identity', href: '/admin/register' },
  { label: 'Issue a plate', description: 'The optional plate, for a work already registered', href: '/admin/pieces/wizard' },
  { label: 'Create invoice', description: 'Price and send new work', href: '/admin/invoices?mode=create' },
  { label: 'Build a viewing', description: 'Prepare a collector presentation', href: '/admin/viewings?mode=create' },
];

function isOverview(value: unknown): value is AdminOverview {
  if (!value || typeof value !== 'object') return false;
  const overview = value as Partial<AdminOverview>;
  return overview.queue?.complete === true
    && Array.isArray(overview.queue.items)
    && Array.isArray(overview.recentArtworks)
    && Array.isArray(overview.recentCollectors);
}

const stateText = (value: string) => value.replaceAll('_', ' ');

const RecentList: React.FC<{ items: RecentItem[]; empty: string }> = ({ items, empty }) => (
  items.length === 0
    ? <p className="font-sans text-sm text-wood-600">{empty}</p>
    : (
      <div className="border-t border-wood-200">
        {items.map(item => (
          <Link
            to={item.href}
            key={`${item.href}:${item.title}`}
            className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-wood-200 py-3 font-sans text-sm text-wood-800 transition-colors hover:bg-paper-100"
          >
            <span className="min-w-0">{item.title}</span>
            <span className="text-xs text-wood-500">{item.signal}</span>
          </Link>
        ))}
      </div>
    )
);

const AdminDashboard: React.FC = () => {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch('/api/admin/overview', { cache: 'no-store', signal });
      if (!response.ok) throw new Error('overview unavailable');
      const data: unknown = await response.json();
      if (!isOverview(data)) throw new Error('overview incomplete');
      setOverview(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setOverview(null);
      setFailed(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadOverview(controller.signal);
    return () => controller.abort();
  }, [loadOverview]);

  return (
    <AdminPage width="medium">
      <AdminPageHeader
        eyebrow="Private studio"
        title="Studio overview"
        description="The exact work waiting for you, followed by the relationships you touched most recently."
      />

      <AdminSection title="Work that needs you" description="One next step for each item in the private studio ledger.">
        {loading && <p className="admin-dashboard-loading" role="status">Checking the studio…</p>}
        {failed && (
          <AdminAlert tone="warning" live>
            <p>The complete work queue could not be checked. Nothing has been marked clear.</p>
            <button type="button" onClick={() => void loadOverview()}>Try again</button>
          </AdminAlert>
        )}
        {!loading && !failed && overview?.queue.items.length === 0 && (
          <AdminEmptyState
            title="Nothing is waiting"
            description="Every supported studio source was checked and no actionable work was found."
          />
        )}
        {!loading && !failed && overview && overview.queue.items.length > 0 && (
          <div className="border-t border-wood-200">
            {overview.queue.items.map(item => (
              <Link
                to={item.href}
                key={`${item.domain}:${item.href}:${item.state}`}
                className="grid min-h-16 grid-cols-1 gap-2 border-b border-wood-200 py-4 text-wood-800 transition-colors hover:bg-paper-100 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
              >
                <span className="min-w-0">
                  <strong className="block font-serif text-lg text-wood-900">{item.title}</strong>
                  <span className="block font-sans text-xs text-wood-600">
                    {stateText(item.state)} · {item.signal}
                  </span>
                </span>
                <span className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-wood-500">
                  {item.actionLabel}
                </span>
              </Link>
            ))}
          </div>
        )}
      </AdminSection>

      {!loading && !failed && overview && (
        <div className="grid gap-8 md:grid-cols-2">
          <AdminSection title="Recent artworks">
            <RecentList items={overview.recentArtworks} empty="No recently registered artwork yet." />
          </AdminSection>
          <AdminSection title="Recent collectors or reconnections">
            <RecentList items={overview.recentCollectors} empty="No recent reconnection work yet." />
          </AdminSection>
        </div>
      )}

      <AdminSection title="Start new" description="Begin the small set of workflows you create most often.">
        <div className="admin-quick-actions">
          {START_NEW.map(action => (
            <Link to={action.href} key={action.label} className="admin-action-card">
              <strong>{action.label}</strong>
              <span>{action.description}</span>
            </Link>
          ))}
        </div>
      </AdminSection>
    </AdminPage>
  );
};

export default AdminDashboard;

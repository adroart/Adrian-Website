import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AdminAlert,
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminSection,
} from './admin/AdminPage';

type AdminAttention = {
  plates: number;
  draftViewings: number;
  openInvoices: number;
};

type AttentionItem = {
  key: keyof AdminAttention;
  label: string;
  singular: string;
  href: string;
};

const ATTENTION_ITEMS: AttentionItem[] = [
  { key: 'plates', label: 'Plates need preparation', singular: 'plate needs preparation', href: '/admin/pieces' },
  { key: 'draftViewings', label: 'Viewings remain in draft', singular: 'viewing remains in draft', href: '/admin/viewings' },
  { key: 'openInvoices', label: 'Invoices remain open', singular: 'invoice remains open', href: '/admin/invoices' },
];

const QUICK_ACTIONS = [
  { label: 'Issue a plate', description: 'Guided, start to finish', href: '/admin/pieces/wizard' },
  { label: 'Create invoice', description: 'Price and send new work', href: '/admin/invoices?mode=create' },
  { label: 'Build a viewing', description: 'Prepare a collector presentation', href: '/admin/viewings?mode=create' },
  { label: 'Write a story', description: 'Open the Stories editor', href: '/keystatic/collections/stories/create' },
  { label: 'Publish a poem', description: 'Create text with optional audio', href: '/admin/poetry?mode=create' },
  { label: 'Upload media', description: 'Add audio or a document', href: '/admin/files' },
];

const ALL_TOOLS = [
  { label: 'Registry and plates', href: '/admin/pieces' },
  { label: 'Private viewings', href: '/admin/viewings' },
  { label: 'Artwork stories', href: '/admin/book' },
  { label: 'Stories', href: '/keystatic' },
  { label: 'Poetry', href: '/admin/poetry' },
  { label: 'Media', href: '/admin/files' },
  { label: 'Pricing', href: '/admin/pricing' },
  { label: 'Invoices', href: '/admin/invoices' },
];

const AdminDashboard: React.FC = () => {
  const [attention, setAttention] = useState<AdminAttention | null>(null);
  const [overviewAvailable, setOverviewAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch('/api/admin/overview', { cache: 'no-store', signal });
      if (!response.ok) throw new Error('overview unavailable');
      const data = await response.json();
      setAttention(data.attention ?? null);
      setOverviewAvailable(data.attention !== null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
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

  const visibleAttention = attention
    ? ATTENTION_ITEMS.filter(item => attention[item.key] > 0)
    : [];

  return (
    <AdminPage width="medium">
      <AdminPageHeader
        eyebrow="Private studio"
        title="Studio overview"
        description="The work that needs you, followed by the actions you use most."
      />

      {overviewAvailable && (
        <AdminSection title="Needs attention" description="Live counts from the private studio ledger.">
          {loading && <p className="admin-dashboard-loading" role="status">Checking the studio…</p>}
          {failed && (
            <AdminAlert tone="warning" live>
              <p>The overview could not be refreshed.</p>
              <button type="button" onClick={() => void loadOverview()}>Try again</button>
            </AdminAlert>
          )}
          {!loading && !failed && visibleAttention.length === 0 && (
            <AdminEmptyState
              title="Nothing is waiting"
              description="The current plate, viewing, and invoice queues are clear."
            />
          )}
          {!loading && !failed && visibleAttention.length > 0 && (
            <div className="admin-attention-list">
              {visibleAttention.map(item => {
                const count = attention?.[item.key] || 0;
                return (
                  <Link to={item.href} key={item.key} className="admin-attention-row">
                    <span className="admin-attention-count">{count}</span>
                    <span>{count === 1 ? item.singular : item.label}</span>
                    <span aria-hidden="true">Open</span>
                  </Link>
                );
              })}
            </div>
          )}
        </AdminSection>
      )}

      <AdminSection title="Quick actions" description="Begin the work without searching through tools.">
        <div className="admin-quick-actions">
          {QUICK_ACTIONS.map(action => (
            <Link to={action.href} key={action.label} className="admin-action-card">
              <strong>{action.label}</strong>
              <span>{action.description}</span>
            </Link>
          ))}
        </div>
      </AdminSection>

      <AdminSection title="All tools">
        <div className="admin-tool-links">
          {ALL_TOOLS.map(tool => <Link to={tool.href} key={tool.label}>{tool.label}</Link>)}
        </div>
      </AdminSection>
    </AdminPage>
  );
};

export default AdminDashboard;

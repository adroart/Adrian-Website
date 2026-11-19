export type AdminNavigationItem = {
  label: string;
  href: string;
};

export const ADMIN_NAVIGATION: AdminNavigationItem[] = [
  { label: 'Studio overview', href: '/admin' },
  { label: 'Sales', href: '/admin/sales' },
  { label: 'Artwork', href: '/admin/artworks' },
  { label: 'Publishing', href: '/admin/publishing' },
];

type StudioSection = {
  title: string;
  items: (AdminNavigationItem & { description?: string })[];
};

const salesTools = [
  { label: 'Invoices', href: '/admin/invoices', description: 'Find a draft, record a payment, or review a paid invoice.' },
  { label: 'Private viewings', href: '/admin/viewings', description: 'Prepare a viewing or follow up on a request.' },
  { label: 'Verified sales', href: '/admin/collector-sales', description: 'Find a sale, its artwork, or a collector reconnection.' },
  { label: 'Pricing', href: '/admin/pricing', description: 'Calculate and save an estimate.' },
];

const publishingTools = [
  { label: 'Stories', href: '/keystatic', description: 'Edit articles for Writings.' },
  { label: 'Poetry', href: '/admin/poetry', description: 'Manage poems and readings.' },
  { label: 'Book', href: '/admin/book', description: 'Edit the artwork book.' },
  { label: 'Media', href: '/admin/files', description: 'Find and manage media files.' },
];

export const STUDIO_AREAS: Record<'sales' | 'publishing' | 'tools', { title: string; sections: StudioSection[] }> = {
  sales: {
    title: 'Sales',
    sections: [
      { title: 'Continue work', items: salesTools },
      {
        title: 'Start new',
        items: [
          { label: 'Create invoice', href: '/admin/invoices?mode=create' },
          { label: 'Build a viewing', href: '/admin/viewings?mode=create' },
        ],
      },
      { title: 'Sales tools', items: [{ label: 'Atlas pending sales', href: '/admin/atlas-sales' }] },
    ],
  },
  publishing: { title: 'Publishing', sections: [{ title: 'Workspaces', items: publishingTools }] },
  tools: {
    title: 'Studio tools',
    sections: [
      {
        title: 'Artwork and continuity',
        items: [
          { label: 'Certificate editor', href: '/admin/certificates' },
          { label: 'Invitations', href: '/admin/invitations' },
          { label: 'Plate registry', href: '/admin/pieces' },
          { label: 'Plate and recovery wizard', href: '/admin/pieces/wizard' },
          { label: 'Maintenance', href: '/admin/maintenance' },
          { label: 'Succession', href: '/admin/succession' },
        ],
      },
      {
        title: 'Workshop',
        items: [
          { label: 'Screen development system', href: '/admin/screens' },
          { label: 'Rehearsal', href: '/admin/rehearsal' },
        ],
      },
    ],
  },
};

function isWithin(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function studioNavigationArea(pathname: string): string | undefined {
  if (pathname === '/admin' || pathname === '/admin/') return '/admin';
  if (isWithin(pathname, '/admin/sales') || salesTools.some(tool => isWithin(pathname, tool.href))
    || isWithin(pathname, '/admin/atlas-sales')) return '/admin/sales';
  if (isWithin(pathname, '/admin/publishing') || publishingTools.some(tool => isWithin(pathname, tool.href))) {
    return '/admin/publishing';
  }
  if (['artworks', 'register', 'registrations', 'certificates', 'invitations', 'pieces', 'maintenance', 'succession']
    .some(path => isWithin(pathname, `/admin/${path}`))) return '/admin/artworks';
  return undefined;
}

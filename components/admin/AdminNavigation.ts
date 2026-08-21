export type AdminNavigationItem = {
  label: string;
  href: string;
  end?: boolean;
};

export type AdminNavigationGroup = {
  label: 'Home' | 'Artwork' | 'Continuity' | 'Publishing' | 'Sales' | 'Workshop';
  items: AdminNavigationItem[];
};

export const ADMIN_NAVIGATION: AdminNavigationGroup[] = [
  { label: 'Home', items: [{ label: 'Studio overview', href: '/admin', end: true }] },
  {
    label: 'Artwork',
    items: [
      { label: 'Register an artwork', href: '/admin/register' },
      { label: 'Artworks', href: '/admin/artworks' },
    ],
  },
  {
    label: 'Continuity',
    items: [{ label: 'Succession', href: '/admin/succession' }],
  },
  {
    label: 'Publishing',
    items: [
      { label: 'Stories', href: '/keystatic' },
      { label: 'Poetry', href: '/admin/poetry' },
      { label: 'Media', href: '/admin/files' },
    ],
  },
  {
    /* Where the collector journey is looked at while it is being built. It is
       a separate build on a permanent branch, and this entry is the only place
       its address is written down: without it the link lives in a branch name
       nobody remembers six weeks later. */
    label: 'Workshop',
    items: [{ label: 'Screen development system', href: '/admin/screens' }],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Verified sales', href: '/admin/collector-sales' },
      { label: 'Private viewings', href: '/admin/viewings' },
      { label: 'Pricing', href: '/admin/pricing' },
      { label: 'Invoices', href: '/admin/invoices' },
    ],
  },
];

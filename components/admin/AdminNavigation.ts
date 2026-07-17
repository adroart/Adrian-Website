export type AdminNavigationItem = {
  label: string;
  href: string;
  end?: boolean;
};

export type AdminNavigationGroup = {
  label: 'Home' | 'Artwork' | 'Publishing' | 'Sales';
  items: AdminNavigationItem[];
};

export const ADMIN_NAVIGATION: AdminNavigationGroup[] = [
  { label: 'Home', items: [{ label: 'Studio overview', href: '/admin', end: true }] },
  {
    label: 'Artwork',
    items: [
      { label: 'Registry and plates', href: '/admin/pieces' },
      { label: 'Private viewings', href: '/admin/viewings' },
      { label: 'Artwork stories', href: '/admin/book' },
    ],
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
    label: 'Sales',
    items: [
      { label: 'Pricing', href: '/admin/pricing' },
      { label: 'Invoices', href: '/admin/invoices' },
    ],
  },
];

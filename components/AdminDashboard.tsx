import React from 'react';
import { Link } from 'react-router-dom';
import { AdminPage } from './admin/AdminPage';

interface AdminTool {
  title: string;
  description: string;
  href: string;
  external?: boolean;
  badge?: string;
}

const TOOLS: AdminTool[] = [
  {
    title: 'Keystatic',
    description: 'Write, edit, and publish articles. Changes commit directly to GitHub and deploy automatically.',
    href: '/keystatic',
  },
  {
    title: 'File Manager',
    description: 'Upload audio, documents, or other files to R2 storage and copy the public URL.',
    href: '/admin/files',
  },
  {
    title: 'Poetry',
    description: 'Publish and edit poems for /poetry. Pick an uploaded audio file, paste the poem, click save.',
    href: '/admin/poetry',
  },
  {
    title: 'Book Pages',
    description: 'Write the long-form page for each piece, shown on its works record at /works/:id. Pick a piece, write its story, save. Changes go live immediately.',
    href: '/admin/book',
  },
  {
    title: 'Invoices',
    description: 'Create commission invoices, manage reusable payment options, and copy printable client links.',
    href: '/admin/invoices',
  },
  {
    title: 'Viewings',
    description: 'Build a private art viewing for a collector. Compute their chart, curate the pieces, write the reasons, and preview the artifact they receive.',
    href: '/admin/viewings',
  },
  {
    title: 'Pricing',
    description: 'Your private quoting engine. Set the size, layers, finish, and add-ons, add the design value, and arrive at a suggested retail and a quote. Every multiplier is tunable.',
    href: '/admin/pricing',
  },
  {
    title: 'Plate and fulfillment desk',
    description:
      'Issue a permanent artwork QR and encrypted recoverable Ownership Code, verify and activate its metal plate, then assign that exact plate for fulfillment.',
    href: '/admin/pieces',
  },
];

const COMING_SOON: AdminTool[] = [
  {
    title: 'Shop',
    description: 'Manage products, pricing, and availability.',
    href: '#',
    badge: 'Soon',
  },
];

const AdminDashboard: React.FC = () => {
  return (
    <AdminPage width="medium">
      <div className="max-w-2xl mx-auto">
        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-3">
          Admin
        </p>
        <h1 className="font-title text-4xl md:text-5xl text-wood-900 mb-12">
          Control Panel
        </h1>

        <div className="space-y-3 mb-12">
          {TOOLS.map(tool => (
            <Link
              key={tool.title}
              to={tool.href}
              className="group flex items-start justify-between gap-6 bg-white border border-wood-200 hover:border-bronze-400 px-6 py-5 transition-all hover:shadow-sm"
            >
              <div>
                <h2 className="font-serif text-xl text-wood-900 group-hover:text-bronze-700 transition-colors font-medium mb-1">
                  {tool.title}
                </h2>
                <p className="font-sans text-sm text-wood-500 leading-relaxed">
                  {tool.description}
                </p>
              </div>
              <span className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 group-hover:text-bronze-600 transition-colors font-semibold flex-shrink-0 pt-1">
                Open
              </span>
            </Link>
          ))}
        </div>

        {COMING_SOON.length > 0 && (
          <>
            <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 font-semibold mb-3">
              Coming Soon
            </p>
            <div className="space-y-3">
              {COMING_SOON.map(tool => (
                <div
                  key={tool.title}
                  className="flex items-start justify-between gap-6 bg-paper-100 border border-wood-100 px-6 py-5 opacity-50"
                >
                  <div>
                    <h2 className="font-serif text-xl text-wood-700 font-medium mb-1">
                      {tool.title}
                    </h2>
                    <p className="font-sans text-sm text-wood-400 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                  <span className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-300 font-semibold flex-shrink-0 pt-1">
                    {tool.badge}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminPage>
  );
};

export default AdminDashboard;

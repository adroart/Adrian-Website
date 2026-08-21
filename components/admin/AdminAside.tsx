import React from 'react';

/**
 * A folded paragraph of "why".
 *
 * The Succession desk carries a lot of necessary explanation, and reading
 * all of it at once is what turned that page into a wall. Folded, each
 * explanation stands next to the thing it explains and opens only when it
 * is wanted; nothing is deleted and nothing moves.
 *
 * Text, never an icon, like every other control on this site. The label
 * says what is inside rather than "more", so a closed page still reads as
 * written prose rather than as a row of switches.
 */
const AdminAside: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => (
  <details className="admin-aside">
    <summary>{label}</summary>
    <div className="admin-aside-body">{children}</div>
  </details>
);

export default AdminAside;

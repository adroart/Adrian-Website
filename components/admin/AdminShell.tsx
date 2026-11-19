import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from '../../lib/account/authClient';
import { ADMIN_NAVIGATION, studioNavigationArea } from './AdminNavigation';
import { CeremonyStyles } from '../ceremony/styles';
import { adminUI } from './AdminPage';

const { Ground } = adminUI;

type AdminIdentity = { id: string; email: string };
type LocationLike = { pathname: string; search: string; hash: string };

export function adminReturnDestination(location: LocationLike): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

function studioReturnLink(state: unknown): { href: string; label: string; state?: { artworkListReturnPath: string } } | undefined {
  if (!state || typeof state !== 'object') return;
  if ('artworkReturnPath' in state && typeof state.artworkReturnPath === 'string'
    && /^\/admin\/artworks\/[A-Za-z0-9_-]+(?:\?[^#\s]*)?$/.test(state.artworkReturnPath)) {
    const listPath = 'artworkListReturnPath' in state && typeof state.artworkListReturnPath === 'string'
      && /^\/admin\/artworks(?:\?[^#\s]*)?$/.test(state.artworkListReturnPath)
      ? state.artworkListReturnPath : undefined;
    return {
      href: state.artworkReturnPath,
      label: 'Back to artwork',
      ...(listPath ? { state: { artworkListReturnPath: listPath } } : {}),
    };
  }
  if ('saleReturnPath' in state && typeof state.saleReturnPath === 'string'
    && /^\/admin\/collector-sales\?[^#\s]+$/.test(state.saleReturnPath)) {
    return { href: state.saleReturnPath, label: 'Back to verified sale' };
  }
}

const AdminForbidden: React.FC<{ onSignOut: () => Promise<void> }> = ({ onSignOut }) => (
  <div className="admin-access-state dark">
    <div className="admin-access-card">
      <p className="admin-eyebrow">Adrian Rasmussen Studio</p>
      <h1>Administrator access required</h1>
      <p>You are signed in, but this verified email is not on the administrator list.</p>
      <button type="button" onClick={() => void onSignOut()}>Sign out</button>
    </div>
  </div>
);

const AdminShell: React.FC = () => {
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavigation, setMobileNavigation] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const activeArea = studioNavigationArea(location.pathname);
  const returnLink = studioReturnLink(location.state);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/admin/verify', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401) {
          navigate('/admin/login', {
            state: { from: adminReturnDestination(location) },
            replace: true,
          });
          return;
        }
        if (response.status === 403) {
          setForbidden(true);
          return;
        }
        if (!response.ok) throw new Error('admin verification failed');
        const data = await response.json();
        if (data.ok && data.admin) setAdmin(data.admin);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        navigate('/admin/login', { replace: true });
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });

    return () => controller.abort();
  }, [navigate]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobileNavigation(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (sidebarRef.current) sidebarRef.current.inert = mobileNavigation && !menuOpen;
  }, [menuOpen, mobileNavigation]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => {
      sidebarRef.current?.querySelector<HTMLElement>('nav a')?.focus();
    });
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const logout = async () => {
    await signOut();
    navigate('/admin/login', { replace: true });
  };

  if (checking) {
    return <div className="admin-shell-loading dark" role="status" aria-label="Checking administrator session" />;
  }
  if (forbidden) return <AdminForbidden onSignOut={logout} />;
  if (!admin) return null;

  return (
    <div className="admin-shell dark">
      <CeremonyStyles />
      <button
        ref={menuButtonRef}
        className="admin-menu-button"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="admin-navigation"
        onClick={() => setMenuOpen(open => !open)}
      >
        {menuOpen ? 'Close' : 'Menu'}
      </button>
      {menuOpen && (
        <button
          type="button"
          className="admin-menu-scrim"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside ref={sidebarRef} id="admin-navigation" className={menuOpen ? 'admin-sidebar is-open' : 'admin-sidebar'}>
        <Link to="/admin" className="admin-mark" aria-label="Adrian Rasmussen Studio home">
          <span className="admin-mark-monogram">AR</span>
          <span>Studio</span>
        </Link>
        <nav aria-label="Admin navigation">
          <div className="admin-nav-links">
            {ADMIN_NAVIGATION.map(item => (
              <Link
                key={item.href}
                to={item.href}
                className={activeArea === item.href ? 'active' : undefined}
                aria-current={activeArea === item.href ? location.pathname === item.href ? 'page' : 'location' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
        <NavLink end to="/admin/tools" className="admin-tools-link" onClick={() => setMenuOpen(false)}>
          Studio tools
        </NavLink>
        <div className="admin-account">
          <span title={admin.email}>{admin.email}</span>
          <Link to="/">View site</Link>
          <button type="button" onClick={() => void logout()}>Sign out</button>
        </div>
      </aside>
      <main className="admin-main collector-root" id="admin-main-content" data-marks="0">
        <Ground cut="run" light="l" pad="0">
          {returnLink && (
            <div className="admin-record-return">
              <Link to={returnLink.href} state={returnLink.state}>{returnLink.label}</Link>
            </div>
          )}
          <Outlet />
        </Ground>
      </main>
    </div>
  );
};

export default AdminShell;

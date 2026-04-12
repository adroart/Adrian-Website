
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { useCart } from '../CartContext';
import { useDarkMode } from '../DarkModeContext';
import { LAUNCH_FLAGS } from '../launchFlags';

interface NavigationProps {
  theme?: 'LIGHT' | 'DARK';
}

interface NavItem {
    path: string;
    label: string;
}

const Navigation: React.FC<NavigationProps> = ({ theme = 'LIGHT' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [teajiaBarDismissed, setTeajiaBarDismissed] = useState(() => {
    try { return sessionStorage.getItem('teajia-bar-dismissed') === 'true'; } catch { return false; }
  });
  const { totalItems, openCart } = useCart();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const isDark = theme === 'DARK' || isMobileMenuOpen;
  const textPrimary = isDark ? 'text-paper-50' : 'text-wood-900';
  const textSecondary = isDark ? 'text-stone-300' : 'text-wood-700';
  const accentColor = isDark ? 'text-bronze-400' : 'text-bronze-600';

  const isHome = location.pathname === '/';
  const forceSolidNav = !isHome;
  const useSolid = isScrolled || forceSolidNav || isMobileMenuOpen;

  const solidDark = 'bg-stone-950/95 backdrop-blur-xl border-b border-stone-800';
  const solidLight = 'bg-paper-50/95 backdrop-blur-xl border-b border-wood-200';
  const glassDark = 'bg-stone-950/85 backdrop-blur-xl border-b border-white/10 shadow-sm';
  const glassLight = 'bg-paper-50/90 backdrop-blur-md border-b border-wood-200/50 shadow-sm';

  // #3 Adjust nav position based on whether Teajia bar is visible + scroll state
  const navTop = (teajiaBarDismissed || isScrolled) ? 'top-0' : 'top-8';

  let navClasses = `fixed ${navTop} left-0 w-full z-[100] transition-all duration-500 ease-in-out`;
  if (isMobileMenuOpen) navClasses += ` py-3 ${solidDark} dark-preserve`;
  else if (useSolid && isScrolled) navClasses += ` py-1 ${isDark ? `${solidDark} dark-preserve` : solidLight}`;
  else if (useSolid) navClasses += ` py-3 ${isDark ? `${solidDark} dark-preserve` : solidLight}`;
  else navClasses += ` py-5 ${isDark ? `${glassDark} dark-preserve` : glassLight}`;

  // #1 Helper: check if a nav item is active using prefix matching
  const isNavActive = (itemPath: string) => {
    if (itemPath === '/') return location.pathname === '/';
    return location.pathname === itemPath || location.pathname.startsWith(itemPath + '/');
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on Escape key + lock body scroll when menu open
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    document.body.style.overflow = 'hidden';
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileMenuOpen]);

  const navItems: NavItem[] = [
    { path: '/creations', label: 'Creations' },
    { path: '/writings', label: 'Writings' },
    { path: '/inquire', label: 'Inquire' },
    { path: '/about', label: 'About' },
    ...(LAUNCH_FLAGS.shopEnabled ? [{ path: '/shop', label: 'Shop' }] : []),
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const dismissTeajiaBar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTeajiaBarDismissed(true);
    try { sessionStorage.setItem('teajia-bar-dismissed', 'true'); } catch {}
  };

  return (
    <>
      {/* #3 Dismissable Teajia promo bar — absolute so it scrolls away */}
      {!teajiaBarDismissed && (
        <div className="absolute top-0 left-0 w-full h-8 z-[99] flex items-center justify-center bg-stone-950/90 hover:bg-wood-900 transition-colors group backdrop-blur-sm dark-preserve">
          <a
            href="https://www.teajia.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 opacity-50 group-hover:opacity-100 transition-opacity"
          >
              <span className="text-[11px] font-label uppercase tracking-[0.2em] text-paper-50 group-hover:text-bronze-400 transition-colors">Teajia</span>
              <span className="text-[11px] text-wood-600 hidden sm:inline">|</span>
              <span className="text-[11px] font-label uppercase tracking-[0.2em] text-wood-400 hidden sm:inline">Global tea culture. Ceremony and treasures.</span>
              <ArrowUpRight size={10} className="text-wood-500 group-hover:text-bronze-400" />
          </a>
          <button
            onClick={dismissTeajiaBar}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-wood-600 hover:text-paper-50 transition-colors p-1"
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <nav className={navClasses}>
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 flex justify-between items-center relative z-[120]">
          <Link to="/" className="group flex flex-col items-start">
            <span className={`font-display tracking-normal leading-none transition-all duration-300 font-normal ${textPrimary} hover:${accentColor} ${isScrolled ? 'text-lg' : 'text-2xl'}`}>
              Adrian Rasmussen
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8 xl:gap-12">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`group relative text-xs uppercase tracking-[0.2em] font-label py-2 transition-all duration-300 flex items-center gap-1 font-semibold ${
                  isNavActive(item.path)
                    ? `${textPrimary}`
                    : `${textSecondary} hover:${accentColor}`
                }`}
              >
                {item.label}
                {/* #1 Active underline uses prefix matching */}
                <span className={`absolute -bottom-0 left-0 h-px bg-bronze-500 transition-all duration-300 ease-out ${isNavActive(item.path) ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
              </Link>
            ))}
          </div>

          {/* Right-side controls: dark mode + cart + mobile hamburger */}
          <div className="flex items-center gap-0">
            <button
              onClick={toggleDarkMode}
              className={`p-2 hover:opacity-70 transition-opacity ${textPrimary}`}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            {LAUNCH_FLAGS.shopEnabled && (
            <button
              onClick={openCart}
              className={`relative p-2 hover:opacity-70 transition-opacity ${textPrimary}`}
              aria-label="Open cart"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {totalItems > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-label font-semibold leading-none ${isDark ? 'bg-bronze-400 text-stone-950' : 'bg-bronze-600 text-paper-50'}`}>
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </button>
            )}

            {/* #10 Larger tap target (min 44x44px) + #21 ARIA attributes */}
            <button
              className={`lg:hidden ${textPrimary} hover:opacity-70 transition-opacity p-3 -mr-3 min-w-[48px] min-h-[48px] flex items-center justify-center`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav-menu"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu — #21 ARIA attributes */}
        {isMobileMenuOpen && (
             <div
               id="mobile-nav-menu"
               role="navigation"
               aria-label="Mobile navigation"
               className="lg:hidden absolute top-full left-0 w-full bg-stone-950/95 backdrop-blur-xl border-b border-stone-800 py-10 px-6 flex flex-col gap-7 items-center animate-fade-in shadow-2xl dark-preserve"
             >
                {navItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => handleNavClick(item.path)}
                        className={`text-sm font-label uppercase tracking-[0.2em] font-semibold transition-colors ${isNavActive(item.path) ? 'text-bronze-400' : 'text-paper-50/80 hover:text-paper-50'}`}
                    >
                        {item.label}
                    </button>
                ))}
             </div>
        )}
      </nav>
    </>
  );
};

export default Navigation;

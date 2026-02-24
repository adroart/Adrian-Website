
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { useCart } from '../CartContext';

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
  const { totalItems, openCart } = useCart();

  const isDark = theme === 'DARK' || isMobileMenuOpen;
  const textPrimary = isDark ? 'text-paper-50' : 'text-wood-900';
  const textSecondary = isDark ? 'text-stone-400' : 'text-wood-700';
  const accentColor = isDark ? 'text-bronze-400' : 'text-bronze-600';

  const isHome = location.pathname === '/';
  const forceSolidNav = !isHome;
  const useSolid = isScrolled || forceSolidNav || isMobileMenuOpen;

  const solidDark = 'bg-stone-950/95 backdrop-blur-xl border-b border-stone-800';
  const solidLight = 'bg-paper-50/95 backdrop-blur-xl border-b border-wood-200';
  const glassDark = 'bg-stone-950/75 backdrop-blur-xl border-b border-white/10 shadow-sm';
  const glassLight = 'bg-paper-50/80 backdrop-blur-md border-b border-wood-200/50 shadow-sm';

  let navClasses = `fixed top-8 left-0 w-full z-[100] transition-all duration-500 ease-in-out`;
  if (isMobileMenuOpen) navClasses += ` py-3 ${solidDark} dark-preserve`;
  else if (useSolid) navClasses += ` py-3 ${isDark ? `${solidDark} dark-preserve` : solidLight}`;
  else navClasses += ` py-5 ${isDark ? `${glassDark} dark-preserve` : glassLight}`;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems: NavItem[] = [
    { path: '/creations', label: 'Creations' },
    { path: '/writings', label: 'Writings' },
    { path: '/inquire', label: 'Inquire' },
    { path: '/about', label: 'About' },
    { path: '/shop', label: 'Shop' },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <a
        href="https://www.teajia.com"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed top-0 left-0 w-full h-8 z-[101] flex items-center justify-center bg-stone-950/90 hover:bg-wood-900 transition-colors group cursor-pointer backdrop-blur-sm dark-preserve"
      >
          <div className="flex items-center gap-3 opacity-50 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-paper-50 group-hover:text-bronze-400 transition-colors">Teajia</span>
              <span className="text-[10px] text-wood-600 hidden sm:inline">|</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-wood-400 hidden sm:inline">Global tea culture. Ceremony and treasures.</span>
              <ArrowUpRight size={10} className="text-wood-500 group-hover:text-bronze-400" />
          </div>
      </a>

      <nav className={navClasses}>
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 flex justify-between items-center relative z-[120]">
          <Link to="/" className="group flex flex-col items-start" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className={`text-2xl font-serif tracking-tight leading-none transition-colors font-medium ${textPrimary} hover:${accentColor}`}>
              Adrian Rasmussen
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8 xl:gap-12">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className={`group relative text-xs uppercase tracking-[0.2em] font-mono py-2 transition-all duration-300 flex items-center gap-1 font-semibold ${
                  location.pathname === item.path
                    ? `${textPrimary}`
                    : `${textSecondary} hover:${accentColor}`
                }`}
              >
                {item.label}
                <span className={`absolute -bottom-0 left-0 h-px bg-bronze-500 transition-all duration-300 ease-out ${location.pathname === item.path ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
              </Link>
            ))}
          </div>

          {/* Right-side controls: cart + mobile hamburger */}
          <div className="flex items-center gap-1">
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
                <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[9px] font-mono font-semibold leading-none ${isDark ? 'bg-bronze-400 text-stone-950' : 'bg-bronze-600 text-paper-50'}`}>
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </button>

            <button className={`lg:hidden ${textPrimary} hover:opacity-70 transition-opacity p-2 -mr-2`} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
             <div className="lg:hidden absolute top-full left-0 w-full bg-stone-950/95 backdrop-blur-xl border-b border-stone-800 py-10 px-6 flex flex-col gap-7 items-center animate-fade-in shadow-2xl dark-preserve">
                {navItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => handleNavClick(item.path)}
                        className={`text-sm font-mono uppercase tracking-[0.2em] transition-colors ${location.pathname === item.path ? 'text-bronze-400' : 'text-paper-50/80 hover:text-paper-50'}`}
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

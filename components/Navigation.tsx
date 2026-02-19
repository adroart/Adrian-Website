
import React, { useState, useEffect } from 'react';
import { View } from '../types';
import { Menu, X, ShoppingBag, Bookmark, ArrowUpRight } from 'lucide-react';

interface NavigationProps {
  currentView: View;
  setView: (view: View) => void;
  cartCount: number;
  theme?: 'LIGHT' | 'DARK';
}

interface NavItem {
    id: View;
    label: string;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, setView, cartCount, theme = 'LIGHT' }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isDark = theme === 'DARK' || isMobileMenuOpen;
  const textPrimary = isDark ? 'text-paper-50' : 'text-wood-900';
  const textSecondary = isDark ? 'text-stone-400' : 'text-wood-700'; 
  const accentColor = isDark ? 'text-bronze-400' : 'text-bronze-600';

  const forceSolidNav = currentView !== View.HOME;
  const useSolid = isScrolled || forceSolidNav || isMobileMenuOpen;
  
  const solidDark = 'bg-stone-950/95 backdrop-blur-xl border-b border-stone-800';
  const solidLight = 'bg-paper-50/95 backdrop-blur-xl border-b border-wood-200';
  const glassDark = 'bg-stone-950/75 backdrop-blur-xl border-b border-white/10 shadow-sm';
  const glassLight = 'bg-paper-50/80 backdrop-blur-md border-b border-wood-200/50 shadow-sm';

  let navClasses = `fixed top-9 left-0 w-full z-[100] transition-all duration-500 ease-in-out`;
  if (isMobileMenuOpen) navClasses += ` py-3 ${solidDark}`;
  else if (useSolid) navClasses += ` py-3 ${isDark ? solidDark : solidLight}`;
  else navClasses += ` py-5 ${isDark ? glassDark : glassLight}`;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems: NavItem[] = [
    { id: View.CREATIONS, label: 'Creations' },
    { id: View.WRITINGS, label: 'Writings' },
    { id: View.INQUIRE, label: 'Inquire' },
    { id: View.ABOUT, label: 'About' },
    { id: View.SHOP, label: 'Shop' },
  ];

  const handleNavClick = (view: View) => {
    setView(view);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <a 
        href="https://www.teajia.com" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="fixed top-0 left-0 w-full h-9 z-[101] flex items-center justify-center bg-stone-950 border-b border-white/5 hover:bg-wood-900 transition-colors group cursor-pointer"
      >
          <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-paper-50 group-hover:text-bronze-400 transition-colors">Teajia</span>
              <span className="text-[10px] text-wood-600 hidden sm:inline">|</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.05em] text-wood-400 hidden sm:inline">The Tea Community Platform</span>
              <ArrowUpRight size={10} className="text-wood-500 group-hover:text-bronze-400" />
          </div>
      </a>

      <nav className={navClasses}>
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 flex justify-between items-center relative z-[120]">
          <button onClick={() => handleNavClick(View.HOME)} className="group flex flex-col items-start">
            <span className={`text-2xl font-serif tracking-tight leading-none transition-colors font-medium ${textPrimary} hover:${accentColor}`}>
              Adrian Rasmussen
            </span>
          </button>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8 xl:gap-12">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`relative text-xs uppercase tracking-[0.2em] font-mono py-2 transition-all duration-300 flex items-center gap-1 font-bold ${
                  currentView === item.id
                    ? `${textPrimary}`
                    : `${textSecondary} hover:${accentColor}`
                }`}
              >
                {item.label}
                <span className={`absolute -bottom-0 left-0 h-px bg-bronze-500 transition-all duration-300 ease-out ${currentView === item.id ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-6">
            <button onClick={() => handleNavClick(View.CART)} title="Your Selection" className={`relative group transition-colors ${textPrimary} hover:${accentColor}`}>
              <ShoppingBag size={20} strokeWidth={1.5} className={currentView === View.CART ? 'fill-current' : ''} />
              {cartCount > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 text-[10px] font-bold font-mono w-4 h-4 flex items-center justify-center rounded-full shadow-md ${isDark ? 'bg-bronze-500 text-stone-900' : 'bg-wood-900 text-paper-50'}`}>
                      {cartCount}
                  </span>
              )}
            </button>
            <button className={`lg:hidden ${textPrimary} hover:opacity-70 transition-opacity ml-2 p-2`} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
             <div className="lg:hidden absolute top-full left-0 w-full bg-stone-950/95 backdrop-blur-xl border-b border-stone-800 py-8 px-6 flex flex-col gap-6 items-center animate-fade-in shadow-2xl">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`text-lg font-serif tracking-wide ${currentView === item.id ? 'text-bronze-400' : 'text-paper-50'}`}
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

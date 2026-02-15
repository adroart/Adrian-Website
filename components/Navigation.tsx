
import React, { useState, useEffect } from 'react';
import { View } from '../types';
import { Menu, X, ShoppingBag, Bookmark, ArrowUpRight, Sparkles } from 'lucide-react';

interface NavigationProps {
  currentView: View;
  setView: (view: View) => void;
  cartCount: number;
  theme?: 'LIGHT' | 'DARK';
}

interface NavItem {
    id: View;
    label: string;
    children?: { label: string; view?: View; hash?: string }[];
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
    { 
        id: View.ART_HUB, 
        label: 'Art',
        children: [
            { label: 'Featured', view: View.ART_HUB },
            { label: 'Gallery Grid', view: View.ART }
        ]
    },
    { id: View.JEWELRY, label: 'Jewelry' },
    { id: View.ORACLE, label: 'Oracle' },
    { id: View.STORIES, label: 'Journal' },
    { id: View.SHOP, label: 'Shop' },
    { 
        id: View.STUDIO, 
        label: 'Studio',
        children: [
            { label: 'Philosophy', hash: 'studio-about' },
            { label: 'Contact', hash: 'studio-projects' }
        ]
    },
  ];

  const handleNavClick = (view: View, hash?: string) => {
    setView(view);
    setIsMobileMenuOpen(false);
    if (hash) {
        setTimeout(() => {
            const element = document.getElementById(hash);
            if (element) element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <div className="fixed top-0 left-0 w-full h-9 z-[101] flex items-center justify-center bg-stone-950 border-b border-white/5">
          <div className="flex items-center gap-6">
              <span className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-bronze-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-paper-50 font-bold">Adrian Rasmussen Studio</span>
              </span>
          </div>
      </div>

      <nav className={navClasses}>
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 flex justify-between items-center relative z-[120]">
          <button onClick={() => handleNavClick(View.HOME)} className="group flex flex-col items-start">
            <span className={`text-2xl font-serif tracking-tight leading-none transition-colors font-medium ${textPrimary} hover:${accentColor}`}>
              Adrian Rasmussen
            </span>
          </button>

          <div className="hidden lg:flex items-center gap-8 xl:gap-12">
            {navItems.map((item) => (
              <div key={item.id} className="relative group">
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className={`relative text-xs uppercase tracking-[0.2em] font-mono py-2 transition-all duration-300 flex items-center gap-1 font-bold ${
                      currentView === item.id || (item.id === View.ART_HUB && currentView === View.ART)
                        ? `${textPrimary}`
                        : `${textSecondary} hover:${accentColor}`
                    }`}
                  >
                    {item.label}
                    <span className={`absolute -bottom-0 left-0 h-px bg-bronze-500 transition-all duration-300 ease-out ${currentView === item.id ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
                  </button>
                  
                  {item.children && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[110]">
                          <div className={`border border-wood-200 shadow-xl py-2 min-w-[180px] flex flex-col items-center ${isDark ? 'bg-stone-900 border-stone-800' : 'bg-paper-50 border-wood-200'}`}>
                              {item.children.map((child) => (
                                  <button
                                      key={child.label}
                                      onClick={(e) => { e.stopPropagation(); child.view ? handleNavClick(child.view) : handleNavClick(item.id, child.hash); }}
                                      className={`w-full text-center py-2 px-4 font-mono text-xs uppercase tracking-widest hover:text-bronze-500 transition-colors font-semibold ${isDark ? 'text-stone-400' : 'text-wood-600'}`}
                                  >
                                      {child.label}
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-6">
            <button onClick={() => handleNavClick(View.COLLECTION)} title="Favorites" className={`relative group transition-colors ${textPrimary} hover:${accentColor}`}>
                <Bookmark size={20} strokeWidth={1.5} className={currentView === View.COLLECTION ? 'fill-current' : ''} />
            </button>
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
      </nav>
    </>
  );
};

export default Navigation;

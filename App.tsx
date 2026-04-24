
import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';

const KeystaticRoute = lazy(() => import('./components/KeystaticRoute'));
const Home = lazy(() => import('./components/Home'));
const Hero = lazy(() => import('./components/Hero'));
const Creations = lazy(() => import('./components/Creations'));
const Writings = lazy(() => import('./components/Writings'));
const WritingArticle = lazy(() => import('./components/Writings').then(m => ({ default: m.WritingArticle })));
const About = lazy(() => import('./components/About'));
const Inquire = lazy(() => import('./components/Inquire'));
const Store = lazy(() => import('./components/Store'));
const PiecePage = lazy(() => import('./components/PiecePage'));
const MultidimensionalArt = lazy(() => import('./components/MultidimensionalArt'));
const SubcategoryPage = lazy(() => import('./components/SubcategoryPage'));
const IlluminatedWorks = lazy(() => import('./components/IlluminatedWorks'));
const OracleCards = lazy(() => import('./components/OracleCards'));
const UniversalLanguageIndex = lazy(() => import('./components/UniversalLanguageIndex'));
const UniversalLanguageCard = lazy(() => import('./components/UniversalLanguageCard'));
const OracleGateway = lazy(() => import('./components/OracleGateway'));
const Welcome = lazy(() => import('./components/Welcome'));
const NotFound = lazy(() => import('./components/NotFound'));
const OrderConfirmed = lazy(() => import('./components/OrderConfirmed'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const Terms = lazy(() => import('./components/Terms'));
const FontPreview = lazy(() => import('./components/FontPreview'));
const AdminFileUpload = lazy(() => import('./components/AdminFileUpload'));
const AdminLogin = lazy(() => import('./components/AdminLogin'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const Footer = lazy(() => import('./components/Footer'));
const GenerativeBackground = lazy(() => import('./components/GenerativeBackground'));

import { useSeoMeta } from './useSeoMeta';
import { CartProvider } from './CartContext';
import { DarkModeProvider, useDarkMode } from './DarkModeContext';
import Navigation from './components/Navigation';
import CartDrawer from './components/CartDrawer';
import CookieConsent from './components/CookieConsent';

const AppInner: React.FC = () => {
  const location = useLocation();
  const { isDarkMode } = useDarkMode();

  useEffect(() => {
    if (!location.pathname.startsWith('/keystatic')) {
      document.querySelectorAll('style[data-emotion]').forEach(el => el.remove());
      document.body.style.overflow = '';
    }
  }, [location.pathname]);

  if (location.pathname.startsWith('/keystatic')) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-shrink-0 border-b border-wood-200 bg-white px-6 py-3 flex items-center justify-between z-50">
          <Link to="/admin" className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-800 transition-colors font-semibold flex items-center gap-1.5">
            ← Admin
          </Link>
        </div>
        <div className="flex-1">
          <Suspense fallback={null}>
            <KeystaticRoute />
          </Suspense>
        </div>
      </div>
    );
  }

  useSeoMeta(location.pathname);

  // #2 Global scroll-to-top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const isHome = location.pathname === '/';
  const isWelcome = location.pathname === '/welcome';
  const isAdmin = location.pathname.startsWith('/admin');
  // Only the /oracle gateway is fully immersive — card detail pages use the standard nav
  const isOracleGateway = location.pathname === '/oracle';
  // Footer is hidden on all oracle card routes (bottom nav acts as footer)
  const isOracleCard = /^\/oracle\/universal-language\/\d+$/.test(location.pathname)
    || /^\/universal-language\/\d+$/.test(location.pathname)
    || /^\/creations\/oracle-cards\/universal-language\/\d+$/.test(location.pathname)
    || isOracleGateway;
  // Theme follows the user's dark-mode preference so the nav explicitly matches.
  // Home keeps DARK regardless because the hero is always dark (dark-preserve).
  // GenerativeBackground reads isDarkMode separately for canvas colors.
  const theme = (isHome || isDarkMode) ? 'DARK' : 'LIGHT';

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#262321]" />}>
    <div className="min-h-screen bg-paper-50 text-wood-900 selection:bg-bronze-200 transition-colors duration-500">
      <GenerativeBackground pathname={location.pathname} theme={theme} />
      {!isWelcome && !isOracleGateway && !isAdmin && <Navigation theme={theme} />}

      <main id="main-content">
        <div key={/^\/oracle\/universal-language\/\d+$/.test(location.pathname) ? '/oracle/universal-language/:n' : location.pathname} className="route-fade-in">
          <Routes>
            <Route path="/" element={<><Hero /><Home /></>} />

            {/* Creations — static routes must come before /:id catch-all */}
            <Route path="/creations" element={<Creations />} />
            <Route path="/creations/illuminated-works" element={<IlluminatedWorks />} />
            {/* Oracle gateway — QR code target */}
            <Route path="/oracle" element={<OracleGateway />} />
            <Route path="/oracle/universal-language/:number" element={<UniversalLanguageCard />} />
            <Route path="/oracle/universal-language" element={<UniversalLanguageIndex />} />
            {/* Backwards-compat redirects — old URLs still resolve */}
            <Route path="/universal-language/:number" element={<UniversalLanguageCard />} />
            <Route path="/universal-language" element={<Navigate to="/oracle/universal-language" replace />} />
            <Route path="/creations/oracle-cards/universal-language/:number" element={<UniversalLanguageCard />} />
            <Route path="/creations/oracle-cards/universal-language" element={<Navigate to="/oracle/universal-language" replace />} />
            <Route path="/creations/oracle-cards" element={<Navigate to="/oracle/universal-language" replace />} />
            <Route path="/creations/multidimensional-art" element={<MultidimensionalArt />} />
            <Route path="/creations/multidimensional-art/:subcategory" element={<SubcategoryPage />} />
            <Route path="/creations/:id" element={<PiecePage />} />

            <Route path="/writings" element={<Writings />} />
            <Route path="/writings/:slug" element={<WritingArticle />} />
            <Route path="/about" element={<About />} />
            <Route path="/inquire" element={<Inquire />} />
            <Route path="/shop" element={<Store />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/font-preview" element={<FontPreview />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/files" element={<AdminFileUpload />} />
            <Route path="/order-confirmed" element={<OrderConfirmed />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>

      {!isWelcome && !isOracleCard && !isAdmin && <Footer />}
      <CartDrawer />
      <CookieConsent />
    </div>
    </Suspense>
  );
};

const App: React.FC = () => (
  <DarkModeProvider>
    <CartProvider>
      <AppInner />
    </CartProvider>
  </DarkModeProvider>
);

export default App;

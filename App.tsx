
import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useParams, Link } from 'react-router-dom';

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
const OracleGateway = lazy(() => import('./components/OracleGateway'));
const Welcome = lazy(() => import('./components/Welcome'));
const NotFound = lazy(() => import('./components/NotFound'));
const WorksPage = lazy(() => import('./components/WorksPage'));
const QRIndex = lazy(() => import('./components/QRIndex'));
const OrderConfirmed = lazy(() => import('./components/OrderConfirmed'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const Terms = lazy(() => import('./components/Terms'));
const AdminFileUpload = lazy(() => import('./components/AdminFileUpload'));
const AdminLogin = lazy(() => import('./components/AdminLogin'));
const AdminShell = lazy(() => import('./components/admin/AdminShell'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const AdminInvoices = lazy(() => import('./components/AdminInvoices'));
const AdminPoetry = lazy(() => import('./components/AdminPoetry'));
const AdminBookEditor = lazy(() => import('./components/AdminBookEditor'));
const AdminViewings = lazy(() => import('./components/AdminViewings'));
const AdminPieces = lazy(() => import('./components/AdminPieces'));
const PricingCalculator = lazy(() => import('./components/PricingCalculator'));
const PublicInvoice = lazy(() => import('./components/PublicInvoice'));
const Viewing = lazy(() => import('./components/viewing/Viewing'));
const AccountDashboard = lazy(() => import('./components/AccountDashboard'));
const OrdersList = lazy(() => import('./components/account/OrdersList'));
const CollectionsManager = lazy(() => import('./components/account/CollectionsManager'));
const ResetPassword = lazy(() => import('./components/account/ResetPassword'));
const Footer = lazy(() => import('./components/Footer'));
const GenerativeBackground = lazy(() => import('./components/GenerativeBackground'));
const Poetry = lazy(() => import('./components/Poetry'));
const PoetryTrack = lazy(() => import('./components/PoetryTrack'));

import { useSeoMeta } from './useSeoMeta';
import { LAUNCH_FLAGS } from './launchFlags';
import { CartProvider } from './CartContext';
import { DarkModeProvider, useDarkMode } from './DarkModeContext';
import { PlayerProvider } from './PlayerContext';
import { AccountProvider } from './lib/account/AccountProvider';
import { CollectionsProvider } from './lib/collections/context';
import Navigation from './components/Navigation';
import CartDrawer from './components/CartDrawer';
import MiniPlayer from './components/MiniPlayer';

const AppInner: React.FC = () => {
  const location = useLocation();

  return location.pathname.startsWith('/keystatic')
    ? <KeystaticShell />
    : <SiteShell />;
};

const KeystaticShell: React.FC = () => (
  <div className="flex min-h-screen flex-col bg-paper-50">
    <div className="z-50 flex flex-shrink-0 items-center border-b border-wood-200 bg-paper-50 px-6 py-3">
      <Link
        to="/admin"
        className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-bronze-600 transition-colors hover:text-bronze-800"
      >
        Return to Admin
      </Link>
    </div>
    <div className="flex-1">
      <Suspense fallback={<div className="min-h-[calc(100vh-3.25rem)] bg-paper-50" />}>
        <KeystaticRoute />
      </Suspense>
    </div>
  </div>
);

const SiteShell: React.FC = () => {
  const location = useLocation();
  const { isDarkMode } = useDarkMode();

  useEffect(() => {
    document.querySelectorAll('style[data-emotion]').forEach(el => el.remove());
    document.body.style.overflow = '';
  }, [location.pathname]);

  useSeoMeta(location.pathname);

  // #2 Global scroll-to-top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const isHome = location.pathname === '/';
  const isWelcome = location.pathname === '/welcome';
  const isAdmin = location.pathname.startsWith('/admin');
  const isInvoice = location.pathname.startsWith('/invoice/');
  const isViewing = location.pathname.startsWith('/viewing/');
  const isChromeless = isInvoice || isViewing;
  // Theme follows the user's dark-mode preference so the nav explicitly matches.
  // Home keeps DARK regardless because the hero is always dark (dark-preserve).
  // GenerativeBackground reads isDarkMode separately for canvas colors.
  const theme = (isHome || isDarkMode) ? 'DARK' : 'LIGHT';

  return (
    <Suspense fallback={<div className="min-h-screen bg-wood-900" />}>
    <div className="min-h-screen bg-paper-50 text-wood-900 selection:bg-bronze-200 transition-colors duration-500">
      {!isAdmin && !isChromeless && <GenerativeBackground pathname={location.pathname} theme={theme} />}
      {!isWelcome && !isAdmin && !isChromeless && <Navigation theme={theme} />}

      <main id="main-content">
        <div key={location.pathname} className="route-fade-in">
          <Routes>
            <Route path="/" element={<><Hero /><Home /></>} />

            {/* Creations — static routes must come before /:id catch-all */}
            <Route path="/creations" element={<Creations />} />
            <Route path="/creations/illuminated-works" element={<IlluminatedWorks />} />
            {/* Oracle hub — a directory page that points outward to the
                oracle decks Adrian has made (Universal Language lives at
                mandalacodes.com). The deep oracle reading itself no longer
                lives on this site. */}
            <Route path="/oracle" element={<OracleGateway />} />
            {/* The Universal Language oracle deck moved to mandalacodes.com.
                Old deep links redirect there with the same card number so any
                printed QR codes and backlinks keep working. */}
            <Route path="/oracle/universal-language/:number" element={<UniversalLanguageCardExternalRedirect />} />
            <Route path="/oracle/universal-language" element={<UniversalLanguageIndexExternalRedirect />} />
            <Route path="/oracle/the-systems" element={<UniversalLanguageIndexExternalRedirect />} />
            <Route path="/oracle/profile" element={<UniversalLanguageIndexExternalRedirect />} />
            <Route path="/universal-language/:number" element={<UniversalLanguageCardExternalRedirect />} />
            <Route path="/universal-language" element={<UniversalLanguageIndexExternalRedirect />} />
            <Route path="/creations/oracle-cards/universal-language/:number" element={<UniversalLanguageCardExternalRedirect />} />
            <Route path="/creations/oracle-cards/universal-language" element={<UniversalLanguageIndexExternalRedirect />} />
            <Route path="/creations/oracle-cards" element={<UniversalLanguageIndexExternalRedirect />} />
            <Route path="/creations/multidimensional-art" element={<MultidimensionalArt />} />
            <Route path="/creations/multidimensional-art/:subcategory" element={<SubcategoryPage />} />
            <Route path="/creations/:id" element={<PiecePage />} />

            <Route path="/writings" element={<Writings />} />
            <Route path="/writings/:slug" element={<WritingArticle />} />
            <Route path="/poetry" element={<Poetry />} />
            <Route path="/poetry/:slug" element={<PoetryTrack />} />
            <Route path="/about" element={<About />} />
            <Route path="/inquire" element={<Inquire />} />
            <Route path="/shop" element={LAUNCH_FLAGS.shopEnabled ? <Store /> : <Navigate to="/inquire" replace />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminShell />}>
              <Route index element={<AdminDashboard />} />
              <Route path="files" element={<AdminFileUpload />} />
              <Route path="poetry" element={<AdminPoetry />} />
              <Route path="book" element={<AdminBookEditor />} />
              <Route path="invoices" element={<AdminInvoices />} />
              <Route path="viewings" element={<AdminViewings />} />
              {/* Private registry staging remains reachable to authenticated
                  admins while the public Living Legacy surface is disabled. */}
              <Route path="pieces" element={<AdminPieces />} />
              <Route path="pricing" element={<PricingCalculator />} />
            </Route>
            <Route path="/invoice/:token" element={<PublicInvoice />} />
            <Route path="/works/:id" element={<WorksPage />} />
            <Route path="/qr" element={<QRIndex />} />
            <Route path="/viewing/:token" element={<Viewing />} />
            <Route path="/atlas" element={<AtlasExternalRedirect />} />
            <Route path="/atlas/*" element={<AtlasExternalRedirect />} />
            <Route path="/order-confirmed" element={<OrderConfirmed />} />
            <Route path="/account" element={<AccountDashboard />} />
            <Route path="/account/orders" element={<OrdersList />} />
            <Route path="/account/collections" element={<CollectionsManager />} />
            <Route path="/account/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>

      {!isWelcome && !isAdmin && !isChromeless && <Footer />}
      {!isAdmin && <CartDrawer />}
      {!isAdmin && <MiniPlayer />}
    </div>
    </Suspense>
  );
};

const App: React.FC = () => (
  <AccountProvider>
    <DarkModeProvider>
      <CartProvider>
        <PlayerProvider>
          <CollectionsProvider>
            <AppInner />
          </CollectionsProvider>
        </PlayerProvider>
      </CartProvider>
    </DarkModeProvider>
  </AccountProvider>
);

/** The atlas moved to mandalacodes.com. Anyone hitting an old /atlas* URL
 *  on adrianrasmussen.com is sent across with a hard browser redirect. */
const AtlasExternalRedirect: React.FC = () => {
  useEffect(() => {
    window.location.replace('https://mandalacodes.com/atlas');
  }, []);
  return null;
};

/** The Universal Language oracle deck moved to mandalacodes.com. Old card
 *  deep-links carry their card number across so printed QR codes and any
 *  indexed pages land on the matching card on the new home. */
const UniversalLanguageCardExternalRedirect: React.FC = () => {
  const { number } = useParams<{ number: string }>();
  useEffect(() => {
    const n = number && /^\d+$/.test(number) ? number : '';
    const target = n
      ? `https://mandalacodes.com/oracle/universal-language/${n}`
      : 'https://mandalacodes.com/oracle/universal-language';
    window.location.replace(target);
  }, [number]);
  return null;
};

/** Old non-card oracle URLs (the index, the systems history, the profile,
 *  the legacy back-compat routes) all redirect to the deck's index page on
 *  mandalacodes.com. */
const UniversalLanguageIndexExternalRedirect: React.FC = () => {
  useEffect(() => {
    window.location.replace('https://mandalacodes.com/oracle/universal-language');
  }, []);
  return null;
};

export default App;


import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useParams, useSearchParams, Link } from 'react-router-dom';

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
const CollectorShell = lazy(() => import('./components/collector/CollectorShell'));
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
const ArtworkList = lazy(() => import('./components/admin/ArtworkList'));
const ArtworkWorkspace = lazy(() => import('./components/admin/ArtworkWorkspace'));
const AdminMaintenance = lazy(() => import('./components/AdminMaintenance'));
const AdminPlateWizard = lazy(() => import('./components/AdminPlateWizard'));
const RegisterCeremony = lazy(() => import('./components/registry/RegisterCeremony'));
const AddToPiece = lazy(() => import('./components/registry/AddToPiece'));
const Succession = lazy(() => import('./components/admin/Succession'));
const ScreenDevelopment = lazy(() => import('./components/admin/ScreenDevelopment'));
const ArtworkInvitations = lazy(() => import('./components/admin/ArtworkInvitations'));
const CollectorSales = lazy(() => import('./components/admin/CollectorSales'));
const AtlasPendingSales = lazy(() => import('./components/admin/AtlasPendingSales'));
const CertificateEditor = lazy(() => import('./components/admin/CertificateEditor'));
const PricingCalculator = lazy(() => import('./components/PricingCalculator'));
const Rehearsal = lazy(() => import('./components/admin/Rehearsal'));
const PublicInvoice = lazy(() => import('./components/PublicInvoice'));
const Viewing = lazy(() => import('./components/viewing/Viewing'));
const AccountDashboard = lazy(() => import('./components/AccountDashboard'));
const OrdersList = lazy(() => import('./components/account/OrdersList'));
const CollectionsManager = lazy(() => import('./components/account/CollectionsManager'));
const ContributorAccess = lazy(() => import('./components/account/ContributorAccess'));
const ResetPassword = lazy(() => import('./components/account/ResetPassword'));
const Footer = lazy(() => import('./components/Footer'));
const GenerativeBackground = lazy(() => import('./components/GenerativeBackground'));
const Poetry = lazy(() => import('./components/Poetry'));
const PoetryTrack = lazy(() => import('./components/PoetryTrack'));
const CollectorFieldPage = lazy(() => import('./components/collector/legacy/CollectorFieldPage'));
const AtlasPage = lazy(() => import('./components/AtlasPage'));

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
import { FULL_ARCHIVE } from './data/mockData';

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
  // The collector journey is its own dark room: no site nav, no footer, no
  // generative background. It is drawn for a phone and reviewed at 390 wide.
  const isCollector = location.pathname.startsWith('/collector');
  const isChromeless = isInvoice || isViewing || isCollector;
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
              {/* Static routes before the :artworkId catch-all — order matters. */}
              <Route path="artworks" element={<ArtworkList />} />
              <Route path="artworks/:artworkId" element={<ArtworkWorkspace />} />
              <Route path="artworks/:artworkId/add" element={<AddToPiece />} />
              <Route path="register" element={<RegisterCeremony />} />
              <Route path="succession" element={<Succession />} />
              <Route path="screens" element={<ScreenDevelopment />} />
              {/* The old registration form's address. Verified-sale deep links
                  carry ?artworkId=&artistArtworkRecordId=, so the query string
                  travels with the redirect. */}
              <Route path="registrations" element={<RegistrationsRedirect />} />
              <Route path="invitations" element={<ArtworkInvitations />} />
              <Route path="collector-sales" element={<CollectorSales />} />
              <Route path="atlas-sales" element={<AtlasPendingSales />} />
              <Route path="certificates" element={<CertificateEditor artworks={FULL_ARCHIVE.map(({ id: artworkId, title }) => ({ id: artworkId, title }))} />} />
              <Route path="maintenance" element={<AdminMaintenance />} />
              <Route path="pieces/wizard" element={<AdminPlateWizard />} />
              <Route path="pricing" element={<PricingCalculator />} />
              <Route path="rehearsal" element={<Rehearsal />} />
            </Route>
            <Route path="/invoice/:token" element={<PublicInvoice />} />
            <Route path="/works/:id" element={<WorksPage />} />
            {/* The collector journey, as a look-and-navigation shell. Nothing
                is wired to the registry: this is where the design is reviewed
                before it is folded into /works/:code. */}
            <Route path="/collector" element={<CollectorShell />} />
            <Route path="/qr" element={<QRIndex />} />
            <Route path="/viewing/:token" element={<Viewing />} />
            <Route path="/atlas" element={LAUNCH_FLAGS.livingLegacy ? <CollectorFieldPage /> : <AtlasPage />} />
            {/* Sub-paths keep the old external bounce: there is no local page
                for a deep link here, only for the bare /atlas root above. */}
            <Route path="/atlas/*" element={LAUNCH_FLAGS.livingLegacy ? <CollectorFieldPage /> : <AtlasExternalRedirect />} />
            <Route path="/order-confirmed" element={<OrderConfirmed />} />
            <Route path="/account" element={<AccountDashboard />} />
            <Route path="/account/orders" element={<OrdersList />} />
            <Route path="/account/collections" element={<CollectionsManager />} />
            <Route
              path="/account/contributor-access"
              element={LAUNCH_FLAGS.livingLegacy ? <ContributorAccess /> : <Navigate to="/account" replace />}
            />
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

/** The old registration form lived at /admin/registrations. The ceremony at
 *  /admin/register replaces it; the query string travels so verified-sale
 *  deep links keep working. */
const RegistrationsRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={`/admin/register${location.search}`} replace />;
};

/** The atlas record and globe live on mandalacodes.com; /atlas itself is now
 *  a quiet local page (AtlasPage) instead of bouncing there. This redirect
 *  still handles the /atlas/* sub-paths, which have no local page of their
 *  own to land on. */
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

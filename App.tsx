
import React, { useEffect, Suspense, lazy, useRef, useState } from 'react';
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
const ArtworkWorkspace = lazy(() => import('./components/admin/ArtworkWorkspace'));
const AdminMaintenance = lazy(() => import('./components/AdminMaintenance'));
const AdminPlateWizard = lazy(() => import('./components/AdminPlateWizard'));
const ArtworkInvitations = lazy(() => import('./components/admin/ArtworkInvitations'));
const CollectorSales = lazy(() => import('./components/admin/CollectorSales'));
const CertificateEditor = lazy(() => import('./components/admin/CertificateEditor'));
const PricingCalculator = lazy(() => import('./components/PricingCalculator'));
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
const CollectorFieldPage = lazy(() => import('./components/collector/CollectorFieldPage'));

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
import { loadArtworkWorkspace } from './utils/artworkWorkspace';
import {
  beginArtistSaleAttempt,
  finishArtistSaleAttempt,
  parseArtistSaleDetailResponse,
  parseArtistSaleMutationResponse,
  type FrozenArtistSaleAttempt,
  type LinkArtistSaleIdentityRequest,
} from './utils/artistSales';

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
              <Route path="artworks/:artworkId" element={<ArtworkWorkspace />} />
              <Route path="registrations" element={<AdminArtworkRegistration />} />
              <Route path="invitations" element={<ArtworkInvitations />} />
              <Route path="collector-sales" element={<CollectorSales />} />
              <Route path="certificates" element={<CertificateEditor artworks={FULL_ARCHIVE.map(({ id: artworkId, title }) => ({ id: artworkId, title }))} />} />
              <Route path="maintenance" element={<AdminMaintenance />} />
              <Route path="pieces/wizard" element={<AdminPlateWizard />} />
              <Route path="pricing" element={<PricingCalculator />} />
            </Route>
            <Route path="/invoice/:token" element={<PublicInvoice />} />
            <Route path="/works/:id" element={<WorksPage />} />
            {/* The collector journey, as a look-and-navigation shell. Nothing
                is wired to the registry: this is where the design is reviewed
                before it is folded into /works/:code. */}
            <Route path="/collector" element={<CollectorShell />} />
            <Route path="/qr" element={<QRIndex />} />
            <Route path="/viewing/:token" element={<Viewing />} />
            <Route path="/atlas" element={LAUNCH_FLAGS.livingLegacy ? <CollectorFieldPage /> : <AtlasExternalRedirect />} />
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

function AdminArtworkRegistration() {
  const [searchParams] = useSearchParams();
  const registrationQuery = searchParams.toString();
  const linkedParams = new URLSearchParams(registrationQuery);
  const linkedArtworkIds = linkedParams.getAll('artworkId');
  const linkedRecordIds = linkedParams.getAll('artistArtworkRecordId');
  const linkedKeys = [...linkedParams.keys()].sort().join('\0');
  const linkedArtworkId = linkedArtworkIds.length === 1 ? linkedArtworkIds[0] : '';
  const linkedRecordId = linkedRecordIds.length === 1 ? linkedRecordIds[0] : '';
  const hasLinkedSelector = linkedParams.has('artworkId') || linkedParams.has('artistArtworkRecordId');
  const hasExactLinkedSelector = Boolean(linkedArtworkId && linkedRecordId
    && linkedKeys === 'artistArtworkRecordId\0artworkId');
  const [linkedStatus, setLinkedStatus] = useState<'generic' | 'loading' | 'ready' | 'error'>(
    hasExactLinkedSelector ? 'loading' : hasLinkedSelector ? 'error' : 'generic',
  );
  const [linkedTarget, setLinkedTarget] = useState<{
    saleId: string;
    artworkRecordId: string;
    expectedVersion: number;
  } | null>(null);
  const [relationshipLinked, setRelationshipLinked] = useState(false);
  const [linkPending, setLinkPending] = useState(false);
  const linkAttemptRef = useRef<FrozenArtistSaleAttempt<LinkArtistSaleIdentityRequest> | null>(null);
  const linkedStatusRef = useRef<HTMLDivElement>(null);
  const [artworkId, setArtworkId] = useState(linkedArtworkId || FULL_ARCHIVE[0]?.id || '');
  const [editionKind, setEditionKind] = useState<'' | 'unique' | 'numbered'>('');
  const [editionNumber, setEditionNumber] = useState('1');
  const [editionSize, setEditionSize] = useState('');
  const [secret, setSecret] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    artworkId: string;
    artworkTitle: string;
    editionLabel: string;
    publicCode: string;
    ownershipCode?: string;
    keeperPieceId: string;
  } | null>(null);
  const attemptKey = useRef<string | null>(null);

  useEffect(() => {
    setResult(null);
    setLinkedTarget(null);
    setRelationshipLinked(false);
    setLinkPending(false);
    linkAttemptRef.current = null;
    attemptKey.current = null;
    if (!hasExactLinkedSelector) {
      setLinkedStatus(hasLinkedSelector ? 'error' : 'generic');
      if (hasLinkedSelector) window.requestAnimationFrame(() => linkedStatusRef.current?.focus());
      return;
    }
    const controller = new AbortController();
    setLinkedStatus('loading');
    setArtworkId(linkedArtworkId);
    void loadArtworkWorkspace({
      artworkId: linkedArtworkId,
      artistArtworkRecordId: linkedRecordId,
    }, controller.signal).then(async (workspace) => {
      if (controller.signal.aborted) return;
      const saleId = workspace.sale?.verifiedSaleId;
      if (workspace.catalog?.artworkId !== linkedArtworkId
        || workspace.salesRecord?.artworkRecordId !== linkedRecordId
        || workspace.salesRecord.state !== 'identified'
        || workspace.identity !== null || !saleId) {
        throw new Error('registration_target_mismatch');
      }
      const response = await fetch(`/api/admin/collector-sales/${encodeURIComponent(saleId)}`, {
        cache: 'no-store', signal: controller.signal,
      });
      const value = await response.json().catch(() => null);
      if (!response.ok) throw new Error('registration_target_unavailable');
      const detail = parseArtistSaleDetailResponse(value);
      const item = detail.items.find((candidate) => candidate.artworkRecordId === linkedRecordId);
      if (!item || item.artworkId !== linkedArtworkId || item.identificationStatus !== 'identified'
        || !item.edition || item.keeperPieceId !== null) {
        throw new Error('registration_target_mismatch');
      }
      setEditionKind(item.edition.kind);
      setEditionNumber(item.edition.kind === 'numbered' ? String(item.edition.number) : '1');
      setEditionSize(item.edition.kind === 'numbered' && item.edition.size
        ? String(item.edition.size) : '');
      setLinkedTarget({ saleId, artworkRecordId: linkedRecordId, expectedVersion: item.recordVersion });
      setLinkedStatus('ready');
    }).catch((caught: unknown) => {
      if (controller.signal.aborted
        || (caught instanceof DOMException && caught.name === 'AbortError')) return;
      setLinkedStatus('error');
      window.requestAnimationFrame(() => linkedStatusRef.current?.focus());
    });
    return () => controller.abort();
  }, [registrationQuery]);

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/registry-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      if (!response.ok) throw new Error('unlock_failed');
      setUnlocked(true);
      setSecret('');
    } catch {
      setError('The private registry could not be unlocked.');
    } finally {
      setBusy(false);
    }
  };

  const completeLinkedRegistration = async (keeperPieceId: string): Promise<boolean> => {
    if (!linkedTarget) return true;
    const attempt = beginArtistSaleAttempt(linkAttemptRef.current, {
      action: 'linkIdentity',
      artworkRecordId: linkedTarget.artworkRecordId,
      keeperPieceId,
      expectedVersion: linkedTarget.expectedVersion,
    });
    linkAttemptRef.current = attempt;
    setLinkPending(true);
    try {
      const response = await fetch(`/api/admin/collector-sales/${encodeURIComponent(linkedTarget.saleId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt.request),
      });
      const value = await response.json().catch(() => null);
      if (!response.ok) {
        linkAttemptRef.current = finishArtistSaleAttempt(attempt, { kind: 'http', status: response.status });
        throw Object.assign(new Error('identity_link_failed'), { status: response.status });
      }
      const mutation = parseArtistSaleMutationResponse(value).result;
      if (!('identificationStatus' in mutation)
        || mutation.artworkRecordId !== linkedTarget.artworkRecordId
        || mutation.keeperPieceId !== keeperPieceId
        || mutation.identificationStatus !== 'identity_linked') {
        throw new Error('identity_link_mismatch');
      }
      const completed = await loadArtworkWorkspace({
        artworkId: linkedArtworkId,
        keeperPieceId,
        artistArtworkRecordId: linkedRecordId,
      });
      if (completed.salesRecord?.state !== 'identity_linked'
        || completed.salesRecord.artworkRecordId !== linkedRecordId
        || completed.identity?.keeperPieceId !== keeperPieceId
        || completed.nextAction?.href.includes('/admin/registrations')) {
        throw new Error('identity_link_incomplete');
      }
      linkAttemptRef.current = finishArtistSaleAttempt(attempt, { kind: 'success' });
      setRelationshipLinked(true);
      setError('');
      return true;
    } catch (caught) {
      if (!(caught && typeof caught === 'object' && 'status' in caught)) {
        linkAttemptRef.current = attempt;
      }
      setError('The identity was registered, but its exact sales relationship is not yet confirmed. Retry the same identity link before leaving.');
      return false;
    } finally {
      setLinkPending(false);
    }
  };

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (hasLinkedSelector && linkedStatus !== 'ready') throw new Error('registration_target_unverified');
      if (hasExactLinkedSelector && artworkId !== linkedArtworkId) throw new Error('registration_target_mismatch');
      attemptKey.current ||= crypto.randomUUID();
      if (!editionKind) throw new Error('edition_required');
      const edition = editionKind === 'unique'
        ? { kind: 'unique' as const }
        : {
            kind: 'numbered' as const,
            number: Number(editionNumber),
            size: editionSize ? Number(editionSize) : null,
          };
      const submittedArtwork = FULL_ARCHIVE.find((artwork) => artwork.id === artworkId);
      if (!submittedArtwork) throw new Error('artwork_required');
      const editionLabel = edition.kind === 'unique'
        ? 'Unique work'
        : edition.size
          ? `Number ${edition.number} of ${edition.size}`
          : `Number ${edition.number}`;
      const response = await fetch('/api/admin/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artworkId, edition, idempotencyKey: attemptKey.current }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error('registration_failed');
      setResult({
        artworkId,
        artworkTitle: submittedArtwork.title,
        editionLabel,
        publicCode: body.publicCode,
        ownershipCode: body.ownershipCode,
        keeperPieceId: body.keeperPieceId,
      });
      attemptKey.current = null;
      await completeLinkedRegistration(body.keeperPieceId);
    } catch {
      setError('This artwork could not be registered. The same attempt can be retried safely.');
    } finally {
      setBusy(false);
    }
  };

  const resetRegistration = () => {
    setResult(null);
    setEditionKind('');
    setEditionNumber('1');
    setEditionSize('');
    setError('');
    attemptKey.current = null;
  };

  const copyOwnershipCode = async () => {
    if (!result?.ownershipCode) return;
    try {
      await navigator.clipboard.writeText(result.ownershipCode);
      setResult({ ...result, ownershipCode: undefined });
    } catch {
      setError('The Ownership Code could not be copied. Copy it manually, then dismiss it before leaving this screen.');
    }
  };

  return (
    <div className="admin-page admin-page-narrow">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Collector registry</p>
          <h1 className="admin-page-title">Artwork registration</h1>
          <p className="admin-page-description">
            Create the permanent digital identity first. A physical plate is an optional later step.
          </p>
        </div>
      </header>

      {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
      {linkedStatus === 'loading' && (
        <p className="admin-alert" role="status">Verifying the exact sales record registration target.</p>
      )}
      {linkedStatus === 'error' && (
        <div ref={linkedStatusRef} tabIndex={-1} className="outline-none">
          <p className="admin-alert admin-alert-error" role="alert">The linked catalog artwork and sales record could not be verified. Registration is unavailable from this link.</p>
        </div>
      )}
      {linkedStatus === 'ready' && (
        <p className="admin-alert" role="status">Sales record {linkedRecordId} · exact catalog target {linkedArtworkId}</p>
      )}
      {!unlocked ? (
        <form onSubmit={unlock} className="admin-section space-y-4">
          <h2 className="admin-section-title">Unlock the private registry</h2>
          <label className="block font-label text-xs uppercase tracking-[0.12em] text-wood-700">
            Registry secret
            <input type="password" required value={secret} onChange={(event) => setSecret(event.target.value)} className="mt-2 block w-full border border-wood-300 bg-white p-3 font-sans text-base normal-case tracking-normal" />
          </label>
          <button type="submit" disabled={busy} className="collector-button-primary">{busy ? 'Unlocking' : 'Unlock registry'}</button>
        </form>
      ) : !result && linkedStatus !== 'error' ? (
        <form onSubmit={register} className="admin-section space-y-5">
          <h2 className="admin-section-title">Register one artwork instance</h2>
          <label className="block font-label text-xs uppercase tracking-[0.12em] text-wood-700">
            Artwork
            <select value={artworkId} disabled={linkedStatus === 'loading' || linkedStatus === 'ready'} onChange={(event) => { setArtworkId(event.target.value); setEditionKind(''); attemptKey.current = null; }} className="mt-2 block w-full border border-wood-300 bg-white p-3 font-sans text-base normal-case tracking-normal">
              {FULL_ARCHIVE.map((artwork) => <option key={artwork.id} value={artwork.id}>{artwork.title} · {artwork.id}</option>)}
            </select>
          </label>
          <fieldset className="space-y-3">
            <legend className="font-label text-xs uppercase tracking-[0.12em] text-wood-700">Edition</legend>
            <label className="flex gap-2 font-sans text-sm text-wood-800"><input type="radio" name="edition-kind" disabled={linkedStatus === 'ready'} checked={editionKind === 'unique'} onChange={() => { setEditionKind('unique'); attemptKey.current = null; }} /> Unique work</label>
            <label className="flex gap-2 font-sans text-sm text-wood-800"><input type="radio" name="edition-kind" disabled={linkedStatus === 'ready'} checked={editionKind === 'numbered'} onChange={() => { setEditionKind('numbered'); attemptKey.current = null; }} /> Numbered edition</label>
          </fieldset>
          {editionKind === 'numbered' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="font-label text-xs uppercase tracking-[0.12em] text-wood-700">Number<input type="number" min="1" required disabled={linkedStatus === 'ready'} value={editionNumber} onChange={(event) => { setEditionNumber(event.target.value); attemptKey.current = null; }} className="mt-2 block w-full border border-wood-300 bg-white p-3 font-sans text-base" /></label>
              <label className="font-label text-xs uppercase tracking-[0.12em] text-wood-700">Edition size, optional<input type="number" min={editionNumber || '1'} disabled={linkedStatus === 'ready'} value={editionSize} onChange={(event) => { setEditionSize(event.target.value); attemptKey.current = null; }} className="mt-2 block w-full border border-wood-300 bg-white p-3 font-sans text-base" /></label>
            </div>
          )}
          <button type="submit" disabled={busy || !editionKind || linkedStatus === 'loading'} className="collector-button-primary">{busy ? 'Registering' : 'Register artwork'}</button>
        </form>
      ) : null}

      {result && (
        <section className="admin-section space-y-4" aria-labelledby="registration-created-title">
          <h2 id="registration-created-title" className="admin-section-title">Artwork registered</h2>
          <p className="font-sans text-sm text-wood-700">
            Artwork: <strong>{result.artworkTitle} · {result.artworkId}</strong>
          </p>
          <p className="font-sans text-sm text-wood-700">Edition: <strong>{result.editionLabel}</strong></p>
          <p className="font-sans text-sm text-wood-700">Public code: <strong>{result.publicCode}</strong></p>
          <p className="font-sans text-sm text-wood-700">Invitation reference: <strong>{result.keeperPieceId}</strong></p>
          {linkedTarget && relationshipLinked && (
            <p className="font-sans text-sm text-wood-700" role="status">Sales record linked to {result.keeperPieceId}.</p>
          )}
          {linkedTarget && !relationshipLinked && (
            <div className="admin-alert admin-alert-error" role="alert">
              <p>The exact sales relationship is not confirmed yet.</p>
              <button type="button" disabled={linkPending} className="collector-button-secondary" onClick={() => void completeLinkedRegistration(result.keeperPieceId)}>
                {linkPending ? 'Linking identity' : 'Retry identity link'}
              </button>
            </div>
          )}
          {result.ownershipCode ? (
            <>
              <p className="font-sans text-sm text-wood-700">Copy the Ownership Code now. It cannot be shown here again.</p>
              <p className="font-mono text-lg break-all select-all">{result.ownershipCode}</p>
              <button type="button" className="collector-button-secondary" onClick={() => void copyOwnershipCode()}>Copy Ownership Code</button>
              <button type="button" className="collector-button-secondary" onClick={() => setResult({ ...result, ownershipCode: undefined })}>Dismiss Ownership Code</button>
            </>
          ) : (
            <>
              <p className="font-sans text-sm text-wood-600">The identity is ready. Plate preparation remains optional.</p>
              {(!linkedTarget || relationshipLinked) && (
                <p>
                  <Link
                    className="collector-button-secondary"
                    to={`/admin/artworks/${encodeURIComponent(result.artworkId)}?${new URLSearchParams({
                      instance: result.keeperPieceId,
                      ...(linkedTarget ? { record: linkedTarget.artworkRecordId } : {}),
                    })}`}
                  >
                    Open artwork
                  </Link>
                </p>
              )}
              {linkedStatus === 'generic' && <button type="button" className="collector-button-secondary" onClick={resetRegistration}>Register another artwork</button>}
            </>
          )}
        </section>
      )}
    </div>
  );
}

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

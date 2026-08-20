/**
 * One ceremony DEMO station for the guided walkthrough: mounts the register
 * ceremony (in either its ordinary or held-piece entrance), the "add to this
 * piece" ceremony, or the plate sequence, inside its own tiny router, running
 * entirely against the browser-only demo fetch stub (`demoFetchStub.ts`)
 * instead of the real backend.
 *
 * The demo stub is installed with `useLayoutEffect`, not `useEffect`: React
 * runs every layout effect in the tree before any passive effect runs, so
 * this parent's stub is in place before RegisterCeremony's or AddToPiece's
 * own mount-time `fetch` calls (both plain `useEffect`s) ever fire. It is
 * uninstalled the same way, on unmount, restoring the real `window.fetch`.
 *
 * RegisterCeremony and AddToPiece already draw their own centered 390px
 * ceremony frame (see each component's return statement), so this station
 * wraps them in a plain, unstyled div rather than framing them again. The
 * plate sequence below is purpose-made rather than a real screen (see its
 * own comment), so it draws that same frame itself.
 *
 * The register surface is mounted for two different chapters: the ordinary
 * register ceremony, and "a piece already in someone's hands." Both are the
 * exact same RegisterCeremony component; held mode needs no prop and no URL
 * param, it is reached purely by clicking the threshold's own foot link
 * ("A piece already in someone's hands"), same as the real ceremony.
 */

import React, { useEffect, useLayoutEffect, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installCeremonyDemoStub, DEMO_ARTWORK_ID as DEMO_PLATE_ARTWORK_ID, DEMO_EDITION_NUMBER, DEMO_OWNERSHIP_CODE, DEMO_PUBLIC_CODE } from './demoFetchStub';
import RegisterCeremony from '../registry/RegisterCeremony';
import AddToPiece from '../registry/AddToPiece';
import { CeremonyStyles } from '../ceremony/styles';
import { Body, Brass, C, Eyebrow, Foot, Ground, Head, Ledger, Note, Spacer } from '../registry/kit';
import { buildArtworkPlatePackage, type ArtworkPlatePackage } from '../../utils/artworkPlate';

export type CeremonySurface = 'register' | 'addtopiece' | 'plate';

const DEMO_ARTWORK_ID = 'UL-100';

/** Unwritten copy, marked exactly like the rest of the ceremony kit: the
 *  class and title are the kit's own hooks (`components/ceremony/styles.tsx`),
 *  applied by hand here because the plate sequence is not built from
 *  `createCeremonyUI`'s automatic `Flag`, whose placeholder table belongs to
 *  the collector journey alone. */
const Ph: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="collector-ph" title="Placeholder. Not Adrian's words yet.">
    {children}
  </span>
);

const PLATE_STEPS = ['front', 'underside', 'closing'] as const;
type PlateStep = (typeof PLATE_STEPS)[number];

/**
 * "Preparing the plate": a purpose-made quiet station sequence, not the real
 * AdminPlateWizard. That wizard's fabricate stage lives inside a full admin
 * desk (its own `AdminPage` chrome, a registered-piece list fetched from
 * `/api/admin/pieces`, its own separate registry-unlock fetch) styled in the
 * site's paper/wood/stone/bronze Tailwind palette, not the 390px espresso
 * ceremony card every other chapter in this walkthrough wears, so mounting
 * it here would not look or feel like the rest of the walk. Instead this
 * builds the REAL two plate faces with the real generator
 * (`utils/artworkPlate.ts`), from this demo's own register-ceremony codes
 * (`AR-DEM45678` and its Ownership Code), and walks them as three stations
 * dressed in the same kit as every other ceremony screen.
 */
const PlateStation: React.FC<{ onStepChange?: (step: string) => void }> = ({ onStepChange }) => {
  const [pkg, setPkg] = useState<ArtworkPlatePackage | null>(null);
  const [buildError, setBuildError] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const step: PlateStep = PLATE_STEPS[stepIndex];

  useEffect(() => {
    let cancelled = false;
    buildArtworkPlatePackage({
      publicCode: DEMO_PUBLIC_CODE,
      ownershipCode: DEMO_OWNERSHIP_CODE,
      artworkId: DEMO_PLATE_ARTWORK_ID,
      editionNumber: DEMO_EDITION_NUMBER,
      generatedAt: new Date().toISOString(),
    })
      .then(built => { if (!cancelled) setPkg(built); })
      .catch(() => { if (!cancelled) setBuildError('The plate could not be built in this demo.'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (pkg) onStepChange?.(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pkg]);

  const advance = () => setStepIndex(i => Math.min(i + 1, PLATE_STEPS.length - 1));

  let screen: React.ReactNode;

  if (buildError) {
    screen = (
      <Ground light="e">
        <Eyebrow>Preparing the plate</Eyebrow>
        <div style={{ position: 'relative', paddingTop: 14 }}><Head>The plate could not be built.</Head></div>
        <Note top={14}>{buildError}</Note>
      </Ground>
    );
  } else if (!pkg) {
    screen = (
      <Ground light="e" wash>
        <Eyebrow>Preparing the plate</Eyebrow>
        <div style={{ position: 'relative', paddingTop: 14 }}><Head>Building the plate.</Head></div>
        <Note top={14}>Generating the front and the underside from this piece’s two codes.</Note>
      </Ground>
    );
  } else if (step === 'front') {
    screen = (
      <Ground light="c" pad="40px 30px 26px">
        <Eyebrow>The front</Eyebrow>
        <div style={{ position: 'relative', paddingTop: 14 }}>
          <Head><Ph>The QR the world scans.</Ph></Head>
        </div>
        <Body top={16}>
          <Ph>Etched onto the piece itself. Anyone who scans it reaches the piece’s public record, never the registry.</Ph>
        </Body>
        <div
          style={{ position: 'relative', marginTop: 20, background: '#fff', borderRadius: 10, padding: 14 }}
          // The real generator's own output (utils/artworkPlate.ts), not invented markup.
          dangerouslySetInnerHTML={{ __html: pkg.frontSvg }}
        />
        <Note top={12}>{pkg.publicCode} · {pkg.publicUrl}</Note>
        <Spacer />
        <Foot>
          <Brass onClick={advance}>Continue</Brass>
        </Foot>
      </Ground>
    );
  } else if (step === 'underside') {
    screen = (
      <Ground light="d" pad="40px 30px 26px">
        <Eyebrow>The underside</Eyebrow>
        <div style={{ position: 'relative', paddingTop: 14 }}>
          <Head><Ph>The code only its caretaker sees.</Ph></Head>
        </div>
        <Body top={16}>
          <Ph>Engraved where a stranger holding the piece never looks. This is the Ownership Code, the same one shown once at registration.</Ph>
        </Body>
        <div
          style={{ position: 'relative', marginTop: 20, background: '#fff', borderRadius: 10, padding: 14 }}
          dangerouslySetInnerHTML={{ __html: pkg.undersideSvg }}
        />
        <Spacer />
        <Foot>
          <Brass onClick={advance}>Continue</Brass>
        </Foot>
      </Ground>
    );
  } else {
    screen = (
      <Ground light="k" pad="44px 30px 26px">
        <Eyebrow tone={C.brass}>Preparing the plate</Eyebrow>
        <div style={{ position: 'relative', paddingTop: 12 }}>
          <Head size={30}><Ph>What travels where.</Ph></Head>
        </div>
        <div style={{ position: 'relative', paddingTop: 16 }}>
          <Ledger label="To the fabricator" value="Front SVG · underside SVG" />
          <Ledger label="Stays in the registry" value="The private manifest" warm />
        </div>
        <Note top={16}>
          <Ph>The manifest carries the Ownership Code and both file hashes. Sending it out would hand a stranger the piece’s secret; the fabricator only ever needs what is etched onto the metal.</Ph>
        </Note>
      </Ground>
    );
  }

  return (
    <div className="collector-root" data-marks="0" style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 44px' }}>
      <CeremonyStyles />
      <div
        style={{
          position: 'relative',
          width: 390,
          maxWidth: '100%',
          height: 'min(780px, max(640px, calc(100vh - 150px)))',
          borderRadius: 24,
          overflow: 'hidden',
          background: C.ground,
          border: `1px solid ${C.hairStrong}`,
          boxShadow: '0 32px 64px -24px rgba(0,0,0,.55)',
        }}
      >
        {screen}
      </div>
    </div>
  );
};

const CeremonyStation: React.FC<{
  surface: CeremonySurface;
  onStepChange?: (step: string) => void;
}> = ({ surface, onStepChange }) => {
  useLayoutEffect(() => {
    const uninstall = installCeremonyDemoStub();
    return uninstall;
  }, []);

  if (surface === 'plate') {
    return <PlateStation onStepChange={onStepChange} />;
  }

  return (
    <div>
      {surface === 'register' ? (
        <MemoryRouter initialEntries={['/admin/register']}>
          <Routes>
            <Route path="/admin/register" element={<RegisterCeremony onStepChange={onStepChange} />} />
          </Routes>
        </MemoryRouter>
      ) : (
        <MemoryRouter initialEntries={[`/admin/artworks/${DEMO_ARTWORK_ID}/add`]}>
          <Routes>
            <Route path="/admin/artworks/:artworkId/add" element={<AddToPiece onStepChange={onStepChange} />} />
          </Routes>
        </MemoryRouter>
      )}
    </div>
  );
};

export default CeremonyStation;

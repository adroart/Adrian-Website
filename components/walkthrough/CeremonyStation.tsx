/**
 * One ceremony DEMO station for the guided walkthrough: mounts either the
 * register ceremony or the "add to this piece" ceremony inside its own tiny
 * router, running entirely against the browser-only demo fetch stub
 * (`demoFetchStub.ts`) instead of the real backend.
 *
 * The demo stub is installed with `useLayoutEffect`, not `useEffect`: React
 * runs every layout effect in the tree before any passive effect runs, so
 * this parent's stub is in place before RegisterCeremony's or AddToPiece's
 * own mount-time `fetch` calls (both plain `useEffect`s) ever fire. It is
 * uninstalled the same way, on unmount, restoring the real `window.fetch`.
 *
 * RegisterCeremony and AddToPiece already draw their own centered 390px
 * ceremony frame (see each component's return statement), so this station
 * wraps them in a plain, unstyled div rather than framing them again.
 */

import React, { useLayoutEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installCeremonyDemoStub } from './demoFetchStub';
import RegisterCeremony from '../registry/RegisterCeremony';
import AddToPiece from '../registry/AddToPiece';

export type CeremonySurface = 'register' | 'addtopiece';

const DEMO_ARTWORK_ID = 'UL-100';

const CeremonyStation: React.FC<{
  surface: CeremonySurface;
  onStepChange?: (step: string) => void;
}> = ({ surface, onStepChange }) => {
  useLayoutEffect(() => {
    const uninstall = installCeremonyDemoStub();
    return uninstall;
  }, []);

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

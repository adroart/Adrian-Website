/**
 * Entry point for the standalone, single file prototype of the collector
 * journey. By default it mounts the guided walkthrough rail around the same
 * CollectorShell the site serves at /collector; `?chrome=full` in the URL
 * mounts the plain review shell instead, with no router and no site chrome,
 * so the whole flow can still be walked screen by screen from one file that
 * opens anywhere.
 *
 * Built by `scripts/build-collector-prototype.mjs`. Not part of the site build.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/cormorant-garamond/latin-300.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/lora/latin-400.css';
import '@fontsource/karla/latin-400.css';
import '@fontsource/karla/latin-700.css';

import CollectorShell from '../../components/collector/CollectorShell';
import Walkthrough from '../../components/walkthrough/Walkthrough';

const useFullChrome = new URLSearchParams(window.location.search).get('chrome') === 'full';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {useFullChrome ? <CollectorShell /> : <Walkthrough />}
  </React.StrictMode>,
);

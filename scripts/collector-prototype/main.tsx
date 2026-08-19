/**
 * Entry point for the standalone, single file prototype of the collector
 * journey. It mounts the same CollectorShell the site serves at /collector,
 * with no router and no site chrome, so the whole flow can be walked from one
 * file that opens anywhere.
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

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CollectorShell />
  </React.StrictMode>,
);

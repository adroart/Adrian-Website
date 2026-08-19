/**
 * The collector surface's stylesheet: the ceremony kit's stylesheet, in the
 * espresso theme. Kept out of `src/index.css` so this room never leaks into
 * the public site; the rules themselves live in
 * `components/ceremony/styles.tsx` so the artist-side registration ceremony
 * shares them.
 */

import React from 'react';
import { espresso } from '../ceremony/tokens';
import { CeremonyStyles } from '../ceremony/styles';

export const CollectorStyles: React.FC = () => <CeremonyStyles theme={espresso} />;

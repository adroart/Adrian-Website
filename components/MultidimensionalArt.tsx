import React from 'react';
import { Link } from 'react-router-dom';
import { LAUNCH_FLAGS } from '../launchFlags';
import Breadcrumb from './Breadcrumb';
import PricingExplorer from './pricing/PricingExplorer';
import { SeriesEntrances } from './gallery/GalleryDisplay';

const MultidimensionalArt: React.FC = () => (
    <section className="public-gallery min-h-screen">
        <div className="gallery-width">
            <Breadcrumb className="gallery-crumb" crumbs={[
                { label: 'Creations', to: '/creations' },
                { label: 'Multidimensional Art' },
            ]} />
            <h1 className="gallery-title">Multidimensional Art</h1>
            <p className="gallery-intro">
                Layered sculpture in wood, crystal, and light. Works that hold geometry, symbol, and presence in the same form.
            </p>
            <section className="gallery-band" aria-labelledby="sculpture-series">
                <div className="gallery-band-heading">
                    <h2 id="sculpture-series" className="gallery-subtitle">Bodies of work</h2>
                    <Link to="/creations?category=Multidimensional+Art" className="gallery-action">Browse all sculpture</Link>
                </div>
                <SeriesEntrances />
            </section>
            <section className="gallery-band">
                <div className="gallery-band-heading">
                    <h2 className="gallery-subtitle">Illuminated Works</h2>
                    <Link to="/creations/illuminated-works" className="gallery-action">See the work in light</Link>
                </div>
                <p className="gallery-note">See how light travels through the layers of the wood.</p>
            </section>
            {LAUNCH_FLAGS.pricingExplorer && (
                <div className="gallery-band"><PricingExplorer /></div>
            )}
        </div>
    </section>
);

export default MultidimensionalArt;

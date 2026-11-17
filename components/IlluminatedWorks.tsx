import React from 'react';
import { Link } from 'react-router-dom';
import { FULL_ARCHIVE } from '../data/mockData';
import Breadcrumb from './Breadcrumb';
import GalleryTileCard from './GalleryTileCard';
import { illuminatedFilm } from './gallery/galleryContent';
import './gallery/publicGallery.css';

const illuminatedPieces = FULL_ARCHIVE.filter(art => art.illuminated);

const IlluminatedWorks: React.FC = () => (
    <article className="public-gallery min-h-screen">
        <div className="gallery-width">
            <Breadcrumb className="gallery-crumb" crumbs={[
                { label: 'Creations', to: '/creations' },
                { label: 'Illuminated Works' },
            ]} />
            <div className="gallery-hero gallery-hero-film">
                <div>
                    <h1 className="gallery-title">Illuminated Works</h1>
                    <p className="gallery-intro">
                        Light travels through the depths of layered wood. It finds the edges and reveals the piece in a different way after dark.
                    </p>
                    <div className="gallery-actions">
                        <Link to="/inquire" className="gallery-action gallery-action-primary">Ask about illumination</Link>
                    </div>
                </div>
                <figure className="gallery-film">
                    <video
                        src={illuminatedFilm.src}
                        poster={illuminatedFilm.poster}
                        controls
                        playsInline
                        preload="metadata"
                        aria-label="Layered wood sculpture changing color under programmed light"
                    />
                    <figcaption>A layered wood sculpture in programmed light.</figcaption>
                </figure>
            </div>

            <section className="gallery-band" aria-labelledby="illumination-options">
                <div className="gallery-band-heading">
                    <h2 id="illumination-options" className="gallery-subtitle">Two expressions of light</h2>
                </div>
                <div className="gallery-lighting-options">
                    <div>
                        <h3 className="font-display text-3xl">Basic Illumination</h3>
                        <p className="gallery-intro">Standard LED strips with preset modes. The piece glows and shifts between colors.</p>
                    </div>
                    <div>
                        <h3 className="font-display text-3xl">Curated Light</h3>
                        <p className="gallery-intro">Color, transitions, and rhythms programmed by hand for the piece and the room.</p>
                    </div>
                </div>
            </section>

            {illuminatedPieces.length > 0 && (
                <section className="gallery-band">
                    <div className="gallery-band-heading"><h2 className="gallery-subtitle">From the collection</h2></div>
                    <div className="gallery-grid">{illuminatedPieces.map(art => <GalleryTileCard key={art.id} art={art} />)}</div>
                </section>
            )}

            <section className="gallery-band">
                <h2 className="gallery-subtitle">Begin with a conversation</h2>
                <p className="gallery-intro">If you have a piece in mind, get in touch to explore the light and the space it will live in.</p>
                <div className="gallery-actions">
                    <Link to="/inquire" className="gallery-action">Inquire</Link>
                    <Link to="/creations/multidimensional-art" className="gallery-action">Browse multidimensional art</Link>
                </div>
            </section>
        </div>
    </article>
);

export default IlluminatedWorks;

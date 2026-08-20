import type { Artwork } from '../../../types';
import type { PublicPlateIdentity } from '../../../utils/publicRegistry';
import { img as cldImg } from '../../../utils/cloudinary';
import { ulAltText, ulCardNumber } from '../../../utils/universalLanguage';

export default function ArrivalScreen({
  artwork,
  identity,
  headingLevel = 1,
}: {
  artwork: Artwork;
  identity?: PublicPlateIdentity | null;
  headingLevel?: 1 | 2;
}) {
  const imageUrl = artwork.coverImage ? cldImg(artwork.coverImage, { w: 900 }) : null;
  const title = identity?.title || artwork.title;
  const artistName = identity?.artistName || 'Adrian Rasmussen';
  const imageAlt = artwork.series === 'Universal Language'
    ? ulAltText(artwork, ulCardNumber(artwork.coverImage))
    : title;

  return (
    <section className="collector-arrival" data-testid="collector-arrival" aria-labelledby="collector-arrival-title">
      <div className="collector-arrival-inner">
        <p className="collector-eyebrow">{artistName}</p>
        {imageUrl && <img src={imageUrl} alt={imageAlt} className="collector-arrival-image" loading="eager" />}
        {headingLevel === 1 ? (
          <h1 id="collector-arrival-title" className="collector-arrival-title">{title}</h1>
        ) : (
          <h2 id="collector-arrival-title" className="collector-arrival-title">{title}</h2>
        )}
        {artwork.description && <p className="collector-arrival-story">{artwork.longDescription || artwork.description}</p>}
        {identity && (
          <p className="collector-arrival-record">
            Registered artwork record · {identity.edition.label} · {identity.publicCode}
          </p>
        )}
      </div>
    </section>
  );
}

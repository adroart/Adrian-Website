import { FULL_ARCHIVE } from '../../data/mockData';

const basePath = '/creations/multidimensional-art';
export const artworkSeries = [
    { title: 'Universal Language', path: `${basePath}/universal-language`, description: 'Sixty-four works in layered wood.', leadId: 'UL-100' },
    { title: 'Mandala', path: `${basePath}/mandala`, description: 'Hand-painted studies in sacred geometry.', leadId: 'MAN-004' },
    { title: 'Light Codes', path: `${basePath}/light-codes`, description: 'Frequency Foundations, Embodied Vibrations, and Resonant Formations.', leadId: 'LC-103' },
    { title: 'Signature Pieces', path: `${basePath}/signature-pieces`, description: 'Individual works in layered wood and mixed media.', leadId: 'SIG-107' },
];

export function artworkById(id: string) {
    return FULL_ARCHIVE.find(art => art.id === id);
}

export const illuminatedFilm = {
    src: '/media/video/technicianofthesacred_-_Bc27Krhn7j__kwimjc.mp4',
    poster: '/media/image/video-posters/technicianofthesacred_-_Bc27Krhn7j__kwimjc',
};

const whiteMandalaPhotos = [
    'green-gold', 'blue-gold', 'red-gold', 'blue-sun', 'blue-white', 'blue-pink-white',
    'boundless-flower-blue-purple', 'boundless-flower-green-gold', 'brown-gold',
    'circle-of-existance-bloom', 'circle-of-existance-blue', 'circle-of-existance-remix-orange',
    'emergence-metatrons-cube-brown', 'emergence-metatrons-cube-red', 'emergence-metatrons-cube-remix',
    'endless-bloom-remix', 'golden-harmony-gold-brass', 'green', 'green-blue-gold',
    'heart-centered-remix-star', 'infinite-zoom', 'metatron-flower-black',
    'midnight-sunrise-black-gold', 'midnight-sunrise-remix', 'night-fly', 'red',
    'resequence-blue-purple', 'secret-garden', 'seed-of-life-bloom-blue', 'seed-of-life-bloom-orange',
    'sol-urchin-blue', 'sol-urchin-green', 'sol-urchin-green-blue', 'sol-urchin-purple-gold',
    'sol-urchin-red-gold', 'sol-urchin-remix-metatrons-cube', 'star-sun-red',
    'starburst-green', 'starburst-red', 'unfolding-green-blue',
];

const whiteLotusPhotos = [
    'brown-leaf', 'autumn-bloom', 'beyond-lumber', 'campfire', 'cherry', 'cherry-x',
    'classic', 'daylight', 'fall-days', 'forest-fauna', 'inner-bloom', 'mahogany-dream',
    'midnight-fall', 'regenerative-forest', 'sondari-days', 'still-night', 'summer-harvest',
    'tan-light-tan', 'time-glimpse', 'wood-cabin', 'wooden-trail',
];

// Verified opaque white photo backgrounds. Key by photo, never by series or artwork ID,
// so a later cover replacement does not inherit the treatment automatically.
const whiteBackdropPhotos = new Set([
    ...whiteMandalaPhotos.map(slug => `adrian-website/creations/mandala/${slug}`),
    ...whiteLotusPhotos.map(slug => `adrian-website/creations/objects/lotus-stand-${slug}`),
    'adrian-website/creations/signature-pieces/creation-unfolding',
    'adrian-website/creations/signature-pieces/winged-spirit-wood',
    'adrian-website/creations/uncategorized/rise-of-the-buffalo',
]);

export function hasWhitePhotoBackdrop(publicId: string): boolean {
    return whiteBackdropPhotos.has(publicId);
}

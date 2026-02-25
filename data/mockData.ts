
import { Artwork, AvailabilityStatus, Collection, Product, Story } from '../types';

// --- MADE-TO-ORDER ADD-ON PRICING ---
// All prices are [DUMMY] placeholders. Replace before going live.
// Each add-on has its own Stripe Product / Price ID.

export const MADE_TO_ORDER_ADD_ONS = {
  crystals: {
    id: 'crystals',
    label: 'Add crystals',
    price: 150, // [DUMMY]
    stripePriceId: 'price_crystals_REPLACE_WITH_REAL_ID',
  },
  woodFrame: {
    id: 'woodFrame',
    label: 'Add wood frame',
    price: 200, // [DUMMY]
    stripePriceId: 'price_wood_frame_REPLACE_WITH_REAL_ID',
  },
  illumination: {
    medium: {
      id: 'illumination_medium',
      label: 'Illuminate this piece',
      price: 350, // [DUMMY] — sizes 12–24"
      stripePriceId: 'price_illum_medium_REPLACE_WITH_REAL_ID',
    },
    large: {
      id: 'illumination_large',
      label: 'Illuminate this piece',
      price: 500, // [DUMMY] — sizes 24–36"
      stripePriceId: 'price_illum_large_REPLACE_WITH_REAL_ID',
    },
    major: {
      id: 'illumination_major',
      label: 'Illuminate this piece',
      price: 750, // [DUMMY] — sizes 36"+
      stripePriceId: 'price_illum_major_REPLACE_WITH_REAL_ID',
    },
  },
  customFrame: {
    id: 'customFrame',
    label: 'Custom laser cut frame',
    price: 400, // [DUMMY]
    stripePriceId: 'price_custom_frame_REPLACE_WITH_REAL_ID',
  },
} as const;

// --- CONSTANTS FROM MASTER DOC ---

export const SERIES_LIST = [
    'Universal Language',
    'Mandala',
    'Light Codes'
];

// Top-level Creations landing tiles. Categories with a `link` navigate to their own page
// rather than filtering the archive inline.
export const CREATION_CATEGORIES = [
    { id: 'MULTI',   label: 'Multidimensional Art', desc: 'Windows into the infinite',                                            link: '/creations/multidimensional-art' },
    { id: 'ILLUM',   label: 'Illuminated Works',    desc: 'Art that lives differently after dark',                                link: '/creations/illuminated-works' },
    { id: 'JEWELRY', label: 'Jewelry',              desc: 'Wearable pieces and talismans' },
    { id: 'ORACLE',  label: 'Oracle Cards',         desc: 'Tools for reflection',                                            link: '/creations/oracle-cards' },
    { id: 'TABLES',  label: 'Tables',               desc: 'Functional art for gathering' },
    { id: 'INSTALL', label: 'Installations',        desc: 'Immersive environments' },
    { id: 'OBJECTS', label: 'Objects',              desc: 'Functional objects for the altar, the table, the everyday ritual' },
    { id: 'SPACES',  label: 'Spaces',               desc: 'Tea houses and environments designed for presence' },
];

// Subcategory tiles shown on the Multidimensional Art hub page.
// The Illuminated Works entry links back to the shared experiential page.
export const MULTIDIMENSIONAL_CATEGORIES = [
    { id: 'MD-UL',    label: 'Universal Language', desc: 'Sixty-four works. Each connected to a hexagram from the I Ching and a corresponding Gene Key.',       slug: 'universal-language' },
    { id: 'MD-MAN',   label: 'Mandala',            desc: 'Sacred geometry forms. Maps of the inner and outer cosmos.',                                           slug: 'mandala' },
    { id: 'MD-LC',    label: 'Light Codes',        desc: 'Approximately forty works across three subcategories: Frequency Foundations, Embodied Vibrations, Resonant Formations.', slug: 'light-codes' },
    { id: 'MD-SIG',   label: 'Signature Pieces',   desc: 'Works outside any series. An animal. A scene. A world compressed into layers of wood and light.',      slug: 'signature-pieces' },
    { id: 'MD-ILLUM', label: 'Illuminated Works',  desc: 'A second door into the same destination.',                                                             link: '/creations/illuminated-works' },
];

export const LIGHT_CODE_SUBCATEGORIES = [
    'Frequency Foundations',
    'Embodied Vibrations',
    'Resonant Formations',
];

export const STORE_CATEGORIES = [
    'Multidimensional Art',
    'Jewelry',
    'Oracle Cards',
    'Objects',
];

export const SERIES_DATA = [
    {
        id: 'series-1',
        name: 'Universal Language',
        description: 'Exploring the geometry of silence.',
        hook: 'There is a language that all of us know. Elemental. Genetic. Interstellar. Patterns that navigate the experience of life through the passage of time. It existed before the I Ching, Gene Keys, or astrology gave it a name. Felt through the diverse experiences of being human. Perceived through a 64-fold cycle of change. These creations are my way of cultivating a relationship to that cycle. Pay close attention to which ones call out to you. When one speaks, there is a reason waiting in the oracle.',
        essaySlug: 'the-universal-language',
        pieceCount: '64 works',
        image: 'https://picsum.photos/1200/800?random=s1'
    },
    {
        id: 'series-2',
        name: 'Light Codes',
        description: 'Frequencies anchored in matter.',
        hook: 'After a vivid dream where I spoke a light language and sat in the high council of Ithaca, I awoke with a new style of art. These are anchorings of unseen realms.',
        essaySlug: 'light-codes',
        pieceCount: 'Approximately 40 works',
        image: 'https://picsum.photos/1200/800?random=s2'
    },
    {
        id: 'series-3',
        name: 'Mandala',
        description: 'Maps of the inner and outer cosmos.',
        hook: 'A mandala is not something to look at. It is a place to enter. Laser-cut geometry aligned with universal ratios. Each one painted by hand. No two the same. Windows inward, to glimpse the infinite.',
        essaySlug: 'the-mandala-series',
        pieceCount: null,
        image: 'https://picsum.photos/1200/800?random=s3'
    }
];

// --- ARTWORK GENERATION ---

export const FULL_ARCHIVE: Artwork[] = [
    {
        id: 'UL-001',
        title: 'Gate of Stillness',
        category: 'Multidimensional Art',
        series: 'Universal Language',
        coverImage: 'https://picsum.photos/1000/1000?random=1',
        images: ['https://picsum.photos/1000/1000?random=1a', 'https://picsum.photos/1000/1000?random=1b'],
        description: 'A study in concentric resonance. The layers build inward, guiding the eye to a center that holds silence.',
        year: '2023',
        dimensions: '24" Diameter',
        material: 'Birch, Acrylic, Gold Leaf',
        finish: 'Gold Leaf',
        availability: 'READY_TO_SHIP',
        price: 950,   // lowest variant price for range display
        edition: 'Edition of 10',
        editionSize: 10,
        editionSold: 3,
        featured: true,
        relatedStorySlug: 'beneath-surface-mandala',
        sizeVariants: [
            { size: '18"', price: 950, stripePriceId: 'price_UL001_18_REPLACE_WITH_REAL_ID', availability: 'MADE_TO_ORDER' },
            { size: '24"', price: 1850, stripePriceId: 'price_1T2uiNKY1VOkG4eGYcTkmWE3', availability: 'IN_STOCK', editionNumber: 4 },
            { size: '36"', price: 2800, stripePriceId: 'price_UL001_36_REPLACE_WITH_REAL_ID', availability: 'MADE_TO_ORDER' },
        ],
    },
    {
        id: 'LC-042',
        title: 'Ancestral Signal',
        category: 'Multidimensional Art',
        series: 'Light Codes',
        coverImage: 'https://picsum.photos/800/1200?random=2',
        images: ['https://picsum.photos/800/1200?random=2a'],
        description: 'Anchoring unseen realms. Energy flowing effortlessly in a stream of consciousness.',
        year: '2024',
        dimensions: '18" x 36"',
        material: 'Laser Etched Basswood',
        finish: 'Natural',
        subcategory: 'Frequency Foundations',
        availability: 'MADE_TO_ORDER',
        price: 950, // [DUMMY] — lowest size price, used for "From $X" displays
        edition: 'Open Edition',
        featured: true,
        sizeVariants: [
            { size: '18"', price: 950, stripePriceId: 'price_LC042_18_REPLACE_WITH_REAL_ID', availability: 'MADE_TO_ORDER' },  // [DUMMY]
            { size: '24"', price: 1200, stripePriceId: 'price_LC042_24_REPLACE_WITH_REAL_ID', availability: 'MADE_TO_ORDER' }, // [DUMMY]
            { size: '36"', price: 1800, stripePriceId: 'price_LC042_36_REPLACE_WITH_REAL_ID', availability: 'MADE_TO_ORDER' }, // [DUMMY]
        ],
    },
    {
        id: 'JW-005',
        title: 'Resonance Pendant',
        category: 'Jewelry',
        coverImage: 'https://picsum.photos/800/800?random=3',
        images: ['https://picsum.photos/800/800?random=3a'],
        description: 'Wearable geometry. Oxidized brass that warms to the body temperature almost instantly.',
        year: '2024',
        dimensions: '2" Pendant',
        material: 'Oxidized Brass',
        availability: 'READY_TO_SHIP',
        price: 220,
        edition: 'Limited Run',
        featured: false,
        stripePriceId: 'price_JW005_REPLACE_WITH_REAL_ID',
    },
    {
        id: 'TBL-001',
        title: 'Tea Altar Table',
        category: 'Tables',
        coverImage: 'https://picsum.photos/1200/800?random=4',
        images: ['https://picsum.photos/1200/800?random=4a'],
        description: 'Functional art for gathering. Designed for the tea practice explored at Teajia.',
        year: '2022',
        dimensions: '48" x 24" x 18"',
        material: 'Black Walnut, Resin',
        availability: 'SOLD',
        featured: true,
    },
    {
        id: 'INST-003',
        title: 'The Void Structure',
        category: 'Installations',
        coverImage: 'https://picsum.photos/1600/900?random=5',
        images: [],
        description: 'Immersive environment created for the Arise Music Festival. 150-foot stage design.',
        year: '2019',
        dimensions: '150ft Wide',
        material: 'Mixed Media, Projection',
        availability: 'SOLD',
        featured: true,
    },
    {
        id: 'UL-009',
        title: 'Phi Density',
        category: 'Multidimensional Art',
        series: 'Universal Language',
        coverImage: 'https://picsum.photos/1000/1000?random=6',
        images: [],
        description: 'Original airbrushed painting on a multidimensional form. The geometry is exact, the painting is organic.',
        year: '2023',
        dimensions: '36" Diameter',
        material: 'Plywood, Crystals, Airbrush',
        finish: 'Painted',
        availability: 'MADE_TO_ORDER',
        price: 1200, // [DUMMY] — lowest size price, used for "From $X" displays
        edition: 'Edition of 5',
        editionSize: 5,
        editionSold: 3,
        featured: true,
        sizeVariants: [
            { size: '24"', price: 1200, stripePriceId: 'price_UL009_24_REPLACE_WITH_REAL_ID', availability: 'MADE_TO_ORDER' }, // [DUMMY]
            { size: '36"', price: 2800, stripePriceId: 'price_UL009_36_REPLACE_WITH_REAL_ID', availability: 'MADE_TO_ORDER' }, // [DUMMY]
        ],
    },
    // Signature piece — no series
    {
        id: 'SIG-001',
        title: 'The Serpent',
        category: 'Multidimensional Art',
        coverImage: 'https://picsum.photos/1000/1200?random=7',
        images: ['https://picsum.photos/1000/1200?random=7a'],
        description: 'A singular form. Coiled and precise, somewhere between creature and symbol.',
        year: '2024',
        dimensions: '18" x 24"',
        material: 'Walnut, Brass Inlay',
        finish: 'Natural',
        availability: 'READY_TO_SHIP',
        price: 3200,
        edition: 'One of a Kind',
        featured: true,
        isSignaturePiece: true,
        stripePriceId: 'price_SIG001_REPLACE_WITH_REAL_ID',
    },
    // Illuminated piece
    {
        id: 'ILLUM-001',
        title: 'Breath of the Forest',
        category: 'Multidimensional Art',
        series: 'Universal Language',
        coverImage: 'https://picsum.photos/1000/1000?random=8',
        images: ['https://picsum.photos/1000/1000?random=8a', 'https://picsum.photos/1000/1000?random=8b'],
        description: 'By day, a layered study in geometry. After dark, the piece opens. Light finds the edges. The room changes.',
        longDescription: 'Embedded LEDs breathe at a slow rhythm, designed for spaces where presence matters. The illumination can be set to ambient or to a gentle pulse.',
        year: '2024',
        dimensions: '30" Diameter',
        material: 'Birch, Acrylic, LED',
        finish: 'Painted',
        availability: 'MADE_TO_ORDER',
        price: 950, // [DUMMY] — lowest size price, used for "From $X" displays
        edition: 'Edition of 5',
        editionSize: 5,
        featured: true,
        illuminated: true,
        sizeVariants: [
            { size: '16"', price: 950,  stripePriceId: 'price_ILLUM001_16_REPLACE_WITH_REAL_ID', availability: 'MADE_TO_ORDER' }, // [DUMMY]
            { size: '24"', price: 1200, stripePriceId: 'price_ILLUM001_24_REPLACE_WITH_REAL_ID', availability: 'MADE_TO_ORDER' }, // [DUMMY]
            { size: '30"', price: 1800, stripePriceId: 'price_ILLUM001_30_REPLACE_WITH_REAL_ID', availability: 'MADE_TO_ORDER' }, // [DUMMY]
        ],
    },
];

// Fill out archive with more mock data (deterministic availability)
// Light Codes is now a series under Multidimensional Art, not its own top-level category.
const GEN_CATEGORIES = [
    'Multidimensional Art',
    'Jewelry',
    'Oracle Cards',
    'Tables',
    'Installations',
    'Objects',
    'Spaces',
];

const SERIES_BY_CATEGORY: Record<string, string[]> = {
    'Multidimensional Art': ['Universal Language', 'Mandala', 'Light Codes'],
};

const SUBCATEGORY_BY_SERIES: Record<string, string[]> = {
    'Light Codes': LIGHT_CODE_SUBCATEGORIES,
};

const FINISH_OPTIONS = ['Natural', 'Painted', 'Gold Leaf'];

// Richer name pools so generated pieces feel like real work
const GEN_TITLES: Record<string, string[]> = {
    'Universal Language': [
        'Gate of Becoming', 'Silent Threshold', 'Harmonic Field', 'Resonant Ground',
        'The 49th Gate', 'Spiral Descent', 'Frequency of Return', 'Open Circuit',
        'The Witness', 'Unfolding Axis', 'Primordial Arc', 'Held in Form',
    ],
    'Mandala': [
        'Inner Compass', 'Still Center', 'Radiant Wheel', 'Infinite Return',
        'The Eye of Silence', 'Cosmic Breath', 'Lotus Geometry', 'Axis of Light',
        'Mandala of the Void', 'Circle of Becoming', 'Golden Ratio Study', 'The Seed Form',
    ],
    'Light Codes': [
        'Frequency Anchor', 'Luminous Signal', 'The Transmission', 'Code of the Deep',
        'Resonant Field', 'Ithaca', 'Dreamtime Glyph', 'Council of Light',
        'Encoded Matrix', 'Star Language', 'Waking Frequency', 'Root Signal',
    ],
    'Jewelry': [
        'Talisman of Stillness', 'Sacred Arc Pendant', 'Geometry Ring', 'Spiral Earring Pair',
        'Lunar Pendant', 'Chrysalis Cuff', 'Labradorite Talisman', 'Oxidized Circle Pendant',
        'Brass Eye Pendant', 'River Stone Ring', 'Golden Gate Pendant', 'Resonance Band',
    ],
    'Oracle Cards': [
        'The Journey Deck', 'Light Codes Oracle', 'Gene Keys Reflection Set',
        'Ceremony Cards', 'Inner Compass Deck', 'Threshold Oracle',
        'Presence Cards', 'Sacred Mirror Deck', 'Elements Oracle', 'Path of Return Deck',
        'Spiral Oracle', 'The Witness Deck',
    ],
    'Tables': [
        'River Table', 'Altar Platform', 'Low Ceremony Table', 'Living Edge Console',
        'Tea Ceremony Slab', 'Black Walnut Bench', 'Resin River Desk', 'Stone and Wood Shelf',
        'Gathering Table', 'Forest Table', 'Meditation Platform', 'Ritual Surface',
    ],
    'Installations': [
        'Portal Arch', 'Sacred Grove', 'The Threshold Room', 'Light Cathedral',
        'Frequency Field', 'The Nest', 'Ceremonial Ring', 'Forest of Forms',
        'Void Structure II', 'Living Canopy', 'Star Map Installation', 'Sound Garden',
    ],
    'Objects': [
        'Sphere Cradle', 'Incense Altar', 'Obsidian Weight', 'Crystal Throne',
        'Brass Cone Holder', 'Cedar Box', 'Ritual Bowl', 'Stone Egg Cradle',
        'Geometry Paperweight', 'Smudge Platform', 'Selenite Stand', 'Bamboo Vessel',
    ],
    'Spaces': [
        'Bamboo Tea House', 'Garden Sanctuary', 'The Listening Room', 'Forest Threshold',
        'Meditation Alcove', 'Ceremonial Pavilion', 'River Pavilion', 'Elevated Retreat',
        'Sacred Ground Studio', 'The Still Room', 'Floating Platform Space', 'Fire Circle',
    ],
};

const GEN_DESCRIPTIONS: Record<string, string[]> = {
    'Universal Language': [
        'A hexagram expressed in layered birch and acrylic. Each ring corresponds to a movement within the Gene Keys cycle.',
        'Laser-cut geometry aligned to one of sixty-four thresholds. The form holds silence.',
        'Three planes of geometry nested inside each other. The center is unreachable by eye but felt immediately.',
        'A meditation on the interplay between yin and yang expressed in physical layers and negative space.',
    ],
    'Mandala': [
        'Sacred geometry forms rendered in laser-cut birch. Painted by hand. No two the same.',
        'A window inward. The geometry is exact; the brushwork is free.',
        'Map of the inner cosmos. Each ring painted in sequence, moving from chaos to stillness.',
        'Concentric precision. The eye finds the center and rests there.',
    ],
    'Light Codes': [
        'Anchoring of an unseen realm. The form came after a dreamtime session. The light language is embedded in the cut.',
        'Frequencies made visible. After dark, embedded LEDs bring a second layer forward.',
        'A glyph received in meditation, rendered in physical form. The intention is coded into each layer.',
        'This piece carries a transmission. It came quickly, all at once. Some works are found, not made.',
    ],
    'Jewelry': [
        'Oxidized brass that warms to the body almost immediately. A wearable anchor.',
        'Labradorite set in silver. Light shifts through the stone depending on angle and mood.',
        'Sacred geometry reduced to its most essential form. Worn close to the heart.',
        'Hammered and oxidized by hand. No two identical. This piece carries its own character.',
    ],
    'Oracle Cards': [
        'A reflection tool, not a prediction system. Each card opens a question.',
        'Forty cards. Each one a doorway into a different frequency of awareness.',
        'Designed for ceremony and daily practice. Pull one card. Sit with it.',
        'Printed on heavyweight stock. Illustrated from original artworks.',
    ],
    'Tables': [
        'Live edge black walnut. A resin river through the center holds preserved botanical matter.',
        'Designed for the tea practice. Low platform height. Unfinished oil finish.',
        'Built for gathering. The wood grain runs continuously across the joined slabs.',
        'A functional art piece. Meant to be used, touched, and lived with.',
    ],
    'Installations': [
        'Built for a festival environment. Designed to hold ceremony within it.',
        'Steel armature with hand-applied panels. Changes character depending on time of day and lighting.',
        'An immersive environment. The piece is the space, not an object within it.',
        'Commissioned for a permanent installation. Site-specific geometry based on the land.',
    ],
    'Objects': [
        'A cradle for the crystal ball. Carved walnut with brass inlay detail.',
        'Incense platform with channel routing. Cedar and stone. Designed for daily ritual.',
        'A small geometry in solid brass. Heavy for its size. Satisfying to hold.',
        'Sphere holder in oxidized steel. Adjustable grip. Works with any sphere from 60-100mm.',
    ],
    'Spaces': [
        'Designed for the tea practice. Natural ventilation, low platform seating, bamboo and stone materials.',
        'A room for listening. Acoustically considered. Single entrance. No windows on the north wall.',
        'Garden sanctuary built around an existing tree. The tree is the center.',
        'Meditation alcove within a larger home. Separated from the main living space by a threshold.',
    ],
};

const GEN_DIMENSIONS: Record<string, string[]> = {
    'Universal Language': ['24" Diameter', '30" Diameter', '18" x 24"', '36" Diameter', '12" x 18"'],
    'Mandala': ['24" Diameter', '30" Diameter', '18" Diameter', '36" Diameter', '12" Diameter'],
    'Light Codes': ['18" x 24"', '24" x 36"', '12" x 18"', '30" x 40"', '16" x 20"'],
    'Jewelry': ['2" Pendant', '1.5" Ring', '3" Cuff', '1" Earring Pair', '2.5" Pendant'],
    'Oracle Cards': ['3.5" x 5" · 40 Cards', '3" x 5" · 44 Cards', '4" x 6" · 36 Cards'],
    'Tables': ['60" x 24" x 18"', '48" x 20" x 16"', '72" x 30" x 30"', '36" x 18" x 14"'],
    'Installations': ['Variable', '20ft Wide', '30ft Wide', '40ft x 20ft', '15ft Diameter'],
    'Objects': ['4" Diameter', '6" x 4"', '3" x 3" x 2"', '8" x 6"'],
    'Spaces': ['Variable', '12ft x 12ft', '20ft x 15ft', '8ft x 10ft'],
};

const GEN_MATERIALS: Record<string, string[]> = {
    'Universal Language': ['Birch, Acrylic', 'Birch, Gold Leaf', 'Plywood, Airbrush', 'Birch, Crystals, Acrylic'],
    'Mandala': ['Birch, Acrylic', 'Plywood, Gold Leaf', 'Birch, Painted Finish', 'MDF, Metallic Paint'],
    'Light Codes': ['Basswood, LED', 'Birch, Acrylic, LED', 'Laser Etched Basswood', 'Plywood, RGB LED'],
    'Jewelry': ['Oxidized Brass', 'Sterling Silver, Labradorite', 'Raw Brass', 'Argentium Silver'],
    'Oracle Cards': ['Heavyweight Card Stock', 'Matte Laminate Card Stock', 'Textured Art Card'],
    'Tables': ['Black Walnut, Resin', 'Live Edge Cedar', 'White Oak, Steel Base', 'Black Walnut, Brass Inlay'],
    'Installations': ['Mixed Media', 'Steel, Fabric', 'Bamboo, Lighting', 'Wood, Projection Surface'],
    'Objects': ['Walnut, Brass', 'Cedar, Stone', 'Solid Brass', 'Oxidized Steel'],
    'Spaces': ['Bamboo, Stone', 'Cedar, Glass', 'Mixed Natural Materials', 'Stone, Timber'],
};

const GEN_YEARS = ['2022', '2023', '2024', '2024', '2023'];

for (let i = 0; i < 30; i++) {
    const catLabel = GEN_CATEGORIES[i % GEN_CATEGORIES.length];
    const availabilities: AvailabilityStatus[] = ['READY_TO_SHIP', 'MADE_TO_ORDER', 'READY_TO_SHIP', 'SOLD', 'MADE_TO_ORDER'];
    const seriesOptions = SERIES_BY_CATEGORY[catLabel];
    const series = seriesOptions ? seriesOptions[Math.floor(i / GEN_CATEGORIES.length) % seriesOptions.length] : undefined;
    const subcategoryOptions = series ? SUBCATEGORY_BY_SERIES[series] : undefined;
    const subcategory = subcategoryOptions ? subcategoryOptions[i % subcategoryOptions.length] : undefined;
    const isMulti = catLabel === 'Multidimensional Art';
    const isSignaturePiece = isMulti && i % 7 === 0;

    // Pull from rich name/description/material pools
    const titleKey = series || catLabel;
    const titlePool = GEN_TITLES[titleKey] ?? GEN_TITLES[catLabel] ?? [];
    const descPool = GEN_DESCRIPTIONS[series || catLabel] ?? GEN_DESCRIPTIONS[catLabel] ?? [];
    const dimPool = GEN_DIMENSIONS[series || catLabel] ?? GEN_DIMENSIONS[catLabel] ?? ['Variable'];
    const matPool = GEN_MATERIALS[series || catLabel] ?? GEN_MATERIALS[catLabel] ?? ['Mixed Media'];

    const title = titlePool[i % titlePool.length] ?? `${titleKey} No. ${i + 1}`;
    const description = descPool[i % descPool.length] ?? 'A study in form and resonance.';
    const dimensions = dimPool[i % dimPool.length] ?? 'Variable';
    const material = matPool[i % matPool.length] ?? 'Mixed Media';

    // Vary image aspect ratios to make the masonry feel more natural
    const aspectSeeds = ['800/800', '800/1100', '1000/800', '800/950', '900/800'];
    const [w, h] = (aspectSeeds[i % aspectSeeds.length]).split('/');

    FULL_ARCHIVE.push({
        id: `GEN-${i}`,
        title,
        category: catLabel,
        series: isSignaturePiece ? undefined : series,
        coverImage: `https://picsum.photos/${w}/${h}?random=${100 + i}`,
        images: [],
        description,
        year: GEN_YEARS[i % GEN_YEARS.length],
        dimensions,
        material,
        finish: isMulti ? FINISH_OPTIONS[i % FINISH_OPTIONS.length] : undefined,
        subcategory,
        isSignaturePiece: isSignaturePiece || undefined,
        illuminated: isMulti && i % 11 === 0 ? true : undefined,
        availability: availabilities[i % availabilities.length],
        price: 500 + i * 75,
        edition: i % 3 === 0 ? `Edition of ${5 + (i % 10)}` : 'Open Edition',
        editionSize: i % 3 === 0 ? 5 + (i % 10) : undefined,
        editionSold: i % 3 === 0 ? Math.min(i % 5, 5 + (i % 10)) : undefined,
        featured: false,
    });
}

// --- COLLECTIONS ---
// Used by the Creations landing page to surface sub-groupings within a category.
// Light Codes is now a series under Multidimensional Art.

export const COLLECTIONS: Collection[] = [
    {
        id: 'col-universal-language',
        name: 'Universal Language',
        description: 'Exploring the geometry of silence.',
        category: 'Multidimensional Art',
        matchSeries: 'Universal Language',
    },
    {
        id: 'col-mandala',
        name: 'Mandala',
        description: 'Maps of the inner and outer cosmos.',
        category: 'Multidimensional Art',
        matchSeries: 'Mandala',
    },
    {
        id: 'col-light-codes',
        name: 'Light Codes',
        description: 'Frequencies anchored in matter.',
        category: 'Multidimensional Art',
        matchSeries: 'Light Codes',
    },
];

// --- SHOP INVENTORY (Ready to Ship + Made to Order) ---

export const INVENTORY: Product[] = FULL_ARCHIVE
    .filter(a => (a.availability === 'READY_TO_SHIP' || a.availability === 'MADE_TO_ORDER') && a.price)
    .map(a => {
        const variants = a.sizeVariants ?? a.madeToOrderSizes;
        const highPrice = variants && variants.length > 0
            ? Math.max(...variants.map(v => v.price))
            : undefined;
        return {
            id: a.id,
            title: a.title,
            price: a.price!,
            highPrice: highPrice && highPrice !== a.price ? highPrice : undefined,
            category: a.category,
            image: a.coverImage,
            available: true,
            description: a.description,
            longDescription: a.longDescription,
            material: a.material,
            dimensions: a.dimensions,
            edition: a.edition,
            isReadyToShip: a.availability === 'READY_TO_SHIP' && !variants,
            hasVariants: Boolean(variants && variants.length > 0),
            stripePriceId: a.stripePriceId,
            stripeUrl: a.stripeUrl,
        };
    });


// --- WRITINGS ---

export const STORIES: Story[] = [
    {
        id: '1',
        slug: 'ye-ming-zhu',
        title: 'Ye Ming Zhu: The Glowing Crystal',
        subtitle: 'History, Mysteries, and the Path of Light',
        category: 'Living Knowledge',
        date: 'Winter 2024',
        image: 'https://picsum.photos/1200/800?random=20',
        excerpt: 'These glowing crystals are more than the royal lineage of the Chinese and Ancient Taoists. They are beyond the legends of the Phoenix and Dragon\'s glowing pearl, the Hindu and Buddhist Chintamani wish-fulfilling gem, the Atlantean blue glowing stones, and stories from ancient texts of glowing crystals used to discern truth.',
        content: [
            "I was first drawn to Ye Ming Zhu through a series of synchronicities.",
            "These glowing crystals are more than the royal lineage of the Chinese and Ancient Taoists. They are beyond the legends of the Phoenix and Dragon's glowing pearl, the Hindu and Buddhist Chintamani wish-fulfilling gem, the Atlantean blue glowing stones, and stories from ancient texts of glowing crystals used to discern truth. So what is this glowing treasure that almost every ancient culture and religion has revered in its stories?",
            "Ye Ming Zhu is a gift in unraveling these stories and discovering what remains true.",
            "Many ask: What are the powers of Ye Ming Zhu? What will it do for me? Can it help me heal? Will it help me find my partner? This is not Ye Ming Zhu. This creates a reliance on something from the outside and feeds it with your power.",
            "Ye Ming Zhu mirrors what is found within and shines inside out. It is a focal point for the alchemy of consciousness, time, and space, and the dance of formless into form. It is crystal resonance supporting the clarification of your dreams, expression of truth, and standing in your center. It is charged by the sun, nourished by focus, intention, and love, and always glows from the inside out.",
            "Ye Ming Zhu is a crystal of alignment found in the lives of Royalty, Mystics, and Trailblazers awakening nobility. True nobility is found when we stand in the center and move with grace, act with truth, and cherish this moment. Wherever our focus goes, grows. The how and why we act matters more than the what. The crystal guides us into deeper alignment. Intention and love become amplified. The more we express our energy, our glow, the bigger and brighter it becomes.",
            "The beauty of this crystal is in the creation of a power object which holds light and shines it back throughout the darkness.",
            "You often see the glowing crystal between the dragon and the phoenix, symbolizing the balance of yin and yang. With precise discipline and practice, and ever-loving acceptance, the phoenix and dragon create this glowing pearl. The zero point. The truth is, we are infinite beings navigating multiple dimensions through focus, consciousness, frequency, connection, expression, celebration, love, joy. When we tap into the animistic properties of an object, it is the place where consciousness meets form.",
            "In birthing this ancient crystal into the modern day, it took many years of research and experimentation by a material scientist, poet, and healer working together to make the elusive Ye Ming Zhu accessible. This was done through advanced crystallography, material science, and beautification through artistry. These creators have since stopped their creations, so fakes that glow brightly but lack the coherent molecular form now flood the markets. To find a beautiful, authentic crystal such as these is very rare indeed.",
            "I understand the beauty of something formed in the earth. The crystals I have found from the earth glow dimly when charged by UV light because the quantity of rare earth elements is so low. When I connect to them, they have the resonance of earth fluorite but not the amplitude of crystals made by modern alchemists. This is why I bring the two together in some designs: to honor the earth and explore the vibrance of what is possible with the most brilliant minds of today.",
            "These are talismans of intention. An opportunity to take a moment and charge your love, your magic, your wisdom, your inspiration into an object. To take what you hold close to your heart and cultivate a loving relationship with it every day. To take the vibration of creation that we all possess through focused intention and clarity and spill it into an object that continues to shine its light beyond space and time.",
            "The legends throughout history of this crystal go far and wide, including opening doors to Agartha, Shambhala, and other multidimensional realms.",
            "Personally, I have seen these manifest in front of my eyes, teaching me valuable lessons. When you let go, things show. I have had dreamtime experiences with interdimensional beings guiding me to these glowing crystals. I have witnessed how these crystals in ceremonial settings can connect large groups together, open up portals to many dimensions, and encourage us all to shine brighter in collective coherence.",
            "I discovered this crystal over a decade ago through a magical set of synchronicities. Through this process I discovered so much about myself, my relation to objects, my relation to money, my relation to love. I experienced deep meditative states, experienced many things that are unexplainable, and discovered an extremely deep mystery of life that we are all participating in.",
            "These crystals are a gift from beyond time. The understanding is beyond the mind, and its challenge is to continue to give and receive. Give your love, give your focus, give your inspiration, and receive it back many times over.",
            "An infinite spiral of love, creation, and divination. Knowing how to speak your truth. Knowing where your center is. Feeling the strength, the love, the joy, the health, the wealth, all those things we are blessed by when we awaken to the light inside of us.",
            "This is what Ye Ming Zhu is. It is not a thing to bring you miracle healing. But wherever you place your focus and love, that is where the energy moves. It has a life on its own, a sentience on its own. But without human consciousness, the seed of awareness, it is nothing but a glowing paperweight.",
            "Let us step into this opportunity we hold with reverence and understand the beauty of these rare earth elements coming together in a crystalline form to hold our greatest dreams and shine them infinitely back with light. Not only from ourselves but from the frequency of earth, from our community, from the water, from the lessons of the past, all the past gurus who are here to remind you of your inner light. Allow them to contribute to our journey of embodiment of what it truly means to be alive."
        ],
        readMinutes: 10,
        tags: ['Crystals', 'History', 'Ye Ming Zhu'],
        isFeatured: true
    },
    {
        id: '2',
        slug: 'the-mandala-series',
        title: 'The Mandala Series',
        subtitle: 'Windows Inward',
        category: 'Beneath the Surface',
        date: 'Autumn 2023',
        image: 'https://picsum.photos/1200/800?random=21',
        excerpt: 'A mandala is not something to look at. It is a place to enter.',
        content: [
            "Most people think a mandala is a pretty pattern. A decorative circle. Something to color in for relaxation.",
            "A mandala is not something to look at. It is a place to enter.",
            "I have found that using geometry and structures aligned with universal ratios helps stabilize and tap deeper into experiences that are hard to name. The mandala form radiates from a center point in concentric circles. When we gaze into a mandala, we are invited to reverse that journey. To move from the edges back toward the center.",
            "When I create a mandala, my mind often leaves as my pencil moves. I have no idea what is emerging, but I feel it to be true. There is a sense of guidance toward something I cannot name but recognize.",
            "The laser creates the precise geometry. Then comes the painting. The splatter, the imperfect symmetry, the colors that arrive without planning. The geometry is exact. The laser is precise. But we humans embrace the splatter, the imperfect symmetry, the crystal that feels perfect but sits just slightly off.",
            "Each painted mandala is genuinely one of one. The underlying form may be repeated, but the painting that lives on it can never be. This is the heart of what I do. The laser-cut shape is the canvas. The painting is the art.",
            "People respond to these pieces in ways I do not fully understand. Some sit with them for a long time. Some feel something shift. The geometry and the painting seem to reach somewhere words do not. I only know what feels true to me. It is my presence fused into every line and curve.",
            "A mandala in your space becomes a centerpiece. Not decoration. A place to sit with. To go into stillness. To find your center. It interrupts the ordinary. It asks you to be still.",
            "It is the love that went into the space, the cohesive resonance of all of the objects, all of the intention, that brings together a certain frequency. A piece like this contributes to that. It holds space alongside everything else you have chosen to surround yourself with.",
            "If someone does not already understand what they are looking at, the piece is reminding them. Something in them already knows. The art meets you where you are."
        ],
        readMinutes: 5,
        tags: ['Geometry', 'Philosophy', 'Mandala'],
        isFeatured: true
    },
    {
        id: '5',
        slug: 'the-universal-language',
        title: 'The Universal Language',
        subtitle: '64 Expressions of the Cycle of Changes',
        category: 'Beneath the Surface',
        date: 'Winter 2024',
        image: 'https://picsum.photos/1200/800?random=25',
        excerpt: 'There is a language that all of us speak. It exists beyond words and concepts of the mind.',
        content: [
            "There is a language that all of us speak. It exists beyond words and concepts of the mind. These are the expressions of the elements, of our genetics, of our experience of life through this passage of time.",
            "The Universal Language series consists of 64 creations, each connected to a chapter in the cycle of changes.",
            "To express the Universal Language, the Chinese used an 8-direction octagon grid called the I Ching, alternating between black and white, yin and yang, 1 and 0. The I Ching relates to the elements and our experience of them, internally and externally, in a cycle of changes navigating the passages of time.",
            "In this generation, through Richard Rudd, the Gene Keys emerged as another expression of this same Universal Language. Using the same 64-fold structure, Gene Keys integrates astrology, Human Design, I Ching, Tarot, and genetics into an experiential navigational system. This system moves from the Shadow (the repressed or reactive experience) into a Gift (where it is embodied and expressed), then to a Siddhi (where it effortlessly flows through you beyond you).",
            "I have always looked for what connects the different practices together. Fascinated with Chinese culture, the I Ching spoke to me. It taught me the relationship to the elements inside of our very own body and how to perceive a system and pattern of change.",
            "When I discovered the Gene Keys and realized that this is based on so many different systems, all folded into one, with a beautiful, poetic, artistic take, I became absolutely fascinated. This is how my study began. And this series became the way I could move with it, not only through the mind, but through the hands.",
            "The wooden creations were a deep dive in moving with intuition. Experiencing and receiving different patterns. Birthing them into form.",
            "Each layer is a separate piece of wood, painted uniquely to depict the dance of light and dark pushing and pulling throughout every layer of Indonesian wood. And in the places where the spaces meet, the energetic points of perfection, I place gemstones. What emerges is more than a physical piece. It is a multidimensional wooden painted sculpture.",
            "Nothing needs to be understood to speak with these creations. Your presence and experience is how you commune with these frequencies and discover what they hold for you.",
            "Pay close attention to which ones call out to you. There is a message in every one, and the one you are being drawn to now is guiding you toward what you are ready for.",
            "If you want to dive deeper, you can look up the number in the I Ching or Gene Keys systems. But allow the piece itself to speak first. Let your body respond before your mind interprets. Trust what resonates.",
            "In the future, all 64 will be part of an oracle set. A complete system for working with these frequencies through physical art. For now, each piece stands alone. A window into one chapter of the universal story we are all living.",
            "These are not decorations. They are not concepts to understand. They are invitations to experience what we already know."
        ],
        readMinutes: 8,
        tags: ['Universal Language', 'Gene Keys', 'I Ching'],
        isFeatured: false
    },
    {
        id: '6',
        slug: 'light-codes',
        title: 'Light Codes',
        subtitle: 'Anchorings of Unseen Realms',
        category: 'Beneath the Surface',
        date: 'Spring 2024',
        image: 'https://picsum.photos/1200/800?random=26',
        excerpt: 'After a vivid dream where I spoke a light language and sat in the high council of Ithaca, I awoke with a new style of art.',
        content: [
            "In Bali, I had a vivid dream where I shifted an alignment of something in my heart and instantly my whole body lit up. Illuminated blue, overlaid with glowing sigils. My throat completely opened as a language of light moved through me.",
            "As my eyes opened and I woke from this dream, my whole body was shaking with this light. And I heard: You are a High Priestess of Ithaca. A healer and a guide.",
            "This was a surprise, as I am a man.",
            "I later researched Ithaca. Legend has it that this is where Hercules is from. And the story of Ithaca symbolically represents the journey of returning to the heart. Coming home to what was always there.",
            "The next two weeks, I drew. Something was coming through me that I had never created before. The patterns were unlike anything I had seen. I gave myself time to draw and see what emerged. This is how the Light Codes were born.",
            "So many experiences have opened me that I cannot explain. Geometry, frequency, energy, direct experience of divinity. The Light Codes emerged from one such opening, fully formed, ready to move through me.",
            "These are anchorings of unseen realms. Energy flowing in a stream of consciousness through my pen.",
            "Since then, many people have sat with these and felt different dimensions open up within them. As you gaze into them you can find signs, sigils, and shapes that inspire things within. What will they awaken in you?",
            "Frequency Foundations are visual blueprints of different planes of reality. Rhythms and patterns guided by frequency for form to be perceived and experienced. As we change the frequency of our foundation, different realities are illuminated. Our perceptions, feelings, and experiences shift.",
            "Embodied Vibrations are universal songs we are remembering. When we harmonize with and embody these vibrations, we learn the language of life. Every vibration feels different. Every song sounds different. It is the unity found in diversity that inspires a veneration for life.",
            "Resonant Formations are the experience of energy, frequency, and vibration taking recognizable form. Gods, Deities, Celestials, Extra Terrestrials. Different ways we relate to these formations. Truth is found in their resonance. They remind us of our divinity, support us in embodiment, and inspire mystery and wonder.",
            "The story of Ithaca is a story of returning home. This is also what a custom Light Code is. When I sit with someone and tune into their dreams and frequencies, I allow this energy to move through me for them. What emerges are vibrational patterns of their deepest resonance, expressed into physical form. A visual gateway to what lives inside them.",
            "Available as a digital file or engraved in wood."
        ],
        readMinutes: 7,
        tags: ['Light Codes', 'Dream', 'Frequency'],
        isFeatured: false
    },
    {
        id: '3',
        slug: 'the-practice-creation',
        title: 'How I Create',
        subtitle: 'From formless to form.',
        category: 'The Practice',
        date: 'Summer 2023',
        image: 'https://picsum.photos/1200/800?random=22',
        excerpt: 'Creating is how I grow. My inner journey. A celebration of creation itself.',
        content: [
            "Art is the experience of listening, bringing what is felt from the whispers into form. Creating the artifacts of the future in reverence of this moment.",
            "I start with silence. Before the laser is turned on, before the wood is selected, there is the intention. Often, the design comes in a flash—a 'download'—during meditation or tea ceremony.",
            "The execution is a dance between digital precision and analog chaos. Airbrushing allows for organic gradients that the computer cannot replicate. The result is a piece that feels both made by a machine and born from a dream."
        ],
        readMinutes: 4,
        tags: ['Process', 'Studio'],
        isFeatured: false
    },
    {
        id: '4',
        slug: 'path-tea',
        title: 'The Way of Tea',
        subtitle: 'Twenty years of culture.',
        category: 'The Path',
        date: 'Spring 2023',
        image: 'https://picsum.photos/1200/800?random=23',
        excerpt: 'Tea came early. My father introduced it when I was young. Since 2010, I’ve been trading artwork for Chinese tea.',
        content: [
            "Tea came early. My father introduced it when I was young. In 2009, I began exploring Asia. China, Japan, Thailand, Taiwan, Bali. Learning the ways of different cultures.",
            "Since 2010, I've been trading artwork for Chinese tea. Two practices that had always been connected. Now, through Teajia, I share this culture globally.",
            "In my art, the influence of tea is everywhere. The patience required to wait for the kettle is the same patience required to sand a piece of walnut to a mirror finish."
        ],
        readMinutes: 6,
        tags: ['Tea', 'Autobiography'],
        isFeatured: false
    }
];

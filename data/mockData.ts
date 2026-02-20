
import { Artwork, AvailabilityStatus, Collection, Product, Story } from '../types';

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
    { id: 'ORACLE',  label: 'Oracle Cards',         desc: 'Tools for reflection' },
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
        image: 'https://picsum.photos/1200/800?random=s1'
    },
    {
        id: 'series-2',
        name: 'Light Codes',
        description: 'Frequencies anchored in matter.',
        image: 'https://picsum.photos/1200/800?random=s2'
    },
    {
        id: 'series-3',
        name: 'Mandala',
        description: 'Maps of the inner and outer cosmos.',
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
        price: 1850,
        edition: 'Edition of 10',
        featured: true,
        relatedStorySlug: 'beneath-surface-mandala',
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
        price: 950,
        edition: 'Open Edition',
        featured: true,
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
        price: 2800,
        edition: 'Edition of 5',
        featured: true,
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
        price: 4200,
        edition: 'Edition of 5',
        featured: true,
        illuminated: true,
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

for (let i = 0; i < 30; i++) {
    const catLabel = GEN_CATEGORIES[i % GEN_CATEGORIES.length];
    const availabilities: AvailabilityStatus[] = ['READY_TO_SHIP', 'MADE_TO_ORDER', 'READY_TO_SHIP', 'SOLD', 'MADE_TO_ORDER'];
    const seriesOptions = SERIES_BY_CATEGORY[catLabel];
    const series = seriesOptions ? seriesOptions[Math.floor(i / GEN_CATEGORIES.length) % seriesOptions.length] : undefined;
    const subcategoryOptions = series ? SUBCATEGORY_BY_SERIES[series] : undefined;
    const subcategory = subcategoryOptions ? subcategoryOptions[i % subcategoryOptions.length] : undefined;
    const isMulti = catLabel === 'Multidimensional Art';
    // Every 7th multi piece is a signature piece (no series)
    const isSignaturePiece = isMulti && i % 7 === 0;

    FULL_ARCHIVE.push({
        id: `GEN-${i}`,
        title: `${series || catLabel} Study ${i + 1}`,
        category: catLabel,
        series: isSignaturePiece ? undefined : series,
        coverImage: `https://picsum.photos/800/800?random=${100 + i}`,
        images: [],
        description: 'A study in form and resonance.',
        year: '2023',
        dimensions: 'Variable',
        material: 'Mixed Media',
        finish: isMulti ? FINISH_OPTIONS[i % FINISH_OPTIONS.length] : undefined,
        subcategory,
        isSignaturePiece: isSignaturePiece || undefined,
        illuminated: isMulti && i % 11 === 0 ? true : undefined,
        availability: availabilities[i % availabilities.length],
        price: 500 + i * 100,
        edition: i % 3 === 0 ? `Edition of ${5 + (i % 10)}` : 'Open Edition',
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
    .map(a => ({
        id: a.id,
        title: a.title,
        price: a.price!,
        category: a.category,
        image: a.coverImage,
        available: true,
        description: a.description,
        longDescription: a.longDescription,
        material: a.material,
        dimensions: a.dimensions,
        edition: a.edition,
        isReadyToShip: a.availability === 'READY_TO_SHIP'
    }));


// --- WRITINGS ---

export const STORIES: Story[] = [
    {
        id: '1',
        slug: 'ye-ming-zhu',
        title: 'Ye Ming Zhu: The Glowing Crystal',
        subtitle: 'History, mysteries, and meaning.',
        category: 'Living Knowledge',
        date: 'Winter 2024',
        image: 'https://picsum.photos/1200/800?random=20',
        excerpt: 'Ye Ming Zhu is a rare luminescent crystal revered across Chinese, Hindu, Buddhist, and Taoist traditions. Known as the Dragon\'s Pearl, it glows when charged by sunlight.',
        content: [
            "Ye Ming Zhu is a rare luminescent crystal revered across Chinese, Hindu, Buddhist, and Taoist traditions. Known as the Dragon's Pearl, it glows when charged by sunlight and has been treasured by emperors, mystics, and healers for centuries.",
            "My own journey with this stone began years ago. It is not merely a mineral; it is a battery for intention. Unlike phosphorescent plastics which glow for minutes, high-quality Ye Ming Zhu can hold light for hours, emitting a frequency that interacts with the bio-field.",
            "In the studio, I often incorporate these spheres into multidimensional sculptures. They act as the 'heart' of the piece, gathering light during the day and breathing it back out at night."
        ],
        readMinutes: 10,
        tags: ['Crystals', 'History', 'Ye Ming Zhu'],
        isFeatured: true
    },
    {
        id: '2',
        slug: 'beneath-surface-mandala',
        title: 'What Mandalas Really Are',
        subtitle: 'Beyond the pretty pattern.',
        category: 'Beneath the Surface',
        date: 'Autumn 2023',
        image: 'https://picsum.photos/1200/800?random=21',
        excerpt: 'The geometry is exact. The laser is precise. But we humans embrace the imperfect symmetry.',
        content: [
            "A mandala is not just a pretty pattern. It is a map of the universe, and simultaneously a map of the self. In Tibetan tradition, the mandala is the palace of the deity.",
            "When I create a layered mandala, I am building a three-dimensional map. The outer rings represent the boundaries of the ego, the protective fires we must pass through. As we move inward, the geometry becomes finer, more unified, until we reach the bindu—the center point.",
            "The laser cutter allows me to create these maps with a precision that was previously impossible, yet I always hand-finish them. The machine provides the structure; the human hand provides the soul."
        ],
        readMinutes: 5,
        tags: ['Geometry', 'Philosophy'],
        isFeatured: true
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

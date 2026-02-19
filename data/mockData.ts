
import { Artwork, Product, Story } from '../types';

// --- CONSTANTS FROM MASTER DOC ---

export const SERIES_LIST = [
    'Universal Language',
    'Mandala',
    'Light Codes'
];

export const CREATION_CATEGORIES = [
    { id: 'MULTI', label: 'Multidimensional Art', desc: 'Windows into the infinite' },
    { id: 'LIGHT', label: 'Light Codes', desc: 'Patterns and frequencies from the beyond' },
    { id: 'JEWELRY', label: 'Jewelry', desc: 'Wearable pieces and talismans' },
    { id: 'ORACLE', label: 'Oracle Cards', desc: 'Tools for reflection' },
    { id: 'TABLES', label: 'Tables', desc: 'Functional art for gathering' },
    { id: 'INSTALL', label: 'Installations', desc: 'Immersive environments' },
    { id: 'ILLUM', label: 'Illuminated Works', desc: 'Paintings with light and projection' },
    { id: 'OBJECTS', label: 'Objects', desc: 'Sphere holders, incense, dimensional pieces' },
    { id: 'SPACES', label: 'Spaces', desc: 'Tea houses and environments designed for presence' }
];

export const STORE_CATEGORIES = [
    'Multidimensional Art', 
    'Light Codes', 
    'Jewelry', 
    'Oracle Cards', 
    'Objects'
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
        images: ['https://picsum.photos/1000/1000?random=1a'],
        description: 'A study in concentric resonance. The layers build inward, guiding the eye to a center that holds silence.',
        year: '2023',
        dimensions: '24" Diameter',
        material: 'Birch, Acrylic, Gold Leaf',
        availability: 'READY_TO_SHIP',
        price: 1850,
        edition: 'Edition of 10',
        featured: true
    },
    {
        id: 'LC-042',
        title: 'Ancestral Signal',
        category: 'Light Codes',
        series: 'Light Codes',
        coverImage: 'https://picsum.photos/800/1200?random=2',
        images: ['https://picsum.photos/800/1200?random=2a'],
        description: 'Anchoring unseen realms. Energy flowing effortlessly in a stream of consciousness.',
        year: '2024',
        dimensions: '18" x 36"',
        material: 'Laser Etched Basswood',
        availability: 'MADE_TO_ORDER',
        price: 950,
        edition: 'Open Edition',
        featured: true
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
        featured: false
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
        featured: true
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
        featured: true
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
        availability: 'MADE_TO_ORDER',
        price: 2800,
        edition: 'Edition of 5',
        featured: true
    }
];

// Fill out archive with more mock data
for(let i=0; i<30; i++) {
    const cat = CREATION_CATEGORIES[i % CREATION_CATEGORIES.length];
    FULL_ARCHIVE.push({
        id: `GEN-${i}`,
        title: `${cat.label} Study ${i+1}`,
        category: cat.label,
        coverImage: `https://picsum.photos/800/800?random=${100+i}`,
        images: [],
        description: 'A study in form and resonance.',
        year: '2023',
        dimensions: 'Variable',
        material: 'Mixed Media',
        availability: Math.random() > 0.5 ? 'READY_TO_SHIP' : 'SOLD',
        price: 500 + (i * 100),
        featured: false
    });
}

// --- SHOP INVENTORY (Ready to Ship Only) ---

export const INVENTORY: Product[] = FULL_ARCHIVE
    .filter(a => a.availability === 'READY_TO_SHIP' && a.price)
    .map(a => ({
        id: a.id,
        title: a.title,
        price: a.price!,
        category: a.category,
        image: a.coverImage,
        available: true,
        description: a.description,
        material: a.material,
        isReadyToShip: true
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

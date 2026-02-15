
import { Artwork, Product, Story } from '../types';

export const SERIES_DATA = [
    { 
        id: 'universal-language', 
        name: 'Universal Language', 
        description: 'A meditation on shared symbols across cultures. Each piece in this series explores how simple geometric forms can hold infinite meaning.',
        image: 'https://picsum.photos/800/600?random=901'
    },
    { 
        id: 'geometric-portals', 
        name: 'Geometric Portals', 
        description: 'Gateways to the infinite constructed from finite lines. These works play with depth and perspective to pull the viewer into a meditative state.',
        image: 'https://picsum.photos/800/600?random=902'
    },
    { 
        id: 'sacred-spaces', 
        name: 'Sacred Spaces', 
        description: 'Architectural resonance studies designed to anchor the energy of a room. Focusing on the interplay of shadow and light.',
        image: 'https://picsum.photos/800/600?random=903'
    },
    { 
        id: 'void-structure', 
        name: 'Void Structure', 
        description: 'Explorations of negative space. Defining the form by what is absent rather than what is present.',
        image: 'https://picsum.photos/800/600?random=904'
    }
];

export const CATEGORIES = [
    { id: 'MANDALA', label: 'Platonic Solids', description: 'Recursive geometric patterns.', code: 'SEC-01' },
    { id: 'SCULPTURE', label: 'Golden Spiral', description: '3D studies of negative space.', code: 'SEC-02' },
    { id: 'ARCH', label: 'Architectural', description: 'Sacred ratio environments.', code: 'SEC-03' },
    { id: 'ALTAR', label: 'Altars', description: 'Ritual implements.', code: 'SEC-04' },
    { id: 'INSTALL', label: 'Light & Projection', description: 'Light and shadow interplay.', code: 'SEC-05' }
];

export const MATERIALS = ['Birch Plywood', 'Black Walnut', 'Oxidized Brass', 'Cast Acrylic', 'Gold Leaf', 'Raw Steel'];
export const YEARS = ['2019', '2020', '2021', '2022', '2023', '2024'];

export const generateArchive = (count: number): Artwork[] => {
    return Array.from({ length: count }).map((_, i) => {
        const cat = CATEGORIES[i % CATEGORIES.length];
        const mat = MATERIALS[Math.floor(Math.random() * MATERIALS.length)];
        const yr = YEARS[Math.floor(Math.random() * YEARS.length)];
        const width = 800 + Math.floor(Math.random() * 400);
        const height = 800 + Math.floor(Math.random() * 400);
        
        // Randomly assign a series
        const series = SERIES_DATA[Math.floor(Math.random() * SERIES_DATA.length)].name;
        
        // Mark some as featured (approx 20%)
        const isFeatured = Math.random() > 0.8;
        
        // Generate a random date within the last 2 years
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 700));

        // Ensure "Light & Projection" category exists specifically
        const categoryLabel = i % 10 === 0 ? 'Light & Projection' : cat.label;

        return {
            id: `ARC-${cat.code}-${String(i).padStart(4, '0')}`,
            title: `${cat.label} Variant ${String(i + 1).padStart(3, '0')}`,
            category: categoryLabel,
            coverImage: `https://picsum.photos/${width}/${height}?random=${1000 + i}`,
            images: [
                `https://picsum.photos/1200/800?random=${2000 + i}`,
                `https://picsum.photos/800/1200?random=${3000 + i}`,
                `https://picsum.photos/${height}/${width}?random=${4000 + i}`
            ],
            description: `Analysis of geometric density reveals a phi-ratio consistency of 99.8%. The ${mat} substrate provides optimal resonance damping.`,
            year: yr,
            dimensions: `${12 + Math.floor(Math.random() * 36)}" x ${12 + Math.floor(Math.random() * 36)}"`,
            material: mat,
            series: series,
            featured: isFeatured,
            createdDate: date,
            price: 450 + Math.floor(Math.random() * 2500),
            available: Math.random() > 0.4 // 60% are available for purchase
        };
    });
};

export const FULL_ARCHIVE = generateArchive(342);

export const STORE_CATEGORIES = ['Ceramics', 'Minerals', 'Jewelry', 'Woodwork', 'Metalwork', 'Oracle'];
export const STORE_MATERIALS = ['Zisha Clay', 'Black Walnut', 'Brass', 'Silver', 'Linen', 'Washi Paper', 'Cardstock'];
export const ORIGINS = ['Kyoto, Japan', 'Ubud, Bali', 'Yunnan, China', 'Studio Made'];

export const generateInventory = (count: number): Product[] => {
    return Array.from({ length: count }).map((_, i) => {
        const cat = STORE_CATEGORIES[i % STORE_CATEGORIES.length];
        const mat = STORE_MATERIALS[Math.floor(Math.random() * STORE_MATERIALS.length)];
        const price = 40 + Math.floor(Math.random() * 400);
        const stock = Math.floor(Math.random() * 8); // Low stock simulation
        
        return {
            id: `ITM-${String(i).padStart(4, '0')}`,
            title: `${mat} ${cat === 'Minerals' ? 'Specimen' : cat.slice(0, -1)} No. ${i + 1}`,
            category: cat,
            price: price,
            image: `https://picsum.photos/600/600?random=${100 + i}`,
            available: stock > 0,
            description: `A unique artifact of ${mat}, sourced from ${ORIGINS[i % ORIGINS.length]}.`,
            longDescription: `This singular object represents the intersection of material purity and functional design. Crafted or sourced with intention, it carries the weight of its origin—${ORIGINS[i % ORIGINS.length]}. The surface treats light with a specific gravity, absorbing and reflecting based on the time of day. Ideal for the contemplative study or the ritual altar.`,
            dimensions: `${10 + (i % 5)}" x ${5 + (i % 3)}"`,
            weight: `${100 + (i * 10)}g`,
            origin: ORIGINS[i % ORIGINS.length],
            material: mat,
        };
    });
};

export const INVENTORY = generateInventory(64);

export const STORIES: Story[] = [
  {
    id: '1',
    slug: 'silence-tea-ceremony',
    title: 'Silence in the Tea Ceremony',
    subtitle: 'Navigating the void through ritual leaf and water.',
    type: 'practice',
    date: 'October 12, 2024',
    image: 'https://picsum.photos/1200/800?random=20',
    excerpt: 'The bowl is empty, yet it holds the universe. Exploring the void through the ritual of leaf and water.',
    content: [
      "The tea ceremony, or Chanoyu, is not merely about drinking tea. It is a choreographed dance with the void. In Japanese aesthetics, the concept of 'Ma' refers to the negative space—the pause between notes, the silence between words, the emptiness within the bowl.",
      "When we hold a Chawan (tea bowl), we are holding emptiness. It is this emptiness that allows the tea to enter. If the bowl were full, it would have no purpose. This is a profound lesson for the creative mind: we must empty ourselves of preconception to allow inspiration to flow.",
      "The steam rises in a chaotic yet perfect geometry. Watching it, one realizes that nature does not draw in straight lines, yet it adheres to invisible laws of physics that are as rigorous as any grid. In my own work with lasers, I attempt to capture this paradox: the mechanical precision of the beam serving the organic irregularity of the wood.",
      "To sit in silence with a bowl of aged Puerh is to travel without moving. The earthiness of the leaf connects us to the soil of Yunnan, while the water connects us to the clouds. It is a grounding ritual, essential for anyone navigating the high-frequency noise of the digital age."
    ],
    readMinutes: 5,
    tags: ['Ritual', 'Zen', 'Design'],
    isStartHere: true,
    relatedProductId: INVENTORY[0].id
  },
  {
    id: '2',
    slug: 'geometry-spirit',
    title: 'Geometry of the Spirit',
    subtitle: 'Why the hexagon resonates with the human soul.',
    type: 'art',
    date: 'September 28, 2024',
    image: 'https://picsum.photos/800/600?random=21',
    excerpt: 'Why the hexagon appears in nature and how we can utilize its structural integrity in our spiritual architecture.',
    content: [
        "The hexagon is nature's most efficient shape. From the honeycomb to the snowflake, to the molecular structure of carbon, the six-sided polygon represents maximum coverage with minimal material. It is the geometry of efficiency, but also of connection.",
        "In sacred geometry, the Flower of Life—a pattern of overlapping circles—contains within it the seed of the hexagon. When I design altars or wall sculptures, I often start with this grid. It allows for infinite expansion. A hexagonal lattice has no center and no edge; it is a potentially infinite field.",
        "This structural integrity resonates with the human spirit. We seek stability (the structure) but also growth (the expansion). By surrounding ourselves with these forms, whether consciously or subconsciously, we align our internal state with the fundamental laws of the universe.",
        "The laser cutter is the perfect tool for this exploration. It allows for a precision that the human hand struggles to maintain over thousands of repetitions, yet the burning of the wood introduces a natural, chaotic element—the char—that brings the sterile geometry back to life."
    ],
    readMinutes: 8,
    tags: ['Sacred Geometry', 'Nature'],
    isStartHere: true,
    relatedArtifactId: FULL_ARCHIVE[0].id
  },
  {
    id: '3',
    slug: 'travels-kyoto',
    title: 'Travels in Kyoto',
    subtitle: 'A study of texture, moss, and stone.',
    type: 'places',
    date: 'August 15, 2024',
    image: 'https://picsum.photos/800/600?random=22',
    excerpt: 'Notes on moss, stone, and the aging process of wood in ancient temples. A study of texture.',
    content: [
        "Kyoto is a city that understands time. The wood of the temples is not painted; it is allowed to turn gray, to crack, to breathe. This is Wabi-Sabi—the beauty of the impermanent, imperfect, and incomplete.",
        "I spent three days at Ryoan-ji, simply observing the rock garden. 15 stones, placed in such a way that you can never see all of them at once from any vantage point on the veranda. It is a koan in stone. It teaches us that our perspective is always limited, always incomplete.",
        "The moss gardens of Saiho-ji offered a different lesson: texture. The velvet softness of the moss against the jagged granite. This contrast is something I strive for in my artifacts—the juxtaposition of the smooth, sanded finish against the raw, laser-burnt edge.",
        "Returning to the studio, I felt a renewed commitment to materials that age well. Plastic rots; wood cures. Brass patinas. We should surround ourselves with objects that will look better in fifty years than they do today."
    ],
    readMinutes: 12,
    tags: ['Travel', 'Texture', 'Japan']
  },
  {
    id: '4',
    slug: 'laser-as-brush',
    title: 'The Laser as a Brush',
    subtitle: 'Etching light into matter.',
    type: 'practice',
    date: 'July 02, 2024',
    image: 'https://picsum.photos/800/600?random=23',
    excerpt: 'How modern photonics allow us to etch ancient symbols with a precision that honors their original mathematical purity.',
    content: [
        "There is a tendency to view technology and spirituality as opposing forces. One is cold, binary, future-focused; the other is warm, analog, ancient. But light itself is the bridge.",
        "A laser is simply focused light. It is pure energy, directed with intention. When I use the laser cutter, I do not see it as an industrial machine, but as a brush made of photons. It burns away what is not needed, revealing the form underneath.",
        "This subtractive process—burning, etching, cutting—is akin to sculpture. We are removing matter to reveal truth. The computer allows us to calculate sacred ratios (Phi, the Golden Mean) to the thousandth of an inch, a precision that the ancient master builders could only dream of.",
        "But the machine has no soul. That must be supplied by the operator. The choice of wood, the orientation of the grain, the depth of the burn, the finishing oil—these are the human decisions that turn a product into an artifact."
    ],
    readMinutes: 4,
    tags: ['Tech', 'Process'],
    isStartHere: true
  },
  {
    id: '5',
    slug: 'wearing-intention',
    title: 'Wearing Intention',
    subtitle: 'Jewelry as a talisman for the modern age.',
    type: 'jewelry',
    date: 'June 20, 2024',
    image: 'https://picsum.photos/800/600?random=24',
    excerpt: 'We carry our intentions on our skin. A look at the new brass collection.',
    content: [
      "Jewelry has always been more than decoration. For our ancestors, it was protection, status, and a connection to the divine. Today, we often forget this weight.",
      "In designing the 'Resonance' collection, I wanted to bring back the idea of the Talisman. A physical object that anchors a mental state. When you touch the brass pendant, you are reminded of your morning intention.",
      "Brass is an alloy of copper and zinc. It is conductive. It warms to the body temperature almost instantly. It feels alive. Unlike steel, which remains cold, brass creates a symbiotic relationship with the wearer, developing a unique patina over time based on the acidity of your skin.",
      "This aging process is beautiful. It means the piece is becoming yours, physically and chemically."
    ],
    readMinutes: 3,
    tags: ['Jewelry', 'Material'],
    relatedProductId: INVENTORY[2].id
  },
  {
    id: '6',
    slug: 'symbol-of-void',
    title: 'The Symbol of the Void',
    subtitle: 'Understanding the Ensō in digital design.',
    type: 'symbols',
    date: 'May 10, 2024',
    image: 'https://picsum.photos/800/600?random=25',
    excerpt: 'The circle that is never closed. How the Ensō teaches us about perfection.',
    content: [
      "The Ensō is perhaps the most profound symbol in Zen Buddhism. It is a circle, often painted in a single brushstroke, that is left open.",
      "The opening allows the spirit to flow in and out. A closed circle is hermetically sealed; it is dead. An open circle is breathing.",
      "In my digital work, I often struggle with the 'perfection' of vectors. A vector circle is mathematically perfect. It has no beginning and no end. But it lacks humanity. I often find myself manually adding imperfections to my digital files, creating small breaks in the geometry to allow the 'Ma' (negative space) to enter."
    ],
    readMinutes: 6,
    tags: ['Zen', 'Design'],
    relatedArtifactId: FULL_ARCHIVE[3].id
  },
  {
    id: '7',
    slug: 'morning-verses',
    title: 'Morning Verses',
    subtitle: 'Fragments written before the sun rises.',
    type: 'poetry',
    date: 'April 01, 2024',
    image: 'https://picsum.photos/800/600?random=26',
    excerpt: 'Three short poems about light, wood, and the silence of the workshop.',
    content: [
      "The saw sings / a high thin note / dividing the world / into two halves / of the same whole.",
      "Dust motes dance / in the shaft of light / galaxies born / from the destruction / of a maple board.",
      "I wait for the glue to dry / patience is not a virtue / it is a physical law / like gravity / or the turning of the earth."
    ],
    readMinutes: 2,
    tags: ['Poetry', 'Studio Life']
  }
];

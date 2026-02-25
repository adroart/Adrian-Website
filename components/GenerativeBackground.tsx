
import React, { useEffect, useRef } from 'react';
import { useDarkMode } from '../DarkModeContext';

interface Props {
    pathname: string;
    theme: 'LIGHT' | 'DARK';
}

// Each particle lives on a depth layer (0 = far, 1 = mid, 2 = near)
class Particle {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    vx: number;
    vy: number;
    layer: number;
    // Cached per-layer constants (avoids getter recalculation every frame)
    radius: number;
    spring: number;
    damping: number;
    timeMul: number;
    mouseRadius: number;
    mouseForce: number;

    constructor(w: number, h: number, layer: number) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.targetX = this.x;
        this.targetY = this.y;
        this.vx = 0;
        this.vy = 0;
        this.layer = layer;
        // Cache all layer-dependent values once
        this.radius = layer === 0 ? 1.0 : layer === 1 ? 1.7 : 2.5;
        this.spring = layer === 0 ? 0.003 : layer === 1 ? 0.006 : 0.01;
        this.damping = layer === 0 ? 0.93 : layer === 1 ? 0.90 : 0.86;
        this.timeMul = layer === 0 ? 0.4 : layer === 1 ? 1.0 : 1.5;
        this.mouseRadius = 150 + layer * 50;
        this.mouseForce = 0.3 + layer * 0.2;
    }

    update(mouseX: number, mouseY: number) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;

        this.vx += dx * this.spring;
        this.vy += dy * this.spring;
        this.vx *= this.damping;
        this.vy *= this.damping;

        const mDx = this.x - mouseX;
        const mDy = this.y - mouseY;
        const dist = Math.sqrt(mDx * mDx + mDy * mDy);

        if (dist < this.mouseRadius && dist > 0) {
            const force = (this.mouseRadius - dist) / this.mouseRadius;
            this.vx += (mDx / dist) * force * this.mouseForce;
            this.vy += (mDy / dist) * force * this.mouseForce;
        }

        this.x += this.vx;
        this.y += this.vy;
    }
}

// Reusable target object to avoid allocating { x, y } every frame
const _t = { x: 0, y: 0 };

type PatternFn = (
    p: Particle,
    i: number,
    count: number,
    width: number,
    height: number,
    time: number
) => { x: number; y: number };

// ---- PAGE-SPECIFIC PATTERN FUNCTIONS ----
// All patterns write into the shared _t object to avoid per-frame allocation

const patternHome: PatternFn = (p, _i, _count, _w, _h, time) => {
    _t.x = p.x + Math.sin(time + _i) * 0.3;
    _t.y = p.y + Math.cos(time + _i) * 0.3;
    return _t;
};

const patternCreations: PatternFn = (p, i, _count, width, _height, time) => {
    const spacing = 120;
    const cols = Math.ceil(width / spacing) + 2;
    const row = Math.floor(i / cols);
    const col = i % cols;
    const xOffset = (row % 2) * (spacing / 2);
    const t = time * p.timeMul;
    _t.x = col * spacing + xOffset - 50 + Math.sin(t + row) * 12;
    _t.y = row * spacing * 0.866 - 50 + Math.cos(t + col) * 12;
    return _t;
};

const patternWritings: PatternFn = (p, i, count, width, height, time) => {
    const sSpace = width / Math.max(1, count);
    const t = time * p.timeMul;
    _t.x = i * sSpace;
    _t.y = height / 2 + Math.sin(i * 0.1 + t) * 120 + Math.cos(i * 0.05 - t * 0.5) * 180;
    return _t;
};

const patternShop: PatternFn = (p, i, count, width, height, time) => {
    const radius = Math.min(width, height) * 0.38;
    const cx = width / 2;
    const cy = height / 2;
    const t = time * p.timeMul;
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const x = radius * Math.sin(phi) * Math.cos(theta + t);
    const y = radius * Math.sin(phi) * Math.sin(theta + t);
    const z = radius * Math.cos(phi);
    _t.x = cx + x * Math.cos(t * 0.2) - z * Math.sin(t * 0.2);
    _t.y = cy + y;
    return _t;
};

// Flower of Life: overlapping circles in hexagonal symmetry
const patternAbout: PatternFn = (p, i, count, width, height, time) => {
    const cx = width / 2;
    const cy = height / 2;
    const t = time * p.timeMul;
    const circleRadius = Math.min(width, height) * 0.28;
    const petalCount = 6;
    const circleIndex = i % (petalCount + 1);
    const particlesPerCircle = Math.floor(count / (petalCount + 1));
    const posInCircle = Math.floor(i / (petalCount + 1));
    const angleInCircle = (posInCircle / Math.max(1, particlesPerCircle)) * Math.PI * 2;

    let centerX = cx;
    let centerY = cy;

    if (circleIndex > 0) {
        const petalAngle = ((circleIndex - 1) / petalCount) * Math.PI * 2 + t * 0.04;
        centerX = cx + Math.cos(petalAngle) * circleRadius;
        centerY = cy + Math.sin(petalAngle) * circleRadius;
    }

    const orbitR = circleRadius * (0.5 + Math.sin(t * 0.25 + i) * 0.12);
    _t.x = centerX + Math.cos(angleInCircle + t * 0.06) * orbitR;
    _t.y = centerY + Math.sin(angleInCircle + t * 0.06) * orbitR;
    return _t;
};

// Golden spiral for Inquire
const patternInquire: PatternFn = (p, i, count, width, height, time) => {
    const cx = width / 2;
    const cy = height / 2;
    const t = time * p.timeMul;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const angle = i * goldenAngle + t * 0.04;
    const maxR = Math.min(width, height) * 0.45;
    const r = maxR * Math.sqrt(i / count) * (0.85 + Math.sin(t * 0.3) * 0.15);
    _t.x = cx + Math.cos(angle) * r;
    _t.y = cy + Math.sin(angle) * r;
    return _t;
};

// Zen enso for Teajia
const patternTeajia: PatternFn = (p, i, count, width, height, time) => {
    const cx = width / 2;
    const cy = height / 2;
    const t = time * p.timeMul;
    const baseAngle = (i / count) * Math.PI * 2;
    const radius = Math.min(width, height) * 0.35;
    const gapCenter = Math.PI * 1.5;

    if (Math.abs(baseAngle - gapCenter) < 0.35) {
        const scatter = radius * 0.15 + Math.sin(t * 0.5 + i * 3) * radius * 0.08;
        _t.x = cx + Math.cos(baseAngle + t * 0.02) * (radius + scatter);
        _t.y = cy + Math.sin(baseAngle + t * 0.02) * (radius + scatter);
    } else {
        const thickness = Math.sin(baseAngle * 2 + t * 0.15) * 20;
        _t.x = cx + Math.cos(baseAngle + t * 0.02) * (radius + thickness);
        _t.y = cy + Math.sin(baseAngle + t * 0.02) * (radius + thickness);
    }
    return _t;
};

// Constellation clusters
const CLUSTER_POSITIONS: [number, number][] = [
    [0.15, 0.2], [0.85, 0.15], [0.5, 0.5],
    [0.2, 0.8], [0.8, 0.75], [0.35, 0.35], [0.7, 0.4],
];

const patternPiece: PatternFn = (p, i, count, width, height, time) => {
    const t = time * p.timeMul;
    const clusterCount = 7;
    const cluster = i % clusterCount;
    const [px, py] = CLUSTER_POSITIONS[cluster];
    const clusterCx = px * width;
    const clusterCy = py * height;
    const spread = Math.min(width, height) * 0.12;
    const starAngle = (Math.floor(i / clusterCount) / Math.max(1, Math.floor(count / clusterCount))) * Math.PI * 2;
    const breathe = 0.5 + Math.sin(t * 0.3 + cluster) * 0.25;
    _t.x = clusterCx + Math.cos(starAngle + t * 0.05) * spread * breathe;
    _t.y = clusterCy + Math.sin(starAngle + t * 0.05) * spread * breathe;
    return _t;
};

// Fallback orbital ring
const patternDefault: PatternFn = (p, i, count, width, height, time) => {
    const t = time * p.timeMul;
    const angle = (i / count) * Math.PI * 2;
    const r = Math.min(width, height) * 0.3 + Math.sin(t * 2 + i) * 50;
    _t.x = width / 2 + Math.cos(angle + t * 0.1) * r;
    _t.y = height / 2 + Math.sin(angle + t * 0.1) * r;
    return _t;
};

// ---- PATTERN RESOLVER ----

function getPattern(pathname: string): PatternFn {
    if (pathname === '/') return patternHome;
    if (pathname === '/creations') return patternCreations;
    if (pathname === '/writings') return patternWritings;
    if (pathname === '/shop') return patternShop;
    if (pathname === '/about') return patternAbout;
    if (pathname === '/inquire') return patternInquire;
    if (pathname === '/teajia') return patternTeajia;
    if (pathname.startsWith('/writings/')) return patternWritings;
    if (pathname.startsWith('/creations/')) return patternPiece;
    return patternDefault;
}

// Layer rendering constants
const LAYER_PARTICLE_ALPHA_LIGHT = [0.15, 0.25, 0.38] as const;
const LAYER_PARTICLE_ALPHA_DARK = [0.15, 0.25, 0.38] as const;
const LAYER_LINE_ALPHA_MUL = [0.06, 0.12, 0.2] as const;
const LAYER_LINE_WIDTH = [0.3, 0.5, 0.7] as const;
const LAYER_CONN_SCALE = [0.6, 1.0, 1.4] as const;

// ---- MAIN COMPONENT ----

const GenerativeBackground: React.FC<Props> = ({ pathname, theme }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particles = useRef<Particle[]>([]);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const frameRef = useRef(0);
    const timeRef = useRef(0);
    const resizeTimeoutRef = useRef<any>(null);
    const { isDarkMode } = useDarkMode();

    // Track previous pattern for morphing
    const prevPatternRef = useRef<PatternFn>(getPattern(pathname));
    const morphProgressRef = useRef(1);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const baseCount = window.innerWidth < 768 ? 65 : 120;

        // Create particles across 3 depth layers
        const layerDistribution = [0.25, 0.45, 0.3];
        const allParticles: Particle[] = [];
        layerDistribution.forEach((ratio, layer) => {
            const count = Math.round(baseCount * ratio);
            for (let j = 0; j < count; j++) {
                allParticles.push(new Particle(window.innerWidth, window.innerHeight, layer));
            }
        });
        particles.current = allParticles;

        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // When pathname changes, start a morph transition
    useEffect(() => {
        const newPattern = getPattern(pathname);
        const currentPattern = prevPatternRef.current;
        if (newPattern !== currentPattern) {
            prevPatternRef.current = currentPattern;
            morphProgressRef.current = 0;
        }
    }, [pathname]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const initCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        initCanvas();

        let width = canvas.width;
        let height = canvas.height;

        const handleResize = () => {
            if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current);
            resizeTimeoutRef.current = requestAnimationFrame(() => {
                if (canvas) {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                    width = canvas.width;
                    height = canvas.height;
                }
            });
        };
        window.addEventListener('resize', handleResize);

        const currentPattern = getPattern(pathname);
        const isHome = pathname === '/';
        const isCreations = pathname === '/creations';

        // Pause animation when tab is not visible (saves battery)
        let isVisible = !document.hidden;
        const handleVisibility = () => { isVisible = !document.hidden; };
        document.addEventListener('visibilitychange', handleVisibility);

        // Respect prefers-reduced-motion: skip animation entirely
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const animate = () => {
            timeRef.current += 0.005;

            if (!ctx || !canvas) return;

            // Skip all computation on home page (canvas is opacity: 0),
            // when tab is hidden, or when user prefers reduced motion
            if (isHome || !isVisible || prefersReducedMotion) {
                frameRef.current = requestAnimationFrame(animate);
                return;
            }

            // Advance morph progress (~2.8 seconds at 60fps)
            if (morphProgressRef.current < 1) {
                morphProgressRef.current = Math.min(1, morphProgressRef.current + 0.006);
            }

            ctx.clearRect(0, 0, width, height);

            const isDark = theme === 'DARK' || isDarkMode;
            const safeParticles = particles.current || [];
            const len = safeParticles.length;
            const time = timeRef.current;
            const morphT = morphProgressRef.current;
            const easedT = morphT < 0.5
                ? 4 * morphT * morphT * morphT
                : 1 - Math.pow(-2 * morphT + 2, 3) / 2;
            const isMorphing = easedT < 1;
            const prevPattern = prevPatternRef.current;
            const mx = mouseRef.current.x;
            const my = mouseRef.current.y;

            // --- Update all particle positions ---
            for (let i = 0; i < len; i++) {
                const p = safeParticles[i];
                const target = currentPattern(p, i, len, width, height, time);
                const tx = target.x;
                const ty = target.y;

                if (isMorphing) {
                    const prev = prevPattern(p, i, len, width, height, time);
                    p.targetX = prev.x + (tx - prev.x) * easedT;
                    p.targetY = prev.y + (ty - prev.y) * easedT;
                } else {
                    p.targetX = tx;
                    p.targetY = ty;
                }

                p.update(mx, my);
            }

            // --- Draw particles batched by layer ---
            for (let layer = 0; layer < 3; layer++) {
                const alpha = isDark
                    ? LAYER_PARTICLE_ALPHA_DARK[layer]
                    : LAYER_PARTICLE_ALPHA_LIGHT[layer];
                ctx.fillStyle = isDark
                    ? `rgba(176, 141, 85, ${alpha})`
                    : `rgba(90, 70, 50, ${alpha})`;

                ctx.beginPath();
                for (let i = 0; i < len; i++) {
                    const p = safeParticles[i];
                    if (p.layer !== layer) continue;
                    ctx.moveTo(p.x + p.radius, p.y);
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                }
                ctx.fill();
            }

            // --- Draw connections batched by layer pair ---
            const baseThreshold = isCreations ? 12000 : 18000;

            for (let layerMin = 0; layerMin < 3; layerMin++) {
                const threshold = baseThreshold * LAYER_CONN_SCALE[layerMin];
                const alphaMul = LAYER_LINE_ALPHA_MUL[layerMin];
                ctx.lineWidth = LAYER_LINE_WIDTH[layerMin];

                // Collect lines at a few alpha buckets to minimize strokeStyle changes
                // Use 4 alpha buckets: 0.25, 0.5, 0.75, 1.0 of the max alpha
                const buckets: [number, number, number, number][][] = [[], [], [], []];

                for (let i = 0; i < len; i++) {
                    const p1 = safeParticles[i];
                    const minL = Math.min(p1.layer, layerMin);
                    if (minL !== layerMin && p1.layer !== layerMin) continue;

                    for (let j = i + 1; j < len; j++) {
                        const p2 = safeParticles[j];
                        if (Math.abs(p1.layer - p2.layer) > 1) continue;
                        if (Math.min(p1.layer, p2.layer) !== layerMin) continue;

                        const dx = p1.x - p2.x;
                        const dy = p1.y - p2.y;
                        const distSq = dx * dx + dy * dy;

                        if (distSq < threshold) {
                            const alpha = (1 - distSq / threshold) * alphaMul;
                            // Bucket: 0-25%, 25-50%, 50-75%, 75-100%
                            const bucket = Math.min(3, (alpha / alphaMul * 4) | 0);
                            buckets[bucket].push(p1.x, p1.y, p2.x, p2.y);
                        }
                    }
                }

                // Draw each bucket as a single batched path
                for (let b = 0; b < 4; b++) {
                    const lines = buckets[b];
                    if (lines.length === 0) continue;

                    const bucketAlpha = ((b + 0.5) / 4) * alphaMul;
                    ctx.strokeStyle = isDark
                        ? `rgba(176, 141, 85, ${bucketAlpha})`
                        : `rgba(80, 65, 45, ${bucketAlpha})`;

                    ctx.beginPath();
                    for (let k = 0; k < lines.length; k += 4) {
                        ctx.moveTo(lines[k], lines[k + 1]);
                        ctx.lineTo(lines[k + 2], lines[k + 3]);
                    }
                    ctx.stroke();
                }
            }

            frameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('resize', handleResize);
            if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current);
            cancelAnimationFrame(frameRef.current);
        };
    }, [pathname, theme, isDarkMode]);

    const effectivelyDark = theme === 'DARK' || isDarkMode;

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000 ${pathname === '/' ? 'opacity-0' : 'opacity-100'}`}
            style={{ mixBlendMode: effectivelyDark ? 'screen' : 'multiply' }}
        />
    );
};

export default GenerativeBackground;


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

    constructor(w: number, h: number, layer: number) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.targetX = this.x;
        this.targetY = this.y;
        this.vx = 0;
        this.vy = 0;
        this.layer = layer;
    }

    // Layer-dependent size: visible on all layers
    get radius(): number {
        return this.layer === 0 ? 1.2 : this.layer === 1 ? 2.0 : 3.0;
    }

    // Layer-dependent spring speed: far layers are slower, near are snappier
    get spring(): number {
        return this.layer === 0 ? 0.003 : this.layer === 1 ? 0.006 : 0.01;
    }

    get damping(): number {
        return this.layer === 0 ? 0.93 : this.layer === 1 ? 0.90 : 0.86;
    }

    // Layer-dependent time multiplier for parallax-like drift
    get timeMul(): number {
        return this.layer === 0 ? 0.4 : this.layer === 1 ? 1.0 : 1.5;
    }

    update(width: number, height: number, mouseX: number, mouseY: number) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;

        this.vx += dx * this.spring;
        this.vy += dy * this.spring;
        this.vx *= this.damping;
        this.vy *= this.damping;

        const mDx = this.x - mouseX;
        const mDy = this.y - mouseY;
        const dist = Math.sqrt(mDx * mDx + mDy * mDy);

        // Near particles react more strongly to the mouse
        const mouseRadius = 150 + this.layer * 50;
        const mouseForce = 0.3 + this.layer * 0.2;

        if (dist < mouseRadius) {
            const force = (mouseRadius - dist) / mouseRadius;
            this.vx += (mDx / dist) * force * mouseForce;
            this.vy += (mDy / dist) * force * mouseForce;
        }

        this.x += this.vx;
        this.y += this.vy;
    }
}

type PatternFn = (
    p: Particle,
    i: number,
    count: number,
    width: number,
    height: number,
    time: number
) => { x: number; y: number };

// ---- PAGE-SPECIFIC PATTERN FUNCTIONS ----

const patternHome: PatternFn = (p, _i, _count, _w, _h, time) => ({
    x: p.x + Math.sin(time + _i) * 0.3,
    y: p.y + Math.cos(time + _i) * 0.3,
});

const patternCreations: PatternFn = (p, i, _count, width, _height, time) => {
    const spacing = 120;
    const cols = Math.ceil(width / spacing) + 2;
    const row = Math.floor(i / cols);
    const col = i % cols;
    const xOffset = (row % 2) * (spacing / 2);
    const t = time * p.timeMul;
    return {
        x: col * spacing + xOffset - 50 + Math.sin(t + row) * 12,
        y: row * spacing * 0.866 - 50 + Math.cos(t + col) * 12,
    };
};

const patternWritings: PatternFn = (p, i, count, width, height, time) => {
    const sSpace = width / Math.max(1, count);
    const t = time * p.timeMul;
    const wave1 = Math.sin(i * 0.1 + t) * 120;
    const wave2 = Math.cos(i * 0.05 - t * 0.5) * 180;
    return {
        x: i * sSpace,
        y: height / 2 + wave1 + wave2,
    };
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
    const rotatedX = x * Math.cos(t * 0.2) - z * Math.sin(t * 0.2);
    return { x: cx + rotatedX, y: cy + y };
};

// Flower of Life: overlapping circles in hexagonal symmetry, spread across viewport
const patternAbout: PatternFn = (p, i, count, width, height, time) => {
    const cx = width / 2;
    const cy = height / 2;
    const t = time * p.timeMul;

    // 7 overlapping circles (1 center + 6 petals), scaled to fill viewport
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
    return {
        x: centerX + Math.cos(angleInCircle + t * 0.06) * orbitR,
        y: centerY + Math.sin(angleInCircle + t * 0.06) * orbitR,
    };
};

// Golden spiral for Inquire, filling the viewport
const patternInquire: PatternFn = (p, i, count, width, height, time) => {
    const cx = width / 2;
    const cy = height / 2;
    const t = time * p.timeMul;

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const angle = i * goldenAngle + t * 0.04;
    const maxR = Math.min(width, height) * 0.45;
    const r = maxR * Math.sqrt(i / count) * (0.85 + Math.sin(t * 0.3) * 0.15);

    return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
    };
};

// Zen enso for Teajia, larger and more prominent
const patternTeajia: PatternFn = (p, i, count, width, height, time) => {
    const cx = width / 2;
    const cy = height / 2;
    const t = time * p.timeMul;

    const baseAngle = (i / count) * Math.PI * 2;
    const radius = Math.min(width, height) * 0.35;

    // Deliberate gap for zen imperfection
    const gapCenter = Math.PI * 1.5;
    const gapWidth = 0.35;
    if (Math.abs(baseAngle - gapCenter) < gapWidth) {
        // Particles in the gap scatter outward gently
        const scatter = radius * 0.15 + Math.sin(t * 0.5 + i * 3) * radius * 0.08;
        return {
            x: cx + Math.cos(baseAngle + t * 0.02) * (radius + scatter),
            y: cy + Math.sin(baseAngle + t * 0.02) * (radius + scatter),
        };
    }

    // Brush-stroke thickness variation
    const thickness = Math.sin(baseAngle * 2 + t * 0.15) * 20;
    return {
        x: cx + Math.cos(baseAngle + t * 0.02) * (radius + thickness),
        y: cy + Math.sin(baseAngle + t * 0.02) * (radius + thickness),
    };
};

// Constellation clusters spread across the full viewport
const patternPiece: PatternFn = (p, i, count, width, height, time) => {
    const t = time * p.timeMul;

    // Spread clusters across the viewport with generous spacing
    const clusterCount = 7;
    const cluster = i % clusterCount;

    // Deterministic positions spread across the viewport
    const positions = [
        [0.15, 0.2], [0.85, 0.15], [0.5, 0.5],
        [0.2, 0.8], [0.8, 0.75], [0.35, 0.35], [0.7, 0.4],
    ];
    const [px, py] = positions[cluster];
    const clusterCx = px * width;
    const clusterCy = py * height;
    const spread = Math.min(width, height) * 0.12;
    const posInCluster = Math.floor(i / clusterCount);
    const totalInCluster = Math.max(1, Math.floor(count / clusterCount));
    const starAngle = (posInCluster / totalInCluster) * Math.PI * 2;

    const breathe = 0.5 + Math.sin(t * 0.3 + cluster) * 0.25;
    return {
        x: clusterCx + Math.cos(starAngle + t * 0.05) * spread * breathe,
        y: clusterCy + Math.sin(starAngle + t * 0.05) * spread * breathe,
    };
};

// Fallback orbital ring
const patternDefault: PatternFn = (p, i, count, width, height, time) => {
    const t = time * p.timeMul;
    const angle = (i / count) * Math.PI * 2;
    const r = Math.min(width, height) * 0.3 + Math.sin(t * 2 + i) * 50;
    return {
        x: width / 2 + Math.cos(angle + t * 0.1) * r,
        y: height / 2 + Math.sin(angle + t * 0.1) * r,
    };
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
    const morphProgressRef = useRef(1); // 1 = fully transitioned

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // More particles for a richer mesh
        const baseCount = window.innerWidth < 768 ? 80 : 140;

        // Create particles across 3 depth layers
        const layerDistribution = [0.25, 0.45, 0.3]; // 25% far, 45% mid, 30% near
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

        const animate = () => {
            timeRef.current += 0.005;

            if (!ctx || !canvas) return;

            // Advance morph progress (~2.8 seconds at 60fps)
            if (morphProgressRef.current < 1) {
                morphProgressRef.current = Math.min(1, morphProgressRef.current + 0.006);
            }

            ctx.clearRect(0, 0, width, height);

            const isDark = theme === 'DARK' || isDarkMode;
            const safeParticles = particles.current || [];
            const time = timeRef.current;
            const morphT = morphProgressRef.current;
            // Smooth ease-in-out
            const easedT = morphT < 0.5
                ? 4 * morphT * morphT * morphT
                : 1 - Math.pow(-2 * morphT + 2, 3) / 2;

            const prevPattern = prevPatternRef.current;

            // --- Draw particles ---
            safeParticles.forEach((p, i) => {
                const target = currentPattern(p, i, safeParticles.length, width, height, time);

                if (easedT < 1) {
                    const prev = prevPattern(p, i, safeParticles.length, width, height, time);
                    p.targetX = prev.x + (target.x - prev.x) * easedT;
                    p.targetY = prev.y + (target.y - prev.y) * easedT;
                } else {
                    p.targetX = target.x;
                    p.targetY = target.y;
                }

                p.update(width, height, mouseRef.current.x, mouseRef.current.y);

                // Layer-dependent opacity: clearly visible on all layers
                const layerAlpha = p.layer === 0 ? 0.25 : p.layer === 1 ? 0.4 : 0.55;
                ctx.fillStyle = isDark
                    ? `rgba(176, 141, 85, ${layerAlpha})`
                    : `rgba(90, 70, 50, ${layerAlpha})`;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            });

            // --- Draw connections ---
            // Generous thresholds so the mesh is actually visible
            const baseThreshold = isCreations ? 18000 : 25000;

            for (let i = 0; i < safeParticles.length; i++) {
                for (let j = i + 1; j < safeParticles.length; j++) {
                    const p1 = safeParticles[i];
                    const p2 = safeParticles[j];

                    // Connect same layer or adjacent layers
                    if (Math.abs(p1.layer - p2.layer) > 1) continue;

                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distSq = dx * dx + dy * dy;

                    const layerMin = Math.min(p1.layer, p2.layer);
                    const layerScale = layerMin === 0 ? 0.6 : layerMin === 1 ? 1.0 : 1.4;
                    const threshold = baseThreshold * layerScale;

                    if (distSq < threshold) {
                        const alpha = 1 - distSq / threshold;
                        // Visible line opacities
                        const lineAlpha = layerMin === 0
                            ? alpha * 0.12
                            : layerMin === 1
                                ? alpha * 0.22
                                : alpha * 0.35;

                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = isDark
                            ? `rgba(176, 141, 85, ${lineAlpha})`
                            : `rgba(70, 55, 40, ${lineAlpha})`;
                        ctx.lineWidth = layerMin === 0 ? 0.4 : layerMin === 1 ? 0.6 : 0.9;
                        ctx.stroke();
                    }
                }
            }

            frameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current);
            cancelAnimationFrame(frameRef.current);
        };
    }, [pathname, theme, isDarkMode]);

    const effectivelyDark = theme === 'DARK' || isDarkMode;

    return (
        <canvas
            ref={canvasRef}
            className={`fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000 ${pathname === '/' ? 'opacity-0' : 'opacity-100'}`}
            style={{ mixBlendMode: effectivelyDark ? 'screen' : 'multiply' }}
        />
    );
};

export default GenerativeBackground;

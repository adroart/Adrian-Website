
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

// Oracle: 64-point Fibonacci sphere. Holographic-globe aesthetic — points
// distributed by golden-angle on a unit sphere, then rotated as a rigid 3D
// body. Proximity lines auto-draw the geodesic facets from every angle,
// giving the figure an unmistakable sphere read with constant new structure
// as it turns. Particles past 64 stack on slots with a tiny halo so the
// proximity graph stays dense.
const FIB_POINTS: [number, number, number][] = (() => {
    const N = 64;
    const golden = Math.PI * (3 - Math.sqrt(5)); // golden angle in radians
    const pts: [number, number, number][] = [];
    for (let i = 0; i < N; i++) {
        // y from 1 to -1, evenly spaced.
        const y = 1 - (i / (N - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const theta = i * golden;
        pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
    }
    return pts;
})();

// Per-particle z-depth from the previous frame, used by the outer renderer to
// modulate dot radius and alpha so far-side points dim and shrink. Lives at
// module scope so the render loop can read it without re-projecting.
const ORACLE_DEPTH = new Float32Array(256);
const ORACLE_DEPTH_VALID = { current: false };

// Per-slot radial scale. Bit count of the slot index (0..6) maps to a shell:
// pure-yin (0 bits) sits at 0.55×, pure-yang (6 bits) at 1.0×. Creates a
// lumpy sphere with concentric-shell structure that reads as 3D sculpture.
const ORACLE_SHELL: number[] = (() => {
    const out: number[] = [];
    for (let i = 0; i < 64; i++) {
        let n = i, c = 0;
        while (n) { c += n & 1; n >>= 1; }
        out.push(0.55 + (c / 6) * 0.45); // 0.55 .. 1.0
    }
    return out;
})();

const patternOracle: PatternFn = (p, i, _count, width, height, time) => {
    const cx = width / 2;
    const cy = height / 2;
    const t = time;

    const slot = i % 64;
    const dup = Math.floor(i / 64);
    const [fpx, fpy, fpz] = FIB_POINTS[slot];

    // Apply the per-slot radial shell to make the sphere lumpy/structured.
    const shell = ORACLE_SHELL[slot];
    const px = fpx * shell;
    const py = fpy * shell;
    const pz = fpz * shell;

    // Single-body rotation with PRECESSION: the rotation axis itself slowly
    // traces a cone, so the figure reads as a gimballed/gyroscopic 3D object
    // rather than a simple spinning ball.
    //
    // Precession: tilt the body by `precessTilt` radians, then rotate that
    // tilt direction around the world Y at a slow rate. Then spin the body
    // around its own (tilted) axis at the primary rate.
    const spin = t * 0.22;
    const precessRate = t * 0.07;       // axis cone traversal rate
    const precessTilt = 0.45;            // cone half-angle (radians)

    // Body-local spin around its own axis (which we'll call Y' before tilting).
    const cs = Math.cos(spin), ss = Math.sin(spin);
    let x1 = px * cs + pz * ss;
    let z1 = -px * ss + pz * cs;
    let y1 = py;

    // Tilt the body so its Y' axis sits at angle `precessTilt` from world Y.
    const ct = Math.cos(precessTilt), st = Math.sin(precessTilt);
    const y2 = y1 * ct - z1 * st;
    const z2 = y1 * st + z1 * ct;
    const x2 = x1;

    // Sweep the tilt direction around world Y at the precession rate.
    const cp = Math.cos(precessRate), sp = Math.sin(precessRate);
    const x3 = x2 * cp + z2 * sp;
    const z3 = -x2 * sp + z2 * cp;
    const y3 = y2;

    // Perspective projection.
    const baseR = Math.min(width, height) * 0.34;
    const camZ = 3;
    const persp = camZ / (camZ - z3);
    const sx2 = x3 * baseR * persp;
    const sy2 = y3 * baseR * persp;

    // Cache normalized depth for the dot renderer.
    if (i < ORACLE_DEPTH.length) {
        ORACLE_DEPTH[i] = z3;
        ORACLE_DEPTH_VALID.current = true;
    }

    // Halo for duplicate particles — small so chord lines stay clean.
    const haloR = dup * 2.0;
    const haloAng = i * 2.3998 + t * 0.6;

    _t.x = cx + sx2 + Math.cos(haloAng) * haloR;
    _t.y = cy + sy2 + Math.sin(haloAng) * haloR;
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
    if (pathname.startsWith('/oracle')) return patternOracle;
    if (pathname.startsWith('/writings/')) return patternWritings;
    if (pathname.startsWith('/creations/')) return patternPiece;
    return patternDefault;
}

// Layer rendering constants
const LAYER_PARTICLE_ALPHA_LIGHT = [0.10, 0.16, 0.24] as const;
const LAYER_PARTICLE_ALPHA_DARK = [0.15, 0.25, 0.38] as const;
const LAYER_LINE_ALPHA_MUL = [0.04, 0.08, 0.13] as const;
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
        const isOracle = pathname.startsWith('/oracle');

        // Respect prefers-reduced-motion: skip animation entirely
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // isRunning guard - prevents double-starting the rAF loop
        const isRunning = { current: false };

        const animate = () => {
            timeRef.current += 0.005;

            if (!ctx || !canvas) return;

            // Skip rendering on home page (canvas is opacity: 0)
            // but still advance the frame so morph state is preserved
            if (!isHome && !prefersReducedMotion) {
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
                if (isOracle && ORACLE_DEPTH_VALID.current) {
                    const baseColor = isDark ? '176, 141, 85' : '90, 70, 50';
                    const bands = 4;
                    const bandPaths: { r: number; alpha: number }[] = [];
                    for (let b = 0; b < bands; b++) {
                        bandPaths.push({
                            r: 0.55 + (b / (bands - 1)) * 1.65, // 0.55 .. 2.2
                            alpha: 0.06 + (b / (bands - 1)) * 0.42, // 0.06 .. 0.48
                        });
                    }
                    for (let b = 0; b < bands; b++) {
                        const { r, alpha } = bandPaths[b];
                        ctx.fillStyle = `rgba(${baseColor}, ${alpha})`;
                        ctx.beginPath();
                        for (let i = 0; i < len; i++) {
                            const p = safeParticles[i];
                            const z = i < ORACLE_DEPTH.length ? ORACLE_DEPTH[i] : 0;
                            // Map z [-1,1] to brightness [0,1] (front bright).
                            const bright = (z + 1) * 0.5;
                            const myBand = Math.min(bands - 1, (bright * bands) | 0);
                            if (myBand !== b) continue;
                            ctx.moveTo(p.x + r, p.y);
                            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                        }
                        ctx.fill();
                    }
                } else {
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
                }

                // --- Draw connections batched by layer pair ---
                const baseThreshold = isCreations ? 12000 : 18000;

                for (let layerMin = 0; layerMin < 3; layerMin++) {
                    const threshold = baseThreshold * LAYER_CONN_SCALE[layerMin];
                    const alphaMul = LAYER_LINE_ALPHA_MUL[layerMin];
                    ctx.lineWidth = LAYER_LINE_WIDTH[layerMin];

                    // Collect lines at a few alpha buckets to minimize strokeStyle changes
                    // Use 4 alpha buckets: 0.25, 0.5, 0.75, 1.0 of the max alpha
                    const buckets: number[][] = [[], [], [], []];

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
            }

            frameRef.current = requestAnimationFrame(animate);
        };

        const startLoop = () => {
            if (isRunning.current) return;
            isRunning.current = true;
            frameRef.current = requestAnimationFrame(animate);
        };

        const stopLoop = () => {
            isRunning.current = false;
            cancelAnimationFrame(frameRef.current);
        };

        // Page Visibility API - fully cancel rAF when tab is hidden
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopLoop();
            } else {
                startLoop();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // IntersectionObserver - pause when canvas scrolls off screen
        // (guards against future layout changes where canvas is not fixed)
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting) {
                    startLoop();
                } else {
                    stopLoop();
                }
            },
            { threshold: 0 }
        );
        observer.observe(canvas);

        // Start the loop (unless tab is already hidden at mount time)
        if (!document.hidden) {
            startLoop();
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            observer.disconnect();
            window.removeEventListener('resize', handleResize);
            if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current);
            stopLoop();
        };
    }, [pathname, theme, isDarkMode]);

    const effectivelyDark = theme === 'DARK' || isDarkMode;

    function pageOpacity(p: string): string {
        if (p === '/') return 'opacity-0';
        if (p === '/creations') return 'opacity-50 md:opacity-80';
        if (p.startsWith('/oracle')) return 'opacity-35 md:opacity-60';
        if (p === '/writings' || p.startsWith('/writings/')) return 'opacity-55 md:opacity-90';
        if (p === '/inquire') return 'opacity-60 md:opacity-95';
        return 'opacity-45 md:opacity-75';
    }

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000 ${pageOpacity(pathname)}`}
            style={{ mixBlendMode: effectivelyDark ? 'screen' : 'multiply' }}
        />
    );
};

export default GenerativeBackground;

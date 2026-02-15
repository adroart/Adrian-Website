
import React, { useEffect, useRef } from 'react';
import { View } from '../types';

interface Props {
    currentView: View;
    theme: 'LIGHT' | 'DARK';
}

class Particle {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    vx: number;
    vy: number;
    
    constructor(w: number, h: number) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.targetX = this.x;
        this.targetY = this.y;
        this.vx = 0;
        this.vy = 0;
    }

    update(width: number, height: number, mouseX: number, mouseY: number) {
        // Ease towards target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        
        this.vx += dx * 0.005;
        this.vy += dy * 0.005;
        this.vx *= 0.90; // friction
        this.vy *= 0.90;

        // Mouse Interaction (Repulsion)
        const mDx = this.x - mouseX;
        const mDy = this.y - mouseY;
        const dist = Math.sqrt(mDx * mDx + mDy * mDy);
        
        if (dist < 200) {
            const force = (200 - dist) / 200;
            this.vx += (mDx / dist) * force * 0.5;
            this.vy += (mDy / dist) * force * 0.5;
        }

        this.x += this.vx;
        this.y += this.vy;
    }
}

const GenerativeBackground: React.FC<Props> = ({ currentView, theme }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particles = useRef<Particle[]>([]);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const frameRef = useRef(0);
    const timeRef = useRef(0);

    // Initialize Particles
    useEffect(() => {
        const count = window.innerWidth < 768 ? 60 : 110; // Fewer particles on mobile
        particles.current = Array.from({ length: count }).map(() => new Particle(window.innerWidth, window.innerHeight));
        
        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Main Animation Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        const animate = () => {
            timeRef.current += 0.005;
            ctx.clearRect(0, 0, width, height);

            // Set Styles based on Theme
            const isDark = theme === 'DARK';
            ctx.strokeStyle = isDark ? 'rgba(176, 141, 85, 0.15)' : 'rgba(100, 80, 60, 0.08)';
            ctx.fillStyle = isDark ? 'rgba(176, 141, 85, 0.3)' : 'rgba(100, 80, 60, 0.2)';
            ctx.lineWidth = 0.5;

            // 1. CALCULATE TARGETS BASED ON VIEW
            particles.current.forEach((p, i) => {
                const aspect = width / height;
                
                if (currentView === View.ART || currentView === View.COLLECTION) {
                    // Mode: HEXAGONAL LATTICE (Structure)
                    // Arrange in a honeycomb grid
                    const spacing = 120;
                    const cols = Math.ceil(width / spacing) + 2;
                    const row = Math.floor(i / cols);
                    const col = i % cols;
                    const xOffset = (row % 2) * (spacing / 2);
                    
                    p.targetX = (col * spacing) + xOffset - 50 + Math.sin(timeRef.current + row) * 10;
                    p.targetY = (row * spacing * 0.866) - 50 + Math.cos(timeRef.current + col) * 10;
                
                } else if (currentView === View.STORIES) {
                    // Mode: SINE WAVES (Flow)
                    const spacing = width / particles.current.length;
                    p.targetX = i * spacing;
                    // Multiple sine waves layered
                    const wave1 = Math.sin(i * 0.1 + timeRef.current) * 100;
                    const wave2 = Math.cos(i * 0.05 - timeRef.current * 0.5) * 200;
                    p.targetY = (height / 2) + wave1 + wave2;

                } else if (currentView === View.SHOP || currentView === View.JEWELRY) {
                    // Mode: ROTATING SPHERE PROJECTION (Object)
                    const radius = Math.min(width, height) * 0.35;
                    const cx = width / 2;
                    const cy = height / 2;
                    
                    // Golden Angle distribution projected onto rotating sphere
                    const phi = Math.acos( -1 + ( 2 * i ) / particles.current.length );
                    const theta = Math.sqrt( particles.current.length * Math.PI ) * phi;
                    
                    // Rotate the sphere coordinates
                    const rotX = Math.cos(timeRef.current * 0.5);
                    const rotZ = Math.sin(timeRef.current * 0.5);

                    // Simple 3D projection logic (just x/y)
                    const x = radius * Math.sin(phi) * Math.cos(theta + timeRef.current);
                    const y = radius * Math.sin(phi) * Math.sin(theta + timeRef.current);
                    const z = radius * Math.cos(phi);
                    
                    // 3D Rotation around Y axis
                    const rotatedX = x * Math.cos(timeRef.current * 0.2) - z * Math.sin(timeRef.current * 0.2);
                    // const rotatedZ = x * Math.sin(timeRef.current * 0.2) + z * Math.cos(timeRef.current * 0.2);

                    p.targetX = cx + rotatedX;
                    p.targetY = cy + y; // Keep y relatively stable but moving with sphere

                } else if (currentView === View.ORACLE) {
                    // Mode: CONCENTRIC RINGS (Targeting)
                    const cx = width / 2;
                    const cy = height / 2;
                    const ringCount = 5;
                    const ringIndex = i % ringCount;
                    const radius = (ringIndex + 1) * 80;
                    const angle = timeRef.current * (ringIndex % 2 === 0 ? 0.5 : -0.5) + i;
                    
                    p.targetX = cx + Math.cos(angle) * radius;
                    p.targetY = cy + Math.sin(angle) * radius;

                } else if (currentView === View.HOME) {
                    // Mode: DORMANT / CHAOS (Let Hero take over, but keep subtle movement)
                    // Just slow drift
                    p.targetX = p.x + Math.sin(timeRef.current + i) * 0.5;
                    p.targetY = p.y + Math.cos(timeRef.current + i) * 0.5;
                } else {
                    // Mode: STUDIO (Network)
                     const angle = (i / particles.current.length) * Math.PI * 2;
                     const r = 300 + Math.sin(timeRef.current * 2 + i) * 50;
                     p.targetX = (width/2) + Math.cos(angle + timeRef.current * 0.1) * r;
                     p.targetY = (height/2) + Math.sin(angle + timeRef.current * 0.1) * r;
                }

                p.update(width, height, mouseRef.current.x, mouseRef.current.y);
                
                // Draw Point
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            });

            // 2. DRAW CONNECTIONS
            // Optimized: Only compare nearby indices to save perf (assuming some spatial coherence in array)
            // Actually, purely distance based O(N^2) is fine for N=100
            for (let i = 0; i < particles.current.length; i++) {
                for (let j = i + 1; j < particles.current.length; j++) {
                    const p1 = particles.current[i];
                    const p2 = particles.current[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distSq = dx*dx + dy*dy;

                    // Connection threshold (squared)
                    const threshold = currentView === View.ART ? 15000 : 20000;

                    if (distSq < threshold) {
                        const alpha = 1 - (distSq / threshold);
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = isDark 
                            ? `rgba(176, 141, 85, ${alpha * 0.2})` 
                            : `rgba(60, 50, 40, ${alpha * 0.1})`;
                        ctx.stroke();
                    }
                }
            }

            frameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(frameRef.current);
        };
    }, [currentView, theme]);

    return (
        <canvas 
            ref={canvasRef}
            className={`fixed inset-0 z-[1] pointer-events-none transition-opacity duration-1000 ${currentView === View.HOME ? 'opacity-0' : 'opacity-100'}`}
            style={{ mixBlendMode: theme === 'DARK' ? 'screen' : 'multiply' }}
        />
    );
};

export default GenerativeBackground;

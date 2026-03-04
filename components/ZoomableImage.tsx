import React, { useState, useRef } from 'react';

interface ZoomableImageProps {
    src: string;
    alt: string;
}

const ZoomableImage: React.FC<ZoomableImageProps> = ({ src, alt }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);

    const lastPos = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });

    const handleStart = (clientX: number, clientY: number) => {
        startPos.current = { x: clientX, y: clientY };
        lastPos.current = { x: clientX, y: clientY };
        setDragging(true);
    };

    const handleMove = (clientX: number, clientY: number) => {
        if (!dragging) return;
        if (scale > 1) {
            const dx = clientX - lastPos.current.x;
            const dy = clientY - lastPos.current.y;
            setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastPos.current = { x: clientX, y: clientY };
        }
    };

    const toggleZoom = () => {
        if (scale > 1) {
            setScale(1);
            setPosition({ x: 0, y: 0 });
        } else {
            setScale(2.5);
        }
    };

    return (
        <div
            className={`relative w-full h-full flex items-center justify-center overflow-hidden touch-none ${scale > 1 ? 'cursor-move' : 'cursor-zoom-in'}`}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            onTouchStart={(e) => e.touches.length === 1 && handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={(e) => e.touches.length === 1 && handleMove(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={() => setDragging(false)}
            onClick={(e) => {
                if (Math.abs(e.clientX - startPos.current.x) < 5 && Math.abs(e.clientY - startPos.current.y) < 5) {
                    toggleZoom();
                }
            }}
        >
            <img
                src={src}
                alt={alt}
                className="max-w-full max-h-full object-contain transition-transform duration-300 ease-out select-none pointer-events-none"
                style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
                draggable={false}
            />
        </div>
    );
};

export default ZoomableImage;

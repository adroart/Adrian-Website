import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import ZoomableImage from './ZoomableImage';

interface VisualLightboxProps {
    images: string[];
    initialIndex?: number;
    onClose: () => void;
}

const VisualLightbox: React.FC<VisualLightboxProps> = ({ images, initialIndex = 0, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const hasMultiple = images.length > 1;

    const goPrev = useCallback(() => {
        setCurrentIndex(i => Math.max(0, i - 1));
    }, []);

    const goNext = useCallback(() => {
        setCurrentIndex(i => Math.min(images.length - 1, i + 1));
    }, [images.length]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') goPrev();
            if (e.key === 'ArrowRight') goNext();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose, goPrev, goNext]);

    if (typeof document === 'undefined' || !document.body) return null;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Image detail view"
            className="fixed inset-0 z-[9999] bg-paper-50 flex flex-col animate-fade-in"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="w-full h-16 flex items-center justify-between px-6 bg-paper-50 border-b border-wood-200 z-50 shrink-0">
                <button
                    onClick={onClose}
                    className="group flex items-center gap-2 text-wood-600 hover:text-wood-900 px-4 py-2 rounded-full transition-colors"
                >
                    <ArrowLeft size={16} />
                    <span className="font-label text-xs uppercase tracking-[0.2em] font-semibold">Close</span>
                </button>
                {hasMultiple && (
                    <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-400 font-semibold">
                        {currentIndex + 1} of {images.length}
                    </span>
                )}
            </div>
            <div className="flex-1 flex items-center justify-center p-0 md:p-8 overflow-hidden bg-wood-100/50 relative">
                {hasMultiple && currentIndex > 0 && (
                    <button
                        onClick={goPrev}
                        className="absolute left-4 z-10 p-3 bg-paper-50/80 hover:bg-paper-50 text-wood-600 hover:text-wood-900 rounded-full transition-colors shadow-sm"
                        aria-label="Previous image"
                    >
                        <ChevronLeft size={20} />
                    </button>
                )}
                <ZoomableImage src={images[currentIndex]} alt="Detail" />
                {hasMultiple && currentIndex < images.length - 1 && (
                    <button
                        onClick={goNext}
                        className="absolute right-4 z-10 p-3 bg-paper-50/80 hover:bg-paper-50 text-wood-600 hover:text-wood-900 rounded-full transition-colors shadow-sm"
                        aria-label="Next image"
                    >
                        <ChevronRight size={20} />
                    </button>
                )}
            </div>
        </div>,
        document.body
    );
};

export default VisualLightbox;

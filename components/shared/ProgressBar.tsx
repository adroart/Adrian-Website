
import React from 'react';
import { useScrollProgress } from '../../hooks/useScrollProgress';

/** Fixed reading-progress bar at the top of the page. */
const ProgressBar: React.FC = () => {
    const pct = useScrollProgress();
    return (
        <div className="fixed top-0 left-0 w-full h-[2px] z-50 pointer-events-none">
            <div className="h-full bg-bronze-400 transition-[width] duration-100 ease-out" style={{ width: `${pct}%` }} />
        </div>
    );
};

export default ProgressBar;

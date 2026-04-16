
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface DarkModeContextType {
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

const DarkModeContext = createContext<DarkModeContextType>({
    isDarkMode: false,
    toggleDarkMode: () => {},
});

export const useDarkMode = () => useContext(DarkModeContext);

export const DarkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window === 'undefined') return true;
        const stored = localStorage.getItem('dark-mode');
        if (stored !== null) return stored === 'true';
        return true; // Default to dark mode for new visitors
    });

    useEffect(() => {
        const root = document.documentElement;
        if (isDarkMode) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('dark-mode', String(isDarkMode));

        // Keep the mobile browser chrome (Safari URL bar, Chrome address bar)
        // tinted to match the nav, so there's no visible strip above the top bar
        // when theme-color differs from the page background.
        const themeColor = isDarkMode ? '#141210' : '#f5f4f0';
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'theme-color');
            document.head.appendChild(meta);
        }
        meta.setAttribute('content', themeColor);
    }, [isDarkMode]);

    const toggleDarkMode = useCallback(() => {
        setIsDarkMode(prev => !prev);
    }, []);

    return (
        <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
            {children}
        </DarkModeContext.Provider>
    );
};

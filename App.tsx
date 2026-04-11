
import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useSeoMeta } from './useSeoMeta';
import { CartProvider } from './CartContext';
import { DarkModeProvider, useDarkMode } from './DarkModeContext';
import Navigation from './components/Navigation';
import CartDrawer from './components/CartDrawer';
import Home from './components/Home';
import Hero from './components/Hero';
import Creations from './components/Creations';
import Writings, { WritingArticle } from './components/Writings';
import About from './components/About';
import Inquire from './components/Inquire';
import Store from './components/Store';
import PiecePage from './components/PiecePage';
import MultidimensionalArt from './components/MultidimensionalArt';
import SubcategoryPage from './components/SubcategoryPage';
import IlluminatedWorks from './components/IlluminatedWorks';
import OracleCards from './components/OracleCards';
import UniversalLanguageIndex from './components/UniversalLanguageIndex';
import Welcome from './components/Welcome';
import NotFound from './components/NotFound';
import PrivacyPolicy from './components/PrivacyPolicy';
import Terms from './components/Terms';
import Shopping from './components/Shopping';
import Footer from './components/Footer';
import GenerativeBackground from './components/GenerativeBackground';

const AppInner: React.FC = () => {
  const location = useLocation();
  const { isDarkMode } = useDarkMode();

  useSeoMeta(location.pathname);

  // #2 Global scroll-to-top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const isHome = location.pathname === '/';
  const isWelcome = location.pathname === '/welcome';
  const isShopping = location.pathname === '/shopping';
  // Keep theme route-based — CSS variable remapping handles dark mode visuals.
  // GenerativeBackground reads isDarkMode separately for canvas colors.
  const theme = isHome ? 'DARK' : 'LIGHT';

  return (
    <div className="min-h-screen bg-paper-50 text-wood-900 selection:bg-bronze-200 transition-colors duration-500">
      {!isShopping && <GenerativeBackground pathname={location.pathname} theme={theme} />}
      {!isWelcome && !isShopping && <Navigation theme={theme} />}

      <main id="main-content">
        <Routes>
          <Route path="/" element={<><Hero /><Home /></>} />

          {/* Creations — static routes must come before /:id catch-all */}
          <Route path="/creations" element={<Creations />} />
          <Route path="/creations/illuminated-works" element={<IlluminatedWorks />} />
          <Route path="/creations/oracle-cards/universal-language" element={<UniversalLanguageIndex />} />
          <Route path="/creations/oracle-cards" element={<OracleCards />} />
          <Route path="/creations/multidimensional-art" element={<MultidimensionalArt />} />
          <Route path="/creations/multidimensional-art/:subcategory" element={<SubcategoryPage />} />
          <Route path="/creations/:id" element={<PiecePage />} />

          <Route path="/writings" element={<Writings />} />
          <Route path="/writings/:slug" element={<WritingArticle />} />
          <Route path="/about" element={<About />} />
          <Route path="/inquire" element={<Inquire />} />
          <Route path="/shop" element={<Store />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/shopping" element={<Shopping />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {!isWelcome && !isShopping && <Footer />}
      <CartDrawer />
    </div>
  );
};

const App: React.FC = () => (
  <DarkModeProvider>
    <CartProvider>
      <AppInner />
    </CartProvider>
  </DarkModeProvider>
);

export default App;

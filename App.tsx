
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useSeoMeta } from './useSeoMeta';
import Navigation from './components/Navigation';
import Home from './components/Home';
import Hero from './components/Hero';
import Creations from './components/Creations';
import Writings from './components/Writings';
import About from './components/About';
import Inquire from './components/Inquire';
import Store from './components/Store';
import PiecePage from './components/PiecePage';
import SeriesPage from './components/SeriesPage';
import Welcome from './components/Welcome';
import PrivacyPolicy from './components/PrivacyPolicy';
import Terms from './components/Terms';
import Footer from './components/Footer';
import GenerativeBackground from './components/GenerativeBackground';

const App: React.FC = () => {
  const location = useLocation();

  useSeoMeta(location.pathname);

  const isHome = location.pathname === '/';
  const isWelcome = location.pathname === '/welcome';
  const theme = isHome ? 'DARK' : 'LIGHT';

  return (
    <div className="min-h-screen bg-paper-50 selection:bg-bronze-200">
      <GenerativeBackground pathname={location.pathname} theme={theme} />
      {!isWelcome && <Navigation theme={theme} />}

      <main>
        <Routes>
          <Route path="/" element={<><Hero /><Home /></>} />
          <Route path="/creations" element={<Creations />} />
          <Route path="/creations/:id" element={<PiecePage />} />
          <Route path="/series/:slug" element={<SeriesPage />} />
          <Route path="/writings" element={<Writings />} />
          <Route path="/about" element={<About />} />
          <Route path="/inquire" element={<Inquire />} />
          <Route path="/shop" element={<Store />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<><Hero /><Home /></>} />
        </Routes>
      </main>

      {!isWelcome && <Footer />}
    </div>
  );
};

export default App;

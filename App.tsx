
import React, { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Product, Artwork } from './types';
import { useSeoMeta } from './useSeoMeta';
import Navigation from './components/Navigation';
import Home from './components/Home';
import Hero from './components/Hero';
import Creations from './components/Creations';
import Writings from './components/Writings';
import About from './components/About';
import Inquire from './components/Inquire';
import Store from './components/Store';
import Cart from './components/Cart';
import Footer from './components/Footer';
import GenerativeBackground from './components/GenerativeBackground';

const App: React.FC = () => {
  const location = useLocation();
  const [cart, setCart] = useState<(Product | Artwork)[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const handleShowToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddToCart = (product: Product | Artwork) => {
    setCart((prev) => [...prev, product]);
    handleShowToast(`${product.title} added to selection.`);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  const clearCart = () => setCart([]);

  useSeoMeta(location.pathname);

  const isHome = location.pathname === '/';
  const theme = isHome ? 'DARK' : 'LIGHT';

  return (
    <div className="min-h-screen bg-paper-50 selection:bg-bronze-200">
      <GenerativeBackground pathname={location.pathname} theme={theme} />
      <Navigation cartCount={cart.length} theme={theme} />

      <main>
        <Routes>
          <Route path="/" element={<><Hero /><Home /></>} />
          <Route path="/creations" element={<Creations onAcquireArt={handleAddToCart} />} />
          <Route path="/writings" element={<Writings />} />
          <Route path="/about" element={<About />} />
          <Route path="/inquire" element={<Inquire />} />
          <Route path="/shop" element={<Store showToast={handleShowToast} onAddToCart={handleAddToCart} />} />
          <Route path="/cart" element={<Cart items={cart} onRemove={removeFromCart} onClear={clearCart} />} />
          <Route path="*" element={<><Hero /><Home /></>} />
        </Routes>
      </main>

      <Footer />

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[3000] bg-wood-900 text-paper-50 px-6 py-3 font-mono text-xs uppercase tracking-widest shadow-2xl border border-wood-700 animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
};

export default App;

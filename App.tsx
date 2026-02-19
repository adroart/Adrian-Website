
import React, { useState, useEffect } from 'react';
import { View, Product, Artwork } from './types';
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
  const [currentView, setView] = useState<View>(View.HOME);
  const [cart, setCart] = useState<(Product | Artwork)[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Debug verify mount
  useEffect(() => {
    console.log("App Component Mounted Successfully");
  }, []);

  // Function to show transient notifications
  const handleShowToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Shared handler for adding items to the cart across different views
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

  // Routing mechanism to determine which view to display
  const renderView = () => {
    switch (currentView) {
      case View.HOME:
        return (
          <>
            <Hero setView={setView} />
            <Home setView={setView} showToast={handleShowToast} />
          </>
        );
      case View.CREATIONS:
        return <Creations setView={setView} onAcquireArt={handleAddToCart} />;
      case View.WRITINGS:
        return <Writings />;
      case View.ABOUT:
        return <About />;
      case View.INQUIRE:
        return <Inquire />;
      case View.SHOP:
        return <Store setView={setView} showToast={handleShowToast} onAddToCart={handleAddToCart} />;
      case View.CART:
        return <Cart items={cart} onRemove={removeFromCart} setView={setView} onClear={clearCart} />;
      default:
        return <Home setView={setView} showToast={handleShowToast} />;
    }
  };

  const theme = currentView === View.HOME ? 'DARK' : 'LIGHT';

  return (
    <div className="min-h-screen bg-paper-50 selection:bg-bronze-200">
      <GenerativeBackground currentView={currentView} theme={theme} />
      <Navigation currentView={currentView} setView={setView} cartCount={cart.length} theme={theme} />
      
      <main>
        {renderView()}
      </main>

      <Footer setView={setView} />

      {/* Persistent Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[3000] bg-wood-900 text-paper-50 px-6 py-3 font-mono text-xs uppercase tracking-widest shadow-2xl border border-wood-700 animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
};

export default App;

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React Error Boundary Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'monospace', color: '#7f1d1d', background: '#fef2f2', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>System Error</h1>
          <p style={{marginBottom: '20px'}}>The application encountered an unexpected state.</p>
          <pre style={{ padding: '20px', background: 'white', border: '1px solid #ef4444', maxWidth: '800px', overflow: 'auto' }}>
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '20px', padding: '10px 20px', background: '#262321', color: '#f5f4f0', border: 'none', cursor: 'pointer', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '2px' }}
          >
            Reload Interface
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const mountApp = () => {
    const rootElement = document.getElementById('root');

    if (!rootElement) {
        console.error("Fatal: No root element found.");
        return;
    }

    try {
        const root = createRoot(rootElement);
        root.render(
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        );
        
        // Safety cleanup: Ensure the loader is removed if it somehow persisted in the DOM structure
        // though React normally overwrites the innerHTML of root.
        const loader = document.querySelector('.initial-loader');
        if (loader && loader.parentNode !== rootElement) {
            loader.remove();
        }
        
    } catch (e) {
        console.error("Fatal: React failed to mount.", e);
        // Fallback error UI if React itself crashes during mount
        rootElement.innerHTML = `
            <div style="padding:40px; color:#7f1d1d; font-family:monospace; text-align:center; margin-top:100px;">
                <h3 style="font-size:20px; margin-bottom:10px;">MOUNT FAILURE</h3>
                <p>The studio could not be initialized.</p>
                <pre style="margin-top:20px; background:#fef2f2; padding:20px; text-align:left; display:inline-block;">${e}</pre>
            </div>
        `;
    }
};

// Ensure DOM is ready before mounting
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountApp);
} else {
    mountApp();
}
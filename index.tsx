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

const rootElement = document.getElementById('root');

if (rootElement) {
    try {
        const root = createRoot(rootElement);
        // Removed StrictMode intentionally for stability in this CDN environment
        root.render(
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        );
    } catch (e) {
        console.error("Fatal: React failed to mount.", e);
        rootElement.innerHTML = `<div style="padding:40px; color:red; font-family:monospace;">Fatal: Failed to mount application.<br/><br/>${e}</div>`;
    }
} else {
    console.error("Fatal: No root element found.");
}
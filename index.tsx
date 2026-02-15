import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

try {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error("Could not find root element to mount to");
    }

    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("React App Mounted Successfully");
} catch (err) {
    console.error("Failed to mount React App:", err);
    // Fallback display if mounting fails
    document.body.innerHTML += `<div style="color:red; padding:20px;">Failed to mount app: ${err}</div>`;
}
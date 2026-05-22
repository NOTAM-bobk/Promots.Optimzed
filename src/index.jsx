import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// This is the entry point that injects your React App component into the index.html file
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

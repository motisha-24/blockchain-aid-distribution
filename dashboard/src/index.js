import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './design-tokens.css';
import './components-library.css';
import './navbar.css';
import './animations.css';
import './accessibility.css';
import './utilities.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
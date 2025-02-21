import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Import order is important!
import 'antd/dist/reset.css'; // 1. Ant Design base styles
import './styles/index.css';   // 2. Our base styles
import './styles/global.css';  // 3. Our component styles

const root = createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
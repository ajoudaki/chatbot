import React from 'react';
import ReactDOM from 'react-dom';
import 'antd/dist/reset.css';  // Add this line if you want to use Ant Design's reset styles
import './index.css';  // Your custom styles
import ChatApp from './App';
import reportWebVitals from './reportWebVitals';


ReactDOM.render(
  <React.StrictMode>
    <ChatApp />
  </React.StrictMode>,
  document.getElementById('root')
);


// styles/useTheme.js

import { useEffect } from 'react';

export const useTheme = (theme = 'light') => {
  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.style.setProperty('--background-primary', '#1f1f1f');
      root.style.setProperty('--background-secondary', '#2f2f2f');
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--text-secondary', '#b3b3b3');
      root.style.setProperty('--user-message-bg', '#4a4a4a');
      root.style.setProperty('--assistant-message-bg', '#2f2f2f');
      root.style.setProperty('--border-color', '#404040');
    } else {
      // Reset to default light theme values
      root.style.setProperty('--background-primary', '#ffffff');
      root.style.setProperty('--background-secondary', '#f0f0f0');
      root.style.setProperty('--text-primary', '#000000');
      root.style.setProperty('--text-secondary', '#808080');
      root.style.setProperty('--user-message-bg', '#c0c0c0');
      root.style.setProperty('--assistant-message-bg', '#f0f0f0');
      root.style.setProperty('--border-color', '#d9d9d9');
    }
  }, [theme]);
};

// Style utility functions
export const styleUtils = {
  // Combine multiple class names
  classNames: (...classes) => {
    return classes.filter(Boolean).join(' ');
  },
  
  // Get CSS variable value
  getCssVar: (varName) => {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(varName);
  },
  
  // Set CSS variable value
  setCssVar: (varName, value) => {
    document.documentElement.style
      .setProperty(varName, value);
  }
};
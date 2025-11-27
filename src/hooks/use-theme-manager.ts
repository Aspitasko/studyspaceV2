import { useEffect, useState } from 'react';

const applyTheme = (themeId: string) => {
  const htmlElement = document.documentElement;
  const bodyElement = document.body;
  
  console.log('[THEME] Applying theme:', themeId);
  
  // Remove all theme classes from html
  htmlElement.classList.remove('forest', 'orange', 'purple', 'midnight', 'cherry', 'solarized', 'coffee', 'highcontrast', 'autumn', 'rosegold', 'cyberpunk');
  bodyElement.classList.remove('forest', 'orange', 'purple', 'midnight', 'cherry', 'solarized', 'coffee', 'highcontrast', 'autumn', 'rosegold', 'cyberpunk');
  
  // Ensure dark class is always present
  if (!htmlElement.classList.contains('dark')) {
    htmlElement.classList.add('dark');
  }
  if (!bodyElement.classList.contains('dark')) {
    bodyElement.classList.add('dark');
  }
  
  // Apply theme-specific class to both html and body
  if (themeId === 'forest') {
    htmlElement.classList.add('forest');
    bodyElement.classList.add('forest');
  } else if (themeId === 'orange') {
    htmlElement.classList.add('orange');
    bodyElement.classList.add('orange');
  } else if (themeId === 'purple') {
    htmlElement.classList.add('purple');
    bodyElement.classList.add('purple');
  } else if (themeId === 'midnight') {
    htmlElement.classList.add('midnight');
    bodyElement.classList.add('midnight');
  } else if (themeId === 'cherry') {
    htmlElement.classList.add('cherry');
    bodyElement.classList.add('cherry');
  } else if (themeId === 'solarized') {
    htmlElement.classList.add('solarized');
    bodyElement.classList.add('solarized');
  } else if (themeId === 'coffee') {
    htmlElement.classList.add('coffee');
    bodyElement.classList.add('coffee');
  } else if (themeId === 'highcontrast') {
    htmlElement.classList.add('highcontrast');
    bodyElement.classList.add('highcontrast');
  } else if (themeId === 'autumn') {
    htmlElement.classList.add('autumn');
    bodyElement.classList.add('autumn');
  } else if (themeId === 'rosegold') {
    htmlElement.classList.add('rosegold');
    bodyElement.classList.add('rosegold');
  } else if (themeId === 'cyberpunk') {
    htmlElement.classList.add('cyberpunk');
    bodyElement.classList.add('cyberpunk');
  }
  
  console.log('[THEME] HTML classes:', htmlElement.className);
  console.log('[THEME] Body classes:', bodyElement.className);
  
  // Force browser to recalculate styles
  void htmlElement.offsetHeight;
};

export const useThemeManager = () => {
  const [currentTheme, setCurrentTheme] = useState('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem('app-theme') || 'default';
    console.log('[THEME] Loaded from localStorage:', savedTheme);
    setCurrentTheme(savedTheme);
    applyTheme(savedTheme);
    setMounted(true);
  }, []);

  const changeTheme = (themeId: string) => {
    console.log('[THEME] Change theme called with:', themeId);
    setCurrentTheme(themeId);
    localStorage.setItem('app-theme', themeId);
    applyTheme(themeId);
  };

  // Ensure theme is reapplied whenever currentTheme changes
  useEffect(() => {
    if (mounted) {
      applyTheme(currentTheme);
    }
  }, [currentTheme, mounted]);

  return { currentTheme, changeTheme };
};



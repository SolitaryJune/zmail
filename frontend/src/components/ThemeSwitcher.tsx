import React, { useState, useEffect } from 'react';

const ThemeSwitcher: React.FC = () => {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'light' ? 'dark' : 'light');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <button
      onClick={toggleTheme}
      className="w-8 h-8 flex items-center justify-center rounded-md transition-all duration-200 hover:bg-primary/20 hover:text-primary hover:scale-110"
      aria-label="切换主题"
      title="切换主题"
    >
      {theme === 'light' ? (
        <i className="fas fa-moon text-base"></i>
      ) : (
        <i className="fas fa-sun text-base"></i>
      )}
    </button>
  );
};

export default ThemeSwitcher;
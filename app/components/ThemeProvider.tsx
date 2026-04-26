'use client';

import React, { useEffect, useMemo } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import useThemeStore from '@/app/store/theme';

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { theme, getEffectiveTheme } = useThemeStore();
  const effectiveTheme = getEffectiveTheme();

  // Apply dark class to html element for Tailwind
  useEffect(() => {
    const html = document.documentElement;
    if (effectiveTheme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [effectiveTheme]);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const html = document.documentElement;
      if (mediaQuery.matches) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
      // Force zustand to re-render by triggering a state update
      useThemeStore.setState({ theme: 'system' });
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const antdThemeConfig = useMemo(() => {
    if (effectiveTheme === 'dark') {
      return { algorithm: antdTheme.darkAlgorithm };
    }
    return { algorithm: antdTheme.defaultAlgorithm };
  }, [effectiveTheme]);

  return (
    <ConfigProvider theme={antdThemeConfig}>
      {children}
    </ConfigProvider>
  );
};

export default ThemeProvider;

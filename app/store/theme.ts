import { create } from 'zustand';

type ThemeMode = 'light' | 'dark' | 'system';

interface IThemeStore {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  getEffectiveTheme: () => 'light' | 'dark';
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getStoredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem('hivechat-theme');
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      return stored as ThemeMode;
    }
  } catch {}
  return 'system';
};

const useThemeStore = create<IThemeStore>((set, get) => ({
  theme: 'system',

  setTheme: (theme: ThemeMode) => {
    try {
      localStorage.setItem('hivechat-theme', theme);
    } catch {}
    set({ theme });
  },

  getEffectiveTheme: () => {
    const { theme } = get();
    if (theme === 'system') {
      return getSystemTheme();
    }
    return theme;
  },
}));

// Initialize theme from localStorage on client side
if (typeof window !== 'undefined') {
  const stored = getStoredTheme();
  if (stored !== 'system') {
    useThemeStore.setState({ theme: stored });
  } else {
    useThemeStore.setState({ theme: 'system' });
  }
}

export default useThemeStore;

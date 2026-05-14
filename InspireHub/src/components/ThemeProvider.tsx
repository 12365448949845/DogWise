import { useEffect } from 'react';
import { useAppSelector } from '@/store/hooks';

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const mode = useAppSelector((state) => state.theme.mode);

  useEffect(() => {
    const root = document.documentElement;

    if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', mode === 'dark');
    }
  }, [mode]);

  return <>{children}</>;
};

export default ThemeProvider;

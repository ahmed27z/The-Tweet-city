import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0d1117',
          secondary: '#161b22',
        },
        accent: {
          cyan: '#00d4ff',
          amber: '#ffa500',
        },
        text: {
          primary: '#e6edf3',
          muted: '#8b949e',
        },
        building: {
          base: '#1c2128',
        },
        window: {
          glow: '#00d4ff',
        },
        grid: {
          line: '#21262d',
        },
      },
      fontFamily: {
        pixel: ['var(--font-silkscreen)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;

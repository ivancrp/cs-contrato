import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f1419',
          card: '#1a2332',
          border: '#2d3a4f',
        },
        accent: {
          DEFAULT: '#f59e0b',
          muted: '#d97706',
        },
      },
    },
  },
  plugins: [],
};

export default config;

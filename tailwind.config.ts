import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          sky: '#4C91F7',
          mint: '#AEE8D1',
          yellow: '#FFD85C',
          coral: '#F87171',
          charcoal: '#1F2937',
          slate: '#6B7280',
          background: '#FAFAFB',
          surface: '#FFFFFF',
        },
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
};

export default config;

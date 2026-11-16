/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        rycoop: {
          navy: {
            950: '#07101d',
            900: '#0b192c',
            800: '#132742',
            700: '#1e3e62',
          },
          cyan: {
            500: '#00adb5',
            400: '#38bdf8',
            300: '#7dd3fc',
          },
          gold: {
            400: '#fde047',
            500: '#f1c40f',
            600: '#d4af37',
            700: '#b8860b',
          },
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};


import type { Config } from 'tailwindcss';

export default {
  content: ['./src/popup/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        armor: {
          50: '#f0f4ff',
          100: '#dce6ff',
          200: '#b9ccff',
          300: '#8aaaff',
          400: '#5580ff',
          500: '#3355ff',
          600: '#1a33f5',
          700: '#1428e0',
          800: '#1725b4',
          900: '#19268e',
          950: '#111755',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;

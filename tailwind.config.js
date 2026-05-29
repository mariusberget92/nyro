/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nyro: {
          50: '#f8f8f9',
          100: '#f0f0f2',
          200: '#e4e4e8',
          300: '#d0d0d8',
          400: '#a8a8b8',
          500: '#7070a0',
          600: '#5050a0',
          700: '#3a3a8c',
          800: '#252570',
          900: '#141450',
          950: '#0a0a28'
        },
        surface: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          850: '#1f1f23',
          900: '#18181b',
          950: '#0f0f11'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite'
      }
    }
  },
  plugins: []
}

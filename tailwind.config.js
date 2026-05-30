/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        bg0: 'var(--bg-0)',
        bg1: 'var(--bg-1)',
        bg2: 'var(--bg-2)',
        bg3: 'var(--bg-3)',
        bg4: 'var(--bg-4)',
        tx: 'var(--tx)',
        'tx-dim': 'var(--tx-dim)',
        'tx-faint': 'var(--tx-faint)',
        line: 'var(--line)',
        'line-2': 'var(--line-2)',
        accent: 'var(--accent)',
        conv: 'var(--conv)',
        warn: 'var(--warn)',
        ok: 'var(--ok)',
        bad: 'var(--bad)',
        // keep legacy surface colors for compatibility
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
        },
        nyro: {
          500: '#88c0d0',
          600: '#88c0d0'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius)',
        md: '8px',
        sm: '6px'
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite'
      }
    }
  },
  plugins: []
}

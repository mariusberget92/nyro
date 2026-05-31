/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html,vue}'],
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
        'accent-2': 'var(--accent-2)',
        conv: 'var(--conv)',
        warn: 'var(--warn)',
        ok: 'var(--ok)',
        bad: 'var(--bad)',
        // Nyro brand
        nyro: {
          blue: '#3d7fff',
          violet: '#7c5cff',
          graphite: '#0e131b',
          ice: '#e7ecf3',
          500: '#3d7fff',
          600: '#7c5cff'
        }
      },
      backgroundImage: {
        'accent-grad': 'linear-gradient(135deg, #3d7fff, #7c5cff)'
      },
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius)',
        md: '8px',
        sm: '6px'
      },
      boxShadow: {
        accent: '0 8px 22px -8px rgba(61,127,255,0.7)'
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite'
      }
    }
  },
  plugins: []
}

import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        surface: '#18181b',
        border: '#27272a',
        muted: '#71717a',
        accent: '#10b981',
        'accent-dim': '#052e16',
        'accent-text': '#6ee7b7',
      },
    },
  },
  plugins: [],
}

export default config

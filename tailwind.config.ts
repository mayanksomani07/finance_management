import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0f0f23',
        card: '#1a1a2e',
        accent: '#6c63ff',
        income: '#00d9a6',
        expense: '#ff6b6b',
        border: '#2a2a4a',
        muted: '#8888aa',
      },
    },
  },
  plugins: [],
}
export default config

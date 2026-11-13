export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0a0f1d', 800: '#1e1b4b' },
        brand: { DEFAULT: '#2563eb', accent: '#4f46e5', soft: '#6366f1' },
        online: '#10b981',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 24px -6px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
}

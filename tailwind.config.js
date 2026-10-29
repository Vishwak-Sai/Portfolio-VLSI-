/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: { colors: { ink: '#06101c', panel: '#0a1928', cyan: '#20d5ff', muted: '#9bb0c5' }, boxShadow: { glow: '0 0 35px rgba(32,213,255,.12)' } } },
  plugins: []
}
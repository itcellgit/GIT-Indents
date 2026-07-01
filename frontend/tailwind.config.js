export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#1e3a8a', // Deep navy blue
          purple: '#4c1d95',
          DEFAULT: '#1d4ed8',
          light: '#dbeafe'
        }
      }
    },
  },
  plugins: [],
}

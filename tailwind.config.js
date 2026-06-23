/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        toss: {
          blue: '#3182f6',
          blueLight: '#e8f3ff',
          gray: '#f2f4f6',
          textDark: '#191f28',
          textMuted: '#4e5968',
          textLight: '#8b95a1',
        }
      },
      borderRadius: {
        '3xl': '24px', // Standard rounded-3xl in Toss
      }
    },
  },
  plugins: [],
}

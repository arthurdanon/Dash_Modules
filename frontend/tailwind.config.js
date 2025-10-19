/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/index.html",
    "./src/**/*.{js,jsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { '2xl': '1rem' },
      boxShadow: { soft: '0 10px 30px rgba(0,0,0,0.08)' },
    },
  },
  plugins: [require("daisyui")],
};

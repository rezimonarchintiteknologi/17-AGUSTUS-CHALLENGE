/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f1420',
          card: '#171d2b',
          border: '#262e42',
        },
        accent: {
          DEFAULT: '#3b6cf6',
          hover: '#2f5adf',
          soft: '#1b2540',
          light: '#7fa2ff',
        },
        muted: '#8b93a7',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Luminous "Sunrise" — pink leads, blue supports, yellow is the accent.
        brand: {
          50: '#fff1f6',
          100: '#ffe3ee',
          200: '#ffc9dd',
          300: '#ffa0c1',
          400: '#ff6f9c',
          500: '#ff5c8a',
          600: '#ef3f74',
          700: '#d0295c',
          800: '#a81f49',
          900: '#8a1c40',
        },
        blue: {
          50: '#eaf3ff',
          100: '#d6e8ff',
          200: '#b3d2ff',
          300: '#85b6ff',
          400: '#5fa0ff',
          500: '#4d94ff',
          600: '#2f78e6',
          700: '#245fb8',
          800: '#1f4f96',
          900: '#1d447e',
        },
        sun: {
          50: '#fff9e6',
          100: '#fff0c0',
          200: '#ffe58f',
          300: '#f9d65e',
          400: '#f6c945',
          500: '#eeb81f',
          600: '#d19b12',
        },
        // Warm heart red — kept as the logo's own note.
        heart: '#ef3f74',
        ink: {
          DEFAULT: '#232a45',
          soft: '#5a627e',
          muted: '#8890a8',
        },
        paper: '#fdfcff',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
        script: ['"Dancing Script"', 'cursive'],
      },
      backgroundImage: {
        sunrise: 'linear-gradient(135deg,#fff2c9 0%,#ffd3e2 52%,#cfe8ff 100%)',
        'sunrise-soft': 'linear-gradient(135deg,#fff8ea 0%,#ffeaf1 52%,#eaf3ff 100%)',
      },
      boxShadow: {
        soft: '0 12px 40px -12px rgba(35,42,69,0.18)',
        glow: '0 10px 30px -8px rgba(239,63,116,0.35)',
      },
    },
  },
  plugins: [],
};
